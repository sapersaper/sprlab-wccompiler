import { describe, it, expect } from 'vitest';
import { generateUpdateOp } from '../../../lib/codegen/update-op.js';

function lines(entry) {
  const result = [];
  generateUpdateOp(entry, result, '');
  return result;
}

function join(entry) {
  return lines(entry).join('\n');
}

describe('generateUpdateOp', () => {
  describe('text type', () => {
    it('generates textContent for plain binding', () => {
      expect(join({ type: 'text', varName: '__t0', expr: 'this._state.name' }))
        .toMatch(/__t0\.textContent/);
    });

    it('generates textContent inside if-block', () => {
      const out = join({ type: 'text', ifPathExpr: '__if0_current.childNodes[0]', ifBlockIndex: 0, varName: '__t0', expr: 'this._state.name' });
      expect(out).toMatch(/if \(this\.__if0_current\)/);
      expect(out).toMatch(/textContent/);
    });

    it('generates textContent inside each-loop', () => {
      const out = join({ type: 'text', eachBlockIndex: 0, path: [], varName: '__t0', expr: 'this._state.name' });
      expect(out).toMatch(/for \(let __i/);
      expect(out).toMatch(/textContent/);
    });
  });

  describe('show type', () => {
    it('generates style.display', () => {
      expect(join({ type: 'show', varName: '__s0', expr: 'this._state.v' }))
        .toMatch(/style\.display/);
    });

    it('generates style.display inside if-block', () => {
      expect(join({ type: 'show', ifPathExpr: '__if0_current', ifBlockIndex: 0, varName: '__s0', expr: 'this._state.v' }))
        .toMatch(/if \(this\.__if0_current\)/);
    });

    it('generates style.display inside each-loop', () => {
      expect(join({ type: 'show', eachBlockIndex: 0, path: [], varName: '__s0', expr: 'this._state.v' }))
        .toMatch(/for \(let __i/);
    });
  });

  describe('showEach type', () => {
    it('generates showEach loop', () => {
      expect(join({ type: 'showEach', eachBlockIndex: 0, depKey: 'items', expr: 'this._state.v' }))
        .toMatch(/for \(const __el/);
    });
  });

  describe('attr type', () => {
    it('generates setAttribute/removeAttribute', () => {
      expect(join({ type: 'attr', varName: '__a0', expr: 'this._state.url', attr: 'href' }))
        .toMatch(/setAttribute/);
    });

    it('generates attr inside each-loop', () => {
      expect(join({ type: 'attr', eachBlockIndex: 0, path: [], varName: '__a0', expr: 'this._state.url', attr: 'href' }))
        .toMatch(/for \(let __i/);
    });
  });

  describe('bool type', () => {
    it('generates boolean property assignment', () => {
      expect(join({ type: 'bool', varName: '__b0', expr: 'this._state.disabled', attr: 'disabled' }))
        .toMatch(/\.disabled = !!/);
    });

    it('generates bool inside each-loop', () => {
      expect(join({ type: 'bool', eachBlockIndex: 0, path: [], varName: '__b0', expr: 'this._state.disabled', attr: 'disabled' }))
        .toMatch(/for \(let __i/);
    });

    it('generates bool inside if-block', () => {
      expect(join({ type: 'bool', ifPathExpr: '__if0_current', ifBlockIndex: 0, varName: '__b0', expr: 'this._state.disabled', attr: 'disabled' }))
        .toMatch(/if \(this\.__if0_current\)/);
    });
  });

  describe('class type', () => {
    it('generates classList.add/remove for object subkind', () => {
      expect(join({ type: 'class', subKind: 'object', varName: '__c0', expr: '{ active: true }' }))
        .toMatch(/classList\.add/);
    });

    it('generates classList for object inside each-loop', () => {
      expect(join({ type: 'class', subKind: 'object', eachBlockIndex: 0, path: [], varName: '__c0', expr: '{ active: true }' }))
        .toMatch(/for \(let __i/);
    });

    it('generates classList for object inside if-block', () => {
      expect(join({ type: 'class', subKind: 'object', ifPathExpr: '__if0_current', ifBlockIndex: 0, varName: '__c0', expr: '{ active: true }' }))
        .toMatch(/if \(this\.__if0_current\)/);
    });

    it('generates className for array subkind', () => {
      expect(join({ type: 'class', subKind: 'array', varName: '__c0', expr: '["a"]' }))
        .toMatch(/\.className =/);
    });

    it('generates className for array inside each-loop', () => {
      expect(join({ type: 'class', subKind: 'array', eachBlockIndex: 0, path: [], varName: '__c0', expr: '["a"]' }))
        .toMatch(/for \(let __i/);
    });

    it('generates className for string subkind', () => {
      expect(join({ type: 'class', subKind: 'string', varName: '__c0', expr: 'this._state.cls' }))
        .toMatch(/\.className =/);
    });

    it('generates className for string inside if-block', () => {
      expect(join({ type: 'class', subKind: 'string', ifPathExpr: '__if0_current', ifBlockIndex: 0, varName: '__c0', expr: 'this._state.cls' }))
        .toMatch(/if \(this\.__if0_current\)/);
    });

    it('generates className for string inside each-loop', () => {
      expect(join({ type: 'class', subKind: 'string', eachBlockIndex: 0, path: [], varName: '__c0', expr: 'this._state.cls' }))
        .toMatch(/for \(let __i/);
    });
  });

  describe('style type', () => {
    it('generates style[prop] for object subkind', () => {
      expect(join({ type: 'style', subKind: 'object', varName: '__s0', expr: '{ color: "red" }' }))
        .toMatch(/style\[/);
    });

    it('generates style[prop] for object inside each-loop', () => {
      expect(join({ type: 'style', subKind: 'object', eachBlockIndex: 0, path: [], varName: '__s0', expr: '{ color: "red" }' }))
        .toMatch(/for \(let __i/);
    });

    it('generates cssText for string subkind', () => {
      expect(join({ type: 'style', subKind: 'string', varName: '__s0', expr: '"color: red"' }))
        .toMatch(/style\.cssText =/);
    });

    it('generates cssText inside if-block', () => {
      expect(join({ type: 'style', subKind: 'string', ifPathExpr: '__if0_current', ifBlockIndex: 0, varName: '__s0', expr: '"color: red"' }))
        .toMatch(/if \(this\.__if0_current\)/);
    });

    it('generates cssText inside each-loop', () => {
      expect(join({ type: 'style', subKind: 'string', eachBlockIndex: 0, path: [], varName: '__s0', expr: '"color: red"' }))
        .toMatch(/for \(let __i/);
    });
  });

  describe('model types', () => {
    it('generates modelValue', () => {
      expect(join({ type: 'modelValue', varName: '__m0', signal: 'name' }))
        .toMatch(/\.value = .*_state\.name/);
    });

    it('generates modelCheckbox', () => {
      const out = join({ type: 'modelCheckbox', varName: '__m0', signal: 'agreed' });
      expect(out).toContain('.checked');
      expect(out).toContain('_state.agreed');
    });

    it('generates modelRadio', () => {
      expect(join({ type: 'modelRadio', varName: '__m0', signal: 'color', radioValue: 'red' }))
        .toMatch(/\.checked = \(.*_state\.color/);
    });

    it('generates modelProp', () => {
      expect(join({ type: 'modelProp', varName: '__m0', signal: 'count', attr: 'count' }))
        .toMatch(/setAttribute/);
    });
  });

  describe('childProp type', () => {
    it('generates child prop setAttribute guarded by existence check', () => {
      expect(join({ type: 'childProp', varName: '__c0', expr: 'this._state.label', attr: 'label' }))
        .toMatch(/if \(this\.__c0\)/);
    });
  });
});
