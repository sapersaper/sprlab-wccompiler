import { describe, it, expect } from 'vitest';
import { normalizeTemplate } from './template-normalizer.js';

describe('normalizeTemplate with importMap', () => {
  describe('PascalCase tag resolved via importMap', () => {
    it('converts a PascalCase tag to its mapped kebab-case form', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<WccBadge></WccBadge>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<wcc-badge></wcc-badge>');
    });

    it('converts PascalCase tag with attributes', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<WccBadge label="hi" count="3"></WccBadge>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<wcc-badge label="hi" count="3"></wcc-badge>');
    });

    it('resolves multiple different PascalCase tags in the same template', () => {
      const importMap = new Map([
        ['WccBadge', 'wcc-badge'],
        ['MyButton', 'my-button'],
      ]);
      const result = normalizeTemplate('<WccBadge></WccBadge><MyButton></MyButton>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<wcc-badge></wcc-badge><my-button></my-button>');
    });

    it('uses exact case-sensitive matching against importMap keys', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      // Exact match works
      const result = normalizeTemplate('<WccBadge></WccBadge>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<wcc-badge></wcc-badge>');
    });
  });

  describe('PascalCase tag throws UNRESOLVED_COMPONENT when not in importMap', () => {
    it('throws for a PascalCase tag not present in the importMap', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      expect(() => {
        normalizeTemplate('<UnknownThing></UnknownThing>', { importMap, fileName: 'test.wcc' });
      }).toThrow();
    });

    it('throws with error code UNRESOLVED_COMPONENT', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      try {
        normalizeTemplate('<MissingComp></MissingComp>', { importMap, fileName: 'test.wcc' });
      } catch (err) {
        expect(err.code).toBe('UNRESOLVED_COMPONENT');
      }
    });

    it('throws even when other tags in the template are valid', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      expect(() => {
        normalizeTemplate('<WccBadge></WccBadge><UnknownTag></UnknownTag>', { importMap, fileName: 'test.wcc' });
      }).toThrow();
    });
  });

  describe('hyphenated tags pass through unchanged', () => {
    it('does not modify hyphenated tags when importMap is provided', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<my-element></my-element>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<my-element></my-element>');
    });

    it('passes through hyphenated tags with attributes unchanged', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<custom-input type="text" value="hello"></custom-input>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<custom-input type="text" value="hello"></custom-input>');
    });

    it('does not throw for hyphenated tags not in importMap', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      expect(() => {
        normalizeTemplate('<unknown-element></unknown-element>', { importMap, fileName: 'test.wcc' });
      }).not.toThrow();
    });
  });

  describe('self-closing expansion with importMap', () => {
    it('expands self-closing PascalCase tag to open+close pair with kebab-case', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<WccBadge />', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<wcc-badge></wcc-badge>');
    });

    it('expands self-closing PascalCase tag with attributes', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<WccBadge label="hi" />', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<wcc-badge label="hi"></wcc-badge>');
    });

    it('produces identical output for self-closing and open+close forms', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const selfClosing = normalizeTemplate('<WccBadge label="hi" />', { importMap, fileName: 'test.wcc' });
      const openClose = normalizeTemplate('<WccBadge label="hi"></WccBadge>', { importMap, fileName: 'test.wcc' });
      expect(selfClosing).toBe(openClose);
    });

    it('expands self-closing hyphenated tags', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<my-element />', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<my-element></my-element>');
    });
  });

  describe('error message contains tag name and file path', () => {
    it('includes the unresolved tag name in the error message', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      try {
        normalizeTemplate('<MissingWidget></MissingWidget>', { importMap, fileName: 'my-component.wcc' });
      } catch (err) {
        expect(err.message).toContain('MissingWidget');
      }
    });

    it('includes the file path in the error message', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      try {
        normalizeTemplate('<UnknownComp></UnknownComp>', { importMap, fileName: 'src/my-component.wcc' });
      } catch (err) {
        expect(err.message).toContain('src/my-component.wcc');
      }
    });

    it('uses "unknown" when fileName is not provided', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      try {
        normalizeTemplate('<MissingTag></MissingTag>', { importMap });
      } catch (err) {
        expect(err.message).toContain('unknown');
      }
    });

    it('matches the expected error format', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      try {
        normalizeTemplate('<FancyCard></FancyCard>', { importMap, fileName: 'profile.wcc' });
      } catch (err) {
        expect(err.message).toBe("Unresolved component '<FancyCard>' in 'profile.wcc'. Did you forget to import it?");
      }
    });
  });

  describe('backward compatibility (no importMap)', () => {
    it('converts all PascalCase tags to kebab-case when no importMap is provided', () => {
      const result = normalizeTemplate('<WccBadge></WccBadge>');
      expect(result).toBe('<wcc-badge></wcc-badge>');
    });

    it('expands self-closing tags when no importMap is provided', () => {
      const result = normalizeTemplate('<WccBadge />');
      expect(result).toBe('<wcc-badge></wcc-badge>');
    });
  });
});
