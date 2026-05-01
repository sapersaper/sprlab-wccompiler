import { describe, it, expect } from 'vitest';
import { compile } from './compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Helper: create temp component files ─────────────────────────────

function createTempDir() {
  const dir = join(tmpdir(), `wcc-each-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ── Integration Tests ───────────────────────────────────────────────

describe('compiler — each directive integration', () => {
  it('compiles a component with each directive and signal-based source', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'list.html'),
        '<ul><li each="item in items" :key="item.id"><span>{{item.name}}</span> <span>{{count}}</span><button @click="remove">x</button></li></ul>'
      );
      writeFileSync(join(dir, 'list.js'),
        `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-list',
  template: './list.html',
})

const items = signal([])
const count = signal(0)

function remove() {
  // remove logic
}
`
      );

      const output = await compile(join(dir, 'list.js'));

      // Constructor: template element with innerHTML
      expect(output).toContain("this.__for0_tpl = document.createElement('template')");
      expect(output).toContain('this.__for0_tpl.innerHTML');

      // Constructor: anchor reference
      expect(output).toContain('this.__for0_anchor');

      // Constructor: nodes array
      expect(output).toContain('this.__for0_nodes = []');

      // connectedCallback: reactive effect with transformed source
      expect(output).toContain('this._items()');

      // connectedCallback: node removal loop (keyed reconciliation)
      expect(output).toContain('for (const n of __oldMap.values()) n.remove()');

      // connectedCallback: numeric range handling
      expect(output).toContain("typeof __source === 'number'");

      // Static binding: item.name (item-only reference, no __effect wrapper)
      expect(output).toContain("item.name ?? ''");

      // Reactive binding: count (component signal, wrapped in __effect)
      expect(output).toContain('this._count()');

      // Event binding: bound to component instance
      expect(output).toContain("this._remove.bind(this)");

      // Template should not contain each or :key attributes
      expect(output).not.toMatch(/each="/);
      expect(output).not.toMatch(/:key="/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with numeric range source', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'range.html'),
        '<div><span each="n in 5">text</span></div>'
      );
      writeFileSync(join(dir, 'range.js'),
        `import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'wcc-range',
  template: './range.html',
})
`
      );

      const output = await compile(join(dir, 'range.js'));

      // Should contain the for block setup
      expect(output).toContain('__for0_tpl');
      // The source should be the literal 5
      expect(output).toContain('const __source = 5');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with each and show bindings', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'showlist.html'),
        '<ul><li each="item in items"><span show="item.visible">text</span></li></ul>'
      );
      writeFileSync(join(dir, 'showlist.js'),
        `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-show-list',
  template: './showlist.html',
})

const items = signal([])
`
      );

      const output = await compile(join(dir, 'showlist.js'));

      // Should have a for block
      expect(output).toContain('__for0_tpl');
      expect(output).toContain('this._items()');
    } finally {
      cleanupDir(dir);
    }
  });

  it('compiles a component with destructured each expression', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'indexed.html'),
        '<ul><li each="(item, index) in items">{{index}}</li></ul>'
      );
      writeFileSync(join(dir, 'indexed.js'),
        `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-indexed',
  template: './indexed.html',
})

const items = signal([])
`
      );

      const output = await compile(join(dir, 'indexed.js'));

      // Should use both item and index in the forEach
      expect(output).toContain('__iter.forEach((item, index)');
    } finally {
      cleanupDir(dir);
    }
  });

  it('rejects each + if on the same element', async () => {
    const dir = createTempDir();
    try {
      writeFileSync(join(dir, 'conflict.html'),
        '<div><li each="item in items" if="visible">text</li></div>'
      );
      writeFileSync(join(dir, 'conflict.js'),
        `import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: 'wcc-conflict',
  template: './conflict.html',
})

const items = signal([])
const visible = signal(true)
`
      );

      try {
        await compile(join(dir, 'conflict.js'));
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err.code).toBe('CONFLICTING_DIRECTIVES');
      }
    } finally {
      cleanupDir(dir);
    }
  });
});
