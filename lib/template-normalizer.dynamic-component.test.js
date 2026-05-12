import { describe, it, expect } from 'vitest';
import { normalizeTemplate } from './template-normalizer.js';

describe('normalizeTemplate preserves <component> tags', () => {
  describe('<component :is="expr"> passes through unchanged', () => {
    it('preserves <component :is="expr"> without conversion', () => {
      const result = normalizeTemplate('<component :is="expr"></component>');
      expect(result).toBe('<component :is="expr"></component>');
    });

    it('preserves <component :is="currentView()"> with function call expression', () => {
      const result = normalizeTemplate('<component :is="currentView()"></component>');
      expect(result).toBe('<component :is="currentView()"></component>');
    });

    it('preserves <component :is="expr"> when importMap is provided', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<component :is="routeComponent()"></component>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<component :is="routeComponent()"></component>');
    });
  });

  describe('<component :is="expr" :title="t()"> preserves all attributes', () => {
    it('preserves component tag with :is and additional :prop bindings', () => {
      const result = normalizeTemplate('<component :is="expr" :title="t()"></component>');
      expect(result).toBe('<component :is="expr" :title="t()"></component>');
    });

    it('preserves component tag with multiple prop and event bindings', () => {
      const result = normalizeTemplate('<component :is="currentView()" :title="pageTitle()" :data="items()" @navigate="onNavigate"></component>');
      expect(result).toBe('<component :is="currentView()" :title="pageTitle()" :data="items()" @navigate="onNavigate"></component>');
    });

    it('preserves component tag with ternary expression in :is', () => {
      const result = normalizeTemplate('<component :is="isAdmin() ? \'admin-panel\' : \'user-panel\'" :user="currentUser()"></component>');
      expect(result).toBe('<component :is="isAdmin() ? \'admin-panel\' : \'user-panel\'" :user="currentUser()"></component>');
    });
  });

  describe('other PascalCase tags still get converted (regression)', () => {
    it('converts PascalCase tags to kebab-case while preserving <component>', () => {
      const result = normalizeTemplate('<div><component :is="view()"></component><WccBadge></WccBadge></div>');
      expect(result).toBe('<div><component :is="view()"></component><wcc-badge></wcc-badge></div>');
    });

    it('converts PascalCase tags with importMap while preserving <component>', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<component :is="x()"></component><WccBadge></WccBadge>', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<component :is="x()"></component><wcc-badge></wcc-badge>');
    });

    it('expands self-closing PascalCase tags while preserving <component>', () => {
      const importMap = new Map([['WccBadge', 'wcc-badge']]);
      const result = normalizeTemplate('<component :is="view()"></component><WccBadge />', { importMap, fileName: 'test.wcc' });
      expect(result).toBe('<component :is="view()"></component><wcc-badge></wcc-badge>');
    });
  });
});
