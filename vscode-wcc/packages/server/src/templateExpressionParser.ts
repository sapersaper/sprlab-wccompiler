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
}

/**
 * Extracts iteration variables from all `each` directives in the template.
 * Parses expressions like `each="item in items"` and `each="(item, index) in items"`.
 */
export function extractEachVariables(templateContent: string): EachVariable[] {
  const variables: EachVariable[] = [];
  const eachRe = /\beach="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = eachRe.exec(templateContent)) !== null) {
    const expr = match[1];

    // Try destructured form: (item, index) in source
    const destructuredMatch = /^\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+/.exec(expr);
    if (destructuredMatch) {
      variables.push({ itemVar: destructuredMatch[1], indexVar: destructuredMatch[2] });
      continue;
    }

    // Try simple form: item in source
    const simpleMatch = /^\s*(\w+)\s+in\s+/.exec(expr);
    if (simpleMatch) {
      variables.push({ itemVar: simpleMatch[1], indexVar: null });
    }
  }

  return variables;
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

  return expressions;
}
