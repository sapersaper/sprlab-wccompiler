import type { VirtualCode, CodeMapping, CodeInformation, LanguagePlugin } from '@volar/language-core';
import type { URI } from 'vscode-uri';
import type * as ts from 'typescript';
import { parseWccBlocks } from './wccParser';

/** Full capabilities for code mappings — enables all intellisense features */
const fullCapabilities: CodeInformation = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
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

      // Append template usage references to the script content so TS sees them in the same scope
      let scriptContent = block.content;
      let usageSuffix = '';
      if (parsed.template) {
        const usages = extractTemplateUsages(parsed.template.content);
        if (usages.length > 0) {
          usageSuffix = '\n' + usages.map(u => `${u};`).join('\n') + '\n';
        }
      }

      codes.push({
        id: 'script_0',
        languageId: getScriptLanguageId(block.attrs),
        snapshot: createSnapshot(scriptContent + usageSuffix),
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
 * Extracts variable/function names referenced in a template.
 * Looks for {{expr}} interpolations and @event="handler" bindings.
 */
function extractTemplateUsages(templateContent: string): string[] {
  const usages = new Set<string>();

  // Match {{expression}} — extract identifiers
  const interpolationRe = /\{\{(.+?)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = interpolationRe.exec(templateContent)) !== null) {
    // Extract top-level identifiers from the expression
    const expr = match[1].trim();
    const identRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let identMatch: RegExpExecArray | null;
    while ((identMatch = identRe.exec(expr)) !== null) {
      const name = identMatch[1];
      // Skip common JS keywords
      if (!jsKeywords.has(name)) {
        usages.add(name);
      }
    }
  }

  // Match @event="handler" or @event="handler()"
  const eventRe = /@[\w.-]+="([^"]+)"/g;
  while ((match = eventRe.exec(templateContent)) !== null) {
    const handler = match[1].trim().replace(/\(.*\)$/, '');
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(handler)) {
      usages.add(handler);
    }
  }

  return [...usages];
}

const jsKeywords = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof',
  'new', 'delete', 'void', 'this', 'if', 'else', 'return',
]);

/**
 * wccLanguagePlugin — LanguagePlugin for .wcc Single File Components.
 *
 * Tells Volar how to identify .wcc files and how to create/update
 * the WccCode virtual document that represents them.
 */
export const wccLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith('.wcc')) {
      return 'wcc';
    }
    return undefined;
  },
  createVirtualCode(_uri, languageId, snapshot) {
    if (languageId === 'wcc') {
      return new WccCode(snapshot);
    }
    return undefined;
  },
  updateVirtualCode(_uri, wccCode, snapshot) {
    (wccCode as WccCode).update(snapshot);
    return wccCode;
  },
  typescript: {
    extraFileExtensions: [
      { extension: 'wcc', isMixedContent: true, scriptKind: 7 /* ts.ScriptKind.Deferred */ },
    ],
    getServiceScript(root) {
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
  },
};
