import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractTemplateExpressions } from './templateExpressionParser';

/**
 * Property-Based Tests for templateExpressionParser.ts
 *
 * Feature: template-intellisense, Property 1: Extracción correcta de expresiones del template
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

// --- Generators ---

/** Generator for valid JS/TS identifiers */
const arbIdentifier = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 2,
    maxLength: 8,
  })
  .map((chars) => chars.join(''));

/** Generator for property access expressions like `obj.prop` */
const arbPropertyAccess = fc
  .tuple(arbIdentifier, arbIdentifier)
  .map(([obj, prop]) => `${obj}.${prop}`);

/** Generator for function call expressions like `fn()` or `fn(arg)` */
const arbFunctionCall = fc
  .tuple(arbIdentifier, fc.boolean(), arbIdentifier)
  .map(([fn, hasArg, arg]) => (hasArg ? `${fn}(${arg})` : `${fn}()`));

/** Generator for expressions with operators like `a + b` */
const arbOperatorExpr = fc
  .tuple(arbIdentifier, fc.constantFrom(' + ', ' - ', ' * ', ' === ', ' || ', ' && '), arbIdentifier)
  .map(([left, op, right]) => `${left}${op}${right}`);

/** Generator for valid expressions (union of all expression types) */
const arbExpression = fc.oneof(arbIdentifier, arbPropertyAccess, arbFunctionCall, arbOperatorExpr);

/** Generator for event names */
const arbEventName = fc.constantFrom('click', 'input', 'change', 'submit', 'keydown', 'mouseover');

/** Generator for attribute names for bindings */
const arbAttrName = fc.constantFrom('class', 'style', 'disabled', 'value', 'href', 'id', 'title');

/** Generator for safe HTML text (no special characters that could interfere with parsing) */
const arbSafeText = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz 0123456789'.split('')), {
    minLength: 0,
    maxLength: 20,
  })
  .map((chars) => chars.join('').trim());

/** Generator for a template with interpolations */
function arbInterpolationTemplate(): fc.Arbitrary<{ template: string; expressions: string[] }> {
  return fc
    .tuple(arbSafeText, arbExpression, arbSafeText)
    .map(([before, expr, after]) => ({
      template: `<p>${before}{{${expr}}}${after}</p>`,
      expressions: [expr],
    }));
}

/** Generator for a template with event directives */
function arbEventTemplate(): fc.Arbitrary<{ template: string; expressions: string[] }> {
  return fc
    .tuple(arbEventName, arbExpression)
    .map(([event, expr]) => ({
      template: `<button @${event}="${expr}">text</button>`,
      expressions: [expr],
    }));
}

/** Generator for a template with bind directives */
function arbBindTemplate(): fc.Arbitrary<{ template: string; expressions: string[] }> {
  return fc
    .tuple(arbAttrName, arbExpression)
    .map(([attr, expr]) => ({
      template: `<div :${attr}="${expr}">content</div>`,
      expressions: [expr],
    }));
}

/** Generator for a template with model bindings */
function arbModelTemplate(): fc.Arbitrary<{ template: string; expressions: string[] }> {
  return arbIdentifier.map((variable) => ({
    template: `<input model="${variable}" />`,
    expressions: [variable],
  }));
}

/** Generator for templates with multiple expression types */
function arbMixedTemplate(): fc.Arbitrary<{ template: string; expressions: string[] }> {
  return fc
    .tuple(arbExpression, arbEventName, arbExpression, arbAttrName, arbExpression, arbIdentifier)
    .map(([interpExpr, event, eventExpr, attr, bindExpr, modelVar]) => ({
      template: [
        `<div :${attr}="${bindExpr}">`,
        `  <p>{{${interpExpr}}}</p>`,
        `  <button @${event}="${eventExpr}">click</button>`,
        `  <input model="${modelVar}" />`,
        `</div>`,
      ].join('\n'),
      expressions: [bindExpr, interpExpr, eventExpr, modelVar],
    }));
}

// --- Property Tests ---

describe('Feature: template-intellisense, Property 1: Extracción correcta de expresiones del template', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   *
   * For any template content that contains embedded expressions (interpolations {{expr}},
   * directives @event="expr", bindings :attr="expr", or model="var"), the Template_Parser
   * SHALL extract each expression with a `content` that matches exactly the text of the
   * expression in the template, and a `startOffset` such that
   * `templateContent.slice(startOffset, startOffset + content.length) === content`.
   */
  it('interpolation expressions are extracted with correct content and offset', () => {
    fc.assert(
      fc.property(arbInterpolationTemplate(), ({ template, expressions }) => {
        const result = extractTemplateExpressions(template);
        const interpolations = result.filter((e) => e.type === 'interpolation');

        // Should extract at least the expected expressions
        expect(interpolations.length).toBeGreaterThanOrEqual(expressions.length);

        // For each extracted interpolation, verify the offset property
        for (const expr of interpolations) {
          expect(template.slice(expr.startOffset, expr.startOffset + expr.content.length)).toBe(
            expr.content
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('event directive expressions are extracted with correct content and offset', () => {
    fc.assert(
      fc.property(arbEventTemplate(), ({ template, expressions }) => {
        const result = extractTemplateExpressions(template);
        const events = result.filter((e) => e.type === 'event');

        // Should extract at least the expected expressions
        expect(events.length).toBeGreaterThanOrEqual(expressions.length);

        // For each extracted event expression, verify the offset property
        for (const expr of events) {
          expect(template.slice(expr.startOffset, expr.startOffset + expr.content.length)).toBe(
            expr.content
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('bind directive expressions are extracted with correct content and offset', () => {
    fc.assert(
      fc.property(arbBindTemplate(), ({ template, expressions }) => {
        const result = extractTemplateExpressions(template);
        const binds = result.filter((e) => e.type === 'bind');

        // Should extract at least the expected expressions
        expect(binds.length).toBeGreaterThanOrEqual(expressions.length);

        // For each extracted bind expression, verify the offset property
        for (const expr of binds) {
          expect(template.slice(expr.startOffset, expr.startOffset + expr.content.length)).toBe(
            expr.content
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('model binding expressions are extracted with correct content and offset', () => {
    fc.assert(
      fc.property(arbModelTemplate(), ({ template, expressions }) => {
        const result = extractTemplateExpressions(template);
        const models = result.filter((e) => e.type === 'model');

        // Should extract at least the expected expressions
        expect(models.length).toBeGreaterThanOrEqual(expressions.length);

        // For each extracted model expression, verify the offset property
        for (const expr of models) {
          expect(template.slice(expr.startOffset, expr.startOffset + expr.content.length)).toBe(
            expr.content
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all expression types satisfy the offset invariant in mixed templates', () => {
    fc.assert(
      fc.property(arbMixedTemplate(), ({ template }) => {
        const result = extractTemplateExpressions(template);

        // The core property: for EVERY extracted expression, the slice at startOffset
        // with length content.length must equal the content itself
        for (const expr of result) {
          expect(template.slice(expr.startOffset, expr.startOffset + expr.content.length)).toBe(
            expr.content
          );
        }

        // Should extract all 4 types of expressions
        const types = new Set(result.map((e) => e.type));
        expect(types.has('interpolation')).toBe(true);
        expect(types.has('event')).toBe(true);
        expect(types.has('bind')).toBe(true);
        expect(types.has('model')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
