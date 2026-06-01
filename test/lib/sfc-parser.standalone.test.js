/**
 * Tests for SFC parser after standalone removal: standalone option is just ignored.
 *
 * Feature: zero-runtime
 * Validates that standalone in defineComponent is silently ignored.
 */

import { describe, it, expect } from 'vitest';
import { parseSFC } from '../../lib/sfc-parser.js';

function buildSFC(defineComponentBody) {
  return `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ ${defineComponentBody} })

const x = signal(0)
</script>

<template>
  <span>{{x()}}</span>
</template>
`;
}

describe('SFC Parser — standalone option is silently ignored', () => {
  it('compiles with standalone: true in defineComponent (ignored)', () => {
    const source = buildSFC("tag: 'my-comp', standalone: true");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    // standalone field no longer exists in the descriptor
    expect(descriptor.standalone).toBeUndefined();
    expect(descriptor.tag).toBe('my-comp');
  });

  it('compiles with standalone: false in defineComponent (ignored)', () => {
    const source = buildSFC("tag: 'my-comp', standalone: false");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    expect(descriptor.standalone).toBeUndefined();
    expect(descriptor.tag).toBe('my-comp');
  });

  it('compiles without standalone (ignored)', () => {
    const source = buildSFC("tag: 'my-comp'");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    expect(descriptor.standalone).toBeUndefined();
    expect(descriptor.tag).toBe('my-comp');
  });

  it('invalid standalone value does NOT throw (just ignored)', () => {
    const source = buildSFC("tag: 'my-comp', standalone: 'yes'");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    expect(descriptor.tag).toBe('my-comp');
    expect(descriptor.standalone).toBeUndefined();
  });

  it('standalone: 1 does NOT throw (just ignored)', () => {
    const source = buildSFC("tag: 'my-comp', standalone: 1");
    const descriptor = parseSFC(source, 'my-comp.wcc');
    expect(descriptor.tag).toBe('my-comp');
    expect(descriptor.standalone).toBeUndefined();
  });
});
