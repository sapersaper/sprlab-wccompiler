import { describe, it, expect } from 'vitest';
import { validateNameCollisions } from '../../../lib/parser-extractors.js';
import {
  validateDuplicateProps,
  validatePropsConflicts,
  validateEmitsAssignment,
  validateDuplicateEmits,
  validateEmitsConflicts,
  validateUndeclaredEmits,
} from '../../../lib/parser/validators.js';

const fileName = 'test.wcc';

describe('validateDuplicateProps', () => {
  it('passes with unique prop names', () => {
    expect(() => validateDuplicateProps(['a', 'b'], fileName)).not.toThrow();
  });

  it('throws DUPLICATE_PROPS on duplicate names', () => {
    try {
      validateDuplicateProps(['a', 'b', 'a'], fileName);
    } catch (e) {
      expect(e.code).toBe('DUPLICATE_PROPS');
      expect(e.message).toContain(fileName);
    }
  });
});

describe('validatePropsConflicts', () => {
  it('returns early when propsObjectName is null', () => {
    expect(() => validatePropsConflicts(null, new Set(), new Set(), new Set(), fileName)).not.toThrow();
  });

  it('throws PROPS_OBJECT_CONFLICT on signal name collision', () => {
    try {
      validatePropsConflicts('count', new Set(['count']), new Set(), new Set(), fileName);
    } catch (e) {
      expect(e.code).toBe('PROPS_OBJECT_CONFLICT');
    }
  });

  it('throws on computed name collision', () => {
    try {
      validatePropsConflicts('total', new Set(), new Set(['total']), new Set(), fileName);
    } catch (e) {
      expect(e.code).toBe('PROPS_OBJECT_CONFLICT');
    }
  });

  it('throws on constant name collision', () => {
    try {
      validatePropsConflicts('MAX', new Set(), new Set(), new Set(['MAX']), fileName);
    } catch (e) {
      expect(e.code).toBe('PROPS_OBJECT_CONFLICT');
    }
  });

  it('passes with no collision', () => {
    expect(() => validatePropsConflicts('props', new Set(['count']), new Set(['total']), new Set(['MAX']), fileName)).not.toThrow();
  });
});

describe('validateEmitsAssignment', () => {
  it('passes when defineEmits is assigned', () => {
    const src = "const emit = defineEmits(['click'])";
    expect(() => validateEmitsAssignment(src, fileName)).not.toThrow();
  });

  it('passes when defineEmits with generic is assigned', () => {
    const src = 'const emit = defineEmits<{ (e: "change", v: number): void }>()';
    expect(() => validateEmitsAssignment(src, fileName)).not.toThrow();
  });

  it('returns early when no defineEmits present', () => {
    expect(() => validateEmitsAssignment('const x = 1', fileName)).not.toThrow();
  });

  it('throws EMITS_ASSIGNMENT_REQUIRED on bare defineEmits', () => {
    const src = "defineEmits(['click'])";
    try {
      validateEmitsAssignment(src, fileName);
    } catch (e) {
      expect(e.code).toBe('EMITS_ASSIGNMENT_REQUIRED');
      expect(e.message).toContain(fileName);
    }
  });
});

describe('validateDuplicateEmits', () => {
  it('passes with unique emit names', () => {
    expect(() => validateDuplicateEmits(['click', 'change'], fileName)).not.toThrow();
  });

  it('throws DUPLICATE_EMITS on duplicate names', () => {
    try {
      validateDuplicateEmits(['input', 'change', 'input'], fileName);
    } catch (e) {
      expect(e.code).toBe('DUPLICATE_EMITS');
      expect(e.message).toContain(fileName);
    }
  });
});

describe('validateEmitsConflicts', () => {
  it('returns early when emitsObjectName is null', () => {
    expect(() => validateEmitsConflicts(null, new Set(), new Set(), new Set(), new Set(), null, fileName)).not.toThrow();
  });

  it('throws EMITS_OBJECT_CONFLICT on signal collision', () => {
    try {
      validateEmitsConflicts('emit', new Set(['emit']), new Set(), new Set(), new Set(), null, fileName);
    } catch (e) {
      expect(e.code).toBe('EMITS_OBJECT_CONFLICT');
    }
  });

  it('throws on propsObjectName collision', () => {
    try {
      validateEmitsConflicts('p', new Set(), new Set(), new Set(), new Set(), 'p', fileName);
    } catch (e) {
      expect(e.code).toBe('EMITS_OBJECT_CONFLICT');
    }
  });

  it('passes with no collision', () => {
    expect(() => validateEmitsConflicts('emit', new Set(['c']), new Set(['d']), new Set(), new Set(['p']), 'p', fileName)).not.toThrow();
  });
});

describe('validateUndeclaredEmits', () => {
  it('returns early when emitsObjectName is null', () => {
    expect(() => validateUndeclaredEmits('', null, [], fileName)).not.toThrow();
  });

  it('returns early when emits list is empty', () => {
    expect(() => validateUndeclaredEmits('', 'emit', [], fileName)).not.toThrow();
  });

  it('passes when all emit calls use declared events', () => {
    const src = "emit('click', 1)\nemit('change', 'val')";
    expect(() => validateUndeclaredEmits(src, 'emit', ['click', 'change'], fileName)).not.toThrow();
  });

  it('throws UNDECLARED_EMIT on undeclared event call', () => {
    const src = "emit('unknown', 1)";
    try {
      validateUndeclaredEmits(src, 'emit', ['click'], fileName);
    } catch (e) {
      expect(e.code).toBe('UNDECLARED_EMIT');
      expect(e.message).toContain(fileName);
    }
  });
});

describe('validateNameCollisions', () => {
  it('passes with unique names', () => {
    expect(() => validateNameCollisions(
      new Set(['count']), new Set(['total']), new Set(['label']),
      [{ name: 'inc', params: '', body: '' }], fileName
    )).not.toThrow();
  });

  it('passes with empty sets', () => {
    expect(() => validateNameCollisions(new Set(), new Set(), new Set(), [], fileName)).not.toThrow();
  });

  it('throws on signal vs computed collision', () => {
    expect(() => validateNameCollisions(
      new Set(['x']), new Set(['x']), new Set(), [], fileName
    )).toThrow(/collision/);
  });

  it('throws on signal vs function collision', () => {
    expect(() => validateNameCollisions(
      new Set(['data']), new Set(), new Set(),
      [{ name: 'data', params: '', body: '' }], fileName
    )).toThrow(/Name collision/);
  });

  it('throws on computed vs function collision', () => {
    expect(() => validateNameCollisions(
      new Set(), new Set(['data']), new Set(),
      [{ name: 'data', params: '', body: '' }], fileName
    )).toThrow(/Name collision/);
  });

  it('throws on prop vs function collision', () => {
    expect(() => validateNameCollisions(
      new Set(), new Set(), new Set(['title']),
      [{ name: 'title', params: '', body: '' }], fileName
    )).toThrow(/Name collision/);
  });

  it('throws on duplicate method names', () => {
    expect(() => validateNameCollisions(
      new Set(), new Set(), new Set(),
      [{ name: 'dup', params: '', body: '' }, { name: 'dup', params: '', body: '' }], fileName
    )).toThrow(/Duplicate function/);
  });
});
