import { describe, it, expect } from 'vitest';
import { extractTemplateExpressions } from './templateExpressionParser';

describe('templateExpressionParser - extractTemplateExpressions', () => {
  describe('interpolations', () => {
    it('extracts a simple interpolation', () => {
      const template = '<p>{{name}}</p>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('interpolation');
      expect(result[0].content).toBe('name');
      expect(result[0].startOffset).toBe(5); // position of {{ (3) + 2
      expect(template.slice(result[0].startOffset, result[0].startOffset + result[0].content.length)).toBe('name');
    });

    it('extracts multiple interpolations', () => {
      const template = '<span>{{first}}</span><span>{{second}}</span>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('first');
      expect(result[1].content).toBe('second');
      // Verify offsets
      expect(template.slice(result[0].startOffset, result[0].startOffset + result[0].content.length)).toBe('first');
      expect(template.slice(result[1].startOffset, result[1].startOffset + result[1].content.length)).toBe('second');
    });

    it('extracts interpolation with complex expression', () => {
      const template = '<span>{{a + b * 2}}</span>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('a + b * 2');
      expect(template.slice(result[0].startOffset, result[0].startOffset + result[0].content.length)).toBe('a + b * 2');
    });

    it('filters empty interpolations', () => {
      const template = '<p>{{}}</p><p>{{name}}</p>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('name');
    });

    it('filters whitespace-only interpolations', () => {
      const template = '<p>{{   }}</p>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(0);
    });
  });

  describe('event directives', () => {
    it('extracts @click event', () => {
      const template = '<button @click="handleClick">Go</button>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('event');
      expect(result[0].content).toBe('handleClick');
      expect(result[0].attributeName).toBe('click');
      expect(template.slice(result[0].startOffset, result[0].startOffset + result[0].content.length)).toBe('handleClick');
    });

    it('extracts @input event with dotted name', () => {
      const template = '<input @input.prevent="onInput">';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('event');
      expect(result[0].content).toBe('onInput');
      expect(result[0].attributeName).toBe('input.prevent');
    });

    it('filters empty event values', () => {
      const template = '<button @click="">Go</button>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(0);
    });
  });

  describe('attribute bindings', () => {
    it('extracts :class binding', () => {
      const template = '<div :class="activeClass">Hi</div>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('bind');
      expect(result[0].content).toBe('activeClass');
      expect(result[0].attributeName).toBe('class');
      expect(template.slice(result[0].startOffset, result[0].startOffset + result[0].content.length)).toBe('activeClass');
    });

    it('extracts :class with object expression', () => {
      const template = `<div :class="{ active: isActive, pending: isPending }">Hi</div>`;
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('{ active: isActive, pending: isPending }');
      expect(template.slice(result[0].startOffset, result[0].startOffset + result[0].content.length)).toBe(result[0].content);
    });

    it('extracts :key and :data-id bindings', () => {
      const template = '<li :key="item.id" :data-id="item.id">text</li>';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(2);
      expect(result[0].attributeName).toBe('key');
      expect(result[0].content).toBe('item.id');
      expect(result[1].attributeName).toBe('data-id');
      expect(result[1].content).toBe('item.id');
    });
  });

  describe('model bindings', () => {
    it('extracts model="variable"', () => {
      const template = '<input type="text" model="name">';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('model');
      expect(result[0].content).toBe('name');
      expect(result[0].attributeName).toBe('model');
      expect(template.slice(result[0].startOffset, result[0].startOffset + result[0].content.length)).toBe('name');
    });

    it('does not match :model as a model binding (it is a bind)', () => {
      const template = '<input :model="expr">';
      const result = extractTemplateExpressions(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('bind');
      expect(result[0].attributeName).toBe('model');
    });
  });

  describe('nested expressions in control directives', () => {
    it('extracts expressions inside each loops', () => {
      const template = `<ul>
  <li each="(item, index) in items" :key="item.id">
    <span>{{item.name}}</span>
  </li>
</ul>`;
      const result = extractTemplateExpressions(template);

      // Should find: :key="item.id" and {{item.name}}
      const interpolations = result.filter(e => e.type === 'interpolation');
      const bindings = result.filter(e => e.type === 'bind');

      expect(interpolations).toHaveLength(1);
      expect(interpolations[0].content).toBe('item.name');
      expect(bindings).toHaveLength(1);
      expect(bindings[0].content).toBe('item.id');

      // Verify offsets
      expect(template.slice(interpolations[0].startOffset, interpolations[0].startOffset + interpolations[0].content.length)).toBe('item.name');
      expect(template.slice(bindings[0].startOffset, bindings[0].startOffset + bindings[0].content.length)).toBe('item.id');
    });

    it('extracts expressions inside if/else-if blocks', () => {
      const template = `<div if="status === 'active'">
  <span>{{name}}</span>
</div>
<div else-if="status === 'pending'">
  <button @click="activate">Go</button>
</div>`;
      const result = extractTemplateExpressions(template);

      const interpolations = result.filter(e => e.type === 'interpolation');
      const events = result.filter(e => e.type === 'event');

      expect(interpolations).toHaveLength(1);
      expect(interpolations[0].content).toBe('name');
      expect(events).toHaveLength(1);
      expect(events[0].content).toBe('activate');
    });
  });

  describe('offset correctness', () => {
    it('all extracted expressions have correct offsets (slice verification)', () => {
      const template = `<div class="conditional-demo">
  <h2>Status: {{status}}</h2>
  <div :class="{ active: isActive }" :style="{ color: textColor }">
    <span>{{status}}</span>
  </div>
  <input model="name">
  <button @click="cycle">Cycle</button>
</div>`;

      const result = extractTemplateExpressions(template);

      for (const expr of result) {
        const sliced = template.slice(expr.startOffset, expr.startOffset + expr.content.length);
        expect(sliced).toBe(expr.content);
      }
    });
  });
});
