import type { VirtualCode, CodeMapping, CodeInformation, LanguagePlugin } from '@volar/language-core';
import type { URI } from 'vscode-uri';
import type * as ts from 'typescript';
import { parseWccBlocks } from './wccParser';
import type { WccBlock } from './wccParser';
import { extractTemplateExpressions, extractEachVariables, extractEachDeclarations } from './templateExpressionParser';
import type { TemplateExpression, EachVariable, EachDeclaration } from './templateExpressionParser';

/** Full capabilities for code mappings — enables all intellisense features */
const fullCapabilities: CodeInformation = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
};

/**
 * Capabilities for template expression mappings — enables intellisense features
 * (completion, hover, go-to-definition) including type diagnostics.
 *
 * Type verification is enabled because template expressions now use explicit
 * signal calls (e.g., status() instead of status), so TypeScript sees the
 * unwrapped value type directly.
 */
const templateExpressionCapabilities: CodeInformation = {
  completion: true,
  format: false,
  navigation: true,
  semantic: true,
  structure: false,
  verification: true,
};

/** Creates a ts.IScriptSnapshot from a string */
function createSnapshot(content: string): ts.IScriptSnapshot {
  return {
    getText: (start, end) => content.substring(start, end),
    getLength: () => content.length,
    getChangeRange: () => undefined,
  };
}

/**
 * Determines the languageId for a script block based on its attrs.
 * - If attrs contains lang="ts" → "typescript"
 * - Otherwise → "javascript"
 */
function getScriptLanguageId(attrs: string): string {
  if (/lang=["']ts["']/.test(attrs)) {
    return 'typescript';
  }
  return 'javascript';
}

/**
 * Extracts prop names and their inferred types from a script block's defineProps call.
 * Supports:
 * - defineProps<{ name: string, age: number }>(...) — generic form (extracts types directly)
 * - defineProps({ name: 'default', age: 0 }) — object defaults form (infers from default values)
 * - defineProps(['name', 'age']) — array form (types as any)
 */
function extractPropNamesFromScript(scriptContent: string): { name: string; type: string }[] {
  const props: { name: string; type: string }[] = [];

  // Generic form: defineProps<{ name: string, age: number }>
  const genericMatch = scriptContent.match(/defineProps\s*<\s*\{([^}]+)\}\s*>/);
  if (genericMatch) {
    const body = genericMatch[1];
    const propRe = /(\w+)\s*[?]?\s*:\s*([^,}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(body)) !== null) {
      props.push({ name: m[1], type: m[2].trim() });
    }
    if (props.length > 0) return props;
  }

  // Object defaults form: defineProps({ name: 'default', age: 0 })
  const objectMatch = scriptContent.match(/defineProps\(\s*\{([^}]+)\}\s*\)/);
  if (objectMatch) {
    const body = objectMatch[1];
    const propRe = /(\w+)\s*:\s*([^,}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(body)) !== null) {
      const name = m[1];
      const value = m[2].trim();
      // Infer type from default value
      let type = 'any';
      if (/^['"]/.test(value)) type = 'string';
      else if (/^\d/.test(value) || value === 'NaN' || value === 'Infinity') type = 'number';
      else if (value === 'true' || value === 'false') type = 'boolean';
      else if (value.startsWith('[')) type = 'any[]';
      else if (value.startsWith('{')) type = 'Record<string, any>';
      props.push({ name, type });
    }
    if (props.length > 0) return props;
  }

  // Array form: defineProps(['name', 'age'])
  const arrayMatch = scriptContent.match(/defineProps\(\s*\[([^\]]+)\]\s*\)/);
  if (arrayMatch) {
    const body = arrayMatch[1];
    const strRe = /['"](\w+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = strRe.exec(body)) !== null) {
      props.push({ name: m[1], type: 'any' });
    }
  }

  return props;
}

/**
 * Generates the VirtualCode for template expressions.
 * The virtual code has the form:
 *
 *   // [script block content - no mapping]
 *   expr1;
 *   expr2;
 *   ...
 *
 * Where each `exprN` has a Source Mapping pointing to its original
 * position in the .wcc file.
 */
export function generateTemplateExpressionsCode(
  scriptBlock: WccBlock | null,
  templateBlock: WccBlock,
  expressions: TemplateExpression[],
  scriptLanguageId: string,
  eachVariables: EachVariable[] = [],
  eachDeclarations: EachDeclaration[] = []
): VirtualCode {
  // Build the prefix from the script block content (no mapping for this part)
  let prefix = scriptBlock ? scriptBlock.content + '\n' : '';

  // Extract prop names from defineProps and declare them as variables
  // so TypeScript knows about them in template expressions
  if (scriptBlock) {
    const propDefs = extractPropNamesFromScript(scriptBlock.content);
    for (const prop of propDefs) {
      prefix += `declare const ${prop.name}: ${prop.type};\n`;
    }
  }

  // Add declarations for each iteration variables with inferred types
  // These are generated WITHOUT mappings (prefix has no mappings)
  for (const each of eachVariables) {
    const source = each.source;
    if (source.endsWith('()')) {
      // Source is a signal/computed call like items()
      const varName = source.slice(0, -2); // strip ()
      prefix += `const __each_arr_${varName} = ${source};\n`;
      prefix += `const ${each.itemVar} = __each_arr_${varName}[0];\n`;
    } else {
      // Source is a bare name
      prefix += `const __each_arr_${source} = ${source}();\n`;
      prefix += `const ${each.itemVar} = __each_arr_${source}[0];\n`;
    }
    if (each.indexVar) {
      prefix += `const ${each.indexVar}: number = 0;\n`;
    }
  }

  const prefixLength = prefix.length;

  // Build the expressions code and their mappings
  let expressionsCode = '';
  const mappings: CodeMapping[] = [];
  let currentOffset = 0;

  // Add mapped expressions for each variable declarations (hover/go-to-definition on item/index)
  for (const decl of eachDeclarations) {
    // Map itemVar: generate "item;" with mapping to the item variable in the each attribute
    const itemLine = `${decl.itemVar};\n`;
    mappings.push({
      sourceOffsets: [templateBlock.startOffset + decl.itemVarOffset],
      generatedOffsets: [prefixLength + currentOffset],
      lengths: [decl.itemVar.length],
      data: templateExpressionCapabilities,
    });
    expressionsCode += itemLine;
    currentOffset += itemLine.length;

    // Map indexVar if present
    if (decl.indexVar && decl.indexVarOffset >= 0) {
      const indexLine = `${decl.indexVar};\n`;
      mappings.push({
        sourceOffsets: [templateBlock.startOffset + decl.indexVarOffset],
        generatedOffsets: [prefixLength + currentOffset],
        lengths: [decl.indexVar.length],
        data: templateExpressionCapabilities,
      });
      expressionsCode += indexLine;
      currentOffset += indexLine.length;
    }
  }

  for (const expression of expressions) {
    // Expressions starting with '{' need to be wrapped in parentheses so TypeScript
    // interprets them as object literals instead of code blocks.
    const needsParens = expression.content.trimStart().startsWith('{');
    const wrapPrefix = needsParens ? '(' : '';
    const wrapSuffix = needsParens ? ')' : '';

    mappings.push({
      sourceOffsets: [templateBlock.startOffset + expression.startOffset],
      generatedOffsets: [prefixLength + currentOffset + wrapPrefix.length],
      lengths: [expression.content.length],
      data: templateExpressionCapabilities,
    });

    const line = wrapPrefix + expression.content + wrapSuffix + ';\n';
    expressionsCode += line;
    currentOffset += line.length;
  }

  const fullContent = prefix + expressionsCode;

  return {
    id: 'template_expressions_0',
    languageId: scriptLanguageId,
    snapshot: createSnapshot(fullContent),
    mappings,
    embeddedCodes: [],
  };
}

const jsKeywords = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof',
  'new', 'delete', 'void', 'this', 'if', 'else', 'return',
]);

/**
 * WccCode — VirtualCode implementation for .wcc Single File Components.
 *
 * Represents a parsed .wcc file with embedded VirtualCode objects for each
 * block (script, template, style). Volar uses these to delegate intellisense
 * to the appropriate service plugin.
 */
export class WccCode implements VirtualCode {
  id = 'root';
  languageId = 'wcc';
  snapshot: ts.IScriptSnapshot;
  mappings: CodeMapping[] = [];
  embeddedCodes: VirtualCode[] = [];

  constructor(snapshot: ts.IScriptSnapshot) {
    this.snapshot = snapshot;
    this.embeddedCodes = this.generateEmbeddedCodes(snapshot);
  }

  /** Re-parses the source and regenerates embeddedCodes from a new snapshot */
  update(snapshot: ts.IScriptSnapshot): void {
    this.snapshot = snapshot;
    this.embeddedCodes = this.generateEmbeddedCodes(snapshot);
  }

  /** Parses the snapshot and generates embedded VirtualCode for each present block */
  private generateEmbeddedCodes(snapshot: ts.IScriptSnapshot): VirtualCode[] {
    const source = snapshot.getText(0, snapshot.getLength());
    const parsed = parseWccBlocks(source);
    const codes: VirtualCode[] = [];

    if (parsed.script) {
      const block = parsed.script;

      // Append template usage references to suppress "declared but never read" warnings
      let usageSuffix = '';
      if (parsed.template) {
        const expressions = extractTemplateExpressions(parsed.template.content);
        const usages = new Set<string>();
        for (const expr of expressions) {
          // Extract top-level identifiers from each expression
          const identRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
          let identMatch: RegExpExecArray | null;
          while ((identMatch = identRe.exec(expr.content)) !== null) {
            const name = identMatch[1];
            if (!jsKeywords.has(name)) {
              usages.add(name);
            }
          }
        }
        if (usages.size > 0) {
          usageSuffix = '\n' + [...usages].map(u => `${u};`).join('\n') + '\n';
        }
      }

      codes.push({
        id: 'script_0',
        languageId: getScriptLanguageId(block.attrs),
        snapshot: createSnapshot(block.content + usageSuffix),
        mappings: [
          {
            sourceOffsets: [block.startOffset],
            generatedOffsets: [0],
            lengths: [block.content.length],
            data: fullCapabilities,
          },
        ],
        embeddedCodes: [],
      });
    }

    if (parsed.template) {
      const block = parsed.template;
      codes.push({
        id: 'template_0',
        languageId: 'html',
        snapshot: createSnapshot(block.content),
        mappings: [
          {
            sourceOffsets: [block.startOffset],
            generatedOffsets: [0],
            lengths: [block.content.length],
            data: fullCapabilities,
          },
        ],
        embeddedCodes: [],
      });

      // Generate template_expressions_0 VirtualCode for intellisense in template expressions
      const expressions = extractTemplateExpressions(block.content);
      if (expressions.length > 0) {
        const scriptLanguageId = parsed.script
          ? getScriptLanguageId(parsed.script.attrs)
          : 'javascript';
        const eachVariables = extractEachVariables(block.content);
        const eachDeclarations = extractEachDeclarations(block.content);
        codes.push(
          generateTemplateExpressionsCode(
            parsed.script ?? null,
            block,
            expressions,
            scriptLanguageId,
            eachVariables,
            eachDeclarations
          )
        );
      }
    }

    if (parsed.style) {
      const block = parsed.style;
      codes.push({
        id: 'style_0',
        languageId: 'css',
        snapshot: createSnapshot(block.content),
        mappings: [
          {
            sourceOffsets: [block.startOffset],
            generatedOffsets: [0],
            lengths: [block.content.length],
            data: fullCapabilities,
          },
        ],
        embeddedCodes: [],
      });
    }

    return codes;
  }
}

/**
 * wccLanguagePlugin — LanguagePlugin for .wcc Single File Components.
 *
 * Tells Volar how to identify .wcc files and how to create/update
 * the WccCode virtual document that represents them.
 */
export const wccLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri: URI) {
    if (uri.path.endsWith('.wcc')) {
      return 'wcc';
    }
    return undefined;
  },
  createVirtualCode(_uri: URI, languageId: string, snapshot: ts.IScriptSnapshot) {
    if (languageId === 'wcc') {
      return new WccCode(snapshot);
    }
    return undefined;
  },
  updateVirtualCode(_uri: URI, wccCode: VirtualCode, snapshot: ts.IScriptSnapshot) {
    (wccCode as WccCode).update(snapshot);
    return wccCode;
  },
  typescript: {
    extraFileExtensions: [
      { extension: 'wcc', isMixedContent: true, scriptKind: 7 /* ts.ScriptKind.Deferred */ },
    ],
    getServiceScript(root: VirtualCode) {
      for (const code of root.embeddedCodes ?? []) {
        if (code.id === 'script_0') {
          return {
            code,
            extension: code.languageId === 'typescript' ? '.ts' : '.js',
            scriptKind: code.languageId === 'typescript' ? 3 : 1, /* TS or JS */
          };
        }
      }
      return undefined;
    },
    getExtraServiceScripts(fileName: string, root: VirtualCode) {
      const scripts: { code: VirtualCode; extension: string; scriptKind: number; fileName: string }[] = [];
      for (const code of root.embeddedCodes ?? []) {
        if (code.id === 'template_expressions_0') {
          const ext = code.languageId === 'typescript' ? '.ts' : '.js';
          scripts.push({
            code,
            extension: ext,
            scriptKind: code.languageId === 'typescript' ? 3 : 1,
            fileName: fileName + '.template_expressions' + ext,
          });
        }
      }
      return scripts;
    },
  },
};
