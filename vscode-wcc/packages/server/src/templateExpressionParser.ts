/**
 * Template Expression Parser — extracts embedded expressions from .wcc template blocks.
 *
 * Locates interpolations ({{expr}}), event directives (@event="expr"),
 * attribute bindings (:attr="expr"), and model bindings (model="variable")
 * with their exact positions relative to the template block start.
 */

/** Type of expression found in the template */
export type ExpressionType = 'interpolation' | 'event' | 'bind' | 'model';

/** Expression extracted from the template with its position */
export interface TemplateExpression {
  /** Type of expression */
  type: ExpressionType;
  /** Content of the expression (without delimiters) */
  content: string;
  /** Offset of the first character of the expression relative to the template block start */
  startOffset: number;
  /** Name of the attribute/directive (e.g., "click" for @click, "class" for :class) */
  attributeName?: string;
}

/**
 * Iteration variable extracted from an each directive.
 */
export interface EachVariable {
  /** Name of the item variable (e.g., "item") */
  itemVar: string;
  /** Name of the index variable (e.g., "index"), or null if not destructured */
  indexVar: string | null;
  /** Source expression (e.g., "items()" or "items") */
  source: string;
}

/**
 * Iteration variable declaration with offset information for source mappings.
 */
export interface EachDeclaration {
  /** Name of the item variable */
  itemVar: string;
  /** Offset of itemVar within the template block */
  itemVarOffset: number;
  /** Name of the index variable, or null */
  indexVar: string | null;
  /** Offset of indexVar within the template block, or -1 */
  indexVarOffset: number;
  /** Source expression */
  source: string;
  /** Offset of source expression within the template block */
  sourceOffset: number;
}

/**
 * Extracts iteration variables from all `each` directives in the template.
 * Parses expressions like `each="item in items()"` and `each="(item, index) in items()"`.
 */
export function extractEachVariables(templateContent: string): EachVariable[] {
  const variables: EachVariable[] = [];
  const eachRe = /\beach="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = eachRe.exec(templateContent)) !== null) {
    const expr = match[1];

    // Try destructured form: (item, index) in source
    const destructuredMatch = /^\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(.+)\s*$/.exec(expr);
    if (destructuredMatch) {
      variables.push({ itemVar: destructuredMatch[1], indexVar: destructuredMatch[2], source: destructuredMatch[3].trim() });
      continue;
    }

    // Try simple form: item in source
    const simpleMatch = /^\s*(\w+)\s+in\s+(.+)\s*$/.exec(expr);
    if (simpleMatch) {
      variables.push({ itemVar: simpleMatch[1], indexVar: null, source: simpleMatch[2].trim() });
    }
  }

  return variables;
}

/**
 * Extracts iteration variable declarations with exact offsets for source mappings.
 * This enables hover/intellisense on the variable names inside `each="..."`.
 */
export function extractEachDeclarations(templateContent: string): EachDeclaration[] {
  const declarations: EachDeclaration[] = [];
  const eachRe = /\beach="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = eachRe.exec(templateContent)) !== null) {
    const expr = match[1];
    const attrValueStart = match.index + 'each="'.length;

    // Try destructured form: (item, index) in source
    const destructuredMatch = /^\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(.+)\s*$/.exec(expr);
    if (destructuredMatch) {
      const itemVar = destructuredMatch[1];
      const indexVar = destructuredMatch[2];
      const source = destructuredMatch[3].trim();

      const itemVarOffset = attrValueStart + expr.indexOf(itemVar);
      const indexVarOffset = attrValueStart + expr.indexOf(indexVar, expr.indexOf(itemVar) + itemVar.length);
      const sourceOffset = attrValueStart + expr.lastIndexOf(source);

      declarations.push({ itemVar, itemVarOffset, indexVar, indexVarOffset, source, sourceOffset });
      continue;
    }

    // Try simple form: item in source
    const simpleMatch = /^\s*(\w+)\s+in\s+(.+)\s*$/.exec(expr);
    if (simpleMatch) {
      const itemVar = simpleMatch[1];
      const source = simpleMatch[2].trim();

      const itemVarOffset = attrValueStart + expr.indexOf(itemVar);
      const sourceOffset = attrValueStart + expr.lastIndexOf(source);

      declarations.push({ itemVar, itemVarOffset, indexVar: null, indexVarOffset: -1, source, sourceOffset });
    }
  }

  return declarations;
}

/**
 * Extracts all embedded expressions from a template block.
 * Searches for: {{expr}}, @event="expr", :attr="expr", model="variable"
 *
 * Expressions nested within control directives (each, if) are extracted
 * regardless of nesting level. Empty expressions are filtered out.
 */
export function extractTemplateExpressions(templateContent: string): TemplateExpression[] {
  const expressions: TemplateExpression[] = [];

  // Extract interpolations: {{expr}}
  // Use a pattern that does not match }} inside the expression content
  const interpolationRe = /\{\{((?:[^}]|\}(?!\}))+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = interpolationRe.exec(templateContent)) !== null) {
    const content = match[1];
    if (content.trim().length > 0) {
      expressions.push({
        type: 'interpolation',
        content,
        startOffset: match.index + 2, // position of {{ + 2
      });
    }
  }

  // Extract event directives: @event="expr"
  const eventRe = /@([\w.-]+)="([^"]*)"/g;
  while ((match = eventRe.exec(templateContent)) !== null) {
    const content = match[2];
    if (content.trim().length > 0) {
      const quoteOffset = match.index + 1 + match[1].length + 2; // @ + name + ="
      expressions.push({
        type: 'event',
        content,
        startOffset: quoteOffset,
        attributeName: match[1],
      });
    }
  }

  // Extract attribute bindings: :attr="expr"
  const bindRe = /:([\w.-]+)="([^"]*)"/g;
  while ((match = bindRe.exec(templateContent)) !== null) {
    const content = match[2];
    if (content.trim().length > 0) {
      const quoteOffset = match.index + 1 + match[1].length + 2; // : + name + ="
      expressions.push({
        type: 'bind',
        content,
        startOffset: quoteOffset,
        attributeName: match[1],
      });
    }
  }

  // Extract model bindings: model="variable"
  // Use a negative lookbehind to avoid matching :model or @model (already handled above)
  const modelRe = /(?<![:\w@])model="([^"]*)"/g;
  while ((match = modelRe.exec(templateContent)) !== null) {
    const content = match[1];
    if (content.trim().length > 0) {
      const quoteOffset = match.index + 'model="'.length; // model="
      expressions.push({
        type: 'model',
        content,
        startOffset: quoteOffset,
        attributeName: 'model',
      });
    }
  }

  // Extract control directive expressions: if="expr", else-if="expr", show="expr"
  const controlRe = /(?<![:\w@])(if|else-if|show)="([^"]*)"/g;
  while ((match = controlRe.exec(templateContent)) !== null) {
    const content = match[2];
    if (content.trim().length > 0) {
      const quoteOffset = match.index + match[1].length + 2; // directive + ="
      expressions.push({
        type: 'bind',
        content,
        startOffset: quoteOffset,
        attributeName: match[1],
      });
    }
  }

  // Extract each source expressions: each="(item, index) in source" or each="item in source"
  const eachSourceRe = /\beach="([^"]*)"/g;
  while ((match = eachSourceRe.exec(templateContent)) !== null) {
    const expr = match[1];
    // Extract the source part (after "in ")
    const inMatch = /\s+in\s+(.+)\s*$/.exec(expr);
    if (inMatch) {
      const source = inMatch[1].trim();
      if (source.length > 0) {
        // Calculate offset: position of source within the each attribute value
        const attrValueStart = match.index + 'each="'.length;
        const sourceStartInExpr = expr.indexOf(inMatch[1]);
        expressions.push({
          type: 'bind',
          content: source,
          startOffset: attrValueStart + sourceStartInExpr,
          attributeName: 'each',
        });
      }
    }
  }

  return expressions;
}
