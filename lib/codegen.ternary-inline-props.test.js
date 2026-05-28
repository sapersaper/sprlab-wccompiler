/**
 * Test for BUG-0003: Ternarios inline en interpolación evalúan incorrectamente
 *
 * Verifies that ternary expressions using props in text interpolation {{ }}
 * generate correct code that evaluates the signal value (not the signal function reference).
 *
 * Root cause: The codegen used `startsWith(propsObjectName + '.')` to detect simple
 * prop access, but this also matched complex expressions like `props.active ? 'A' : 'B'`.
 * The fix uses a regex to match ONLY simple `props.propName` patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compile } from '../lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('BUG-0003: Ternary inline en interpolación con props', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `wcc-test-bug0003-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should correctly evaluate props.x ternary in text interpolation', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'test-ternary-props',
})

const props = defineProps({
  active: false
})
</script>

<template>
<div>
  <p>{{props.active ? 'Componente ACTIVO' : 'Componente INACTIVO'}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Must call the signal: this._state.active (with parentheses)
    // NOT reference the function: this._state.active (without parentheses, always truthy)
    expect(code).toContain("this._state.active ? 'Componente ACTIVO' : 'Componente INACTIVO'");

    // Must NOT have the buggy pattern (signal reference without call)
    expect(code).not.toMatch(/this\._s_active \?/);

    // Must NOT append () to string literals
    expect(code).not.toMatch(/'Componente INACTIVO'\(\)/);
    expect(code).not.toMatch(/'Componente ACTIVO'\(\)/);
  });

  it('should still handle simple props.x access correctly', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'test-simple-prop',
})

const props = defineProps({
  title: 'Default Title'
})
</script>

<template>
<div>
  <p>{{props.title}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Simple prop access should use the direct signal read pattern
    expect(code).toContain("this._state.title ?? ''");
  });

  it('should handle props ternary with multiple props in condition', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'test-multi-prop-ternary',
})

const props = defineProps({
  count: 0,
  max: 10
})
</script>

<template>
<div>
  <p>{{props.count > props.max ? 'Over limit' : 'Within limit'}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Both props should be called as signals
    expect(code).toContain('this._state.count');
    expect(code).toContain('this._state.max');

    // Should NOT have the buggy pattern
    expect(code).not.toMatch(/this\._s_count > /);
    expect(code).not.toMatch(/this\._s_max \?/);
  });

  it('should handle props ternary with logical operators', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'test-prop-logical',
})

const props = defineProps({
  active: false,
  visible: true
})
</script>

<template>
<div>
  <p>{{props.active && props.visible ? 'Show' : 'Hide'}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Both props should be called as signals
    expect(code).toContain('this._state.active');
    expect(code).toContain('this._state.visible');

    // The expression should be wrapped in parentheses (contains ternary + &&)
    expect(code).toMatch(/\(this\._state\.active && this\._state\.visible \? 'Show' : 'Hide'\)/);
  });

  it('should handle props ternary mixed with signals', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps, signal } from 'wcc'

export default defineComponent({
  tag: 'test-prop-signal-ternary',
})

const props = defineProps({
  active: false
})

const count = signal(0)
</script>

<template>
<div>
  <p>{{props.active ? count() : 'N/A'}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Prop should be called as signal
    expect(code).toContain('this._state.active');
    // Signal should also be called
    expect(code).toContain('this._state.count');

    // Should NOT have the buggy pattern
    expect(code).not.toMatch(/this\._s_active \?/);
  });

  it('should handle props ternary mixed with computed', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps, computed } from 'wcc'

export default defineComponent({
  tag: 'test-prop-computed-ternary',
})

const props = defineProps({
  active: false
})

const statusText = computed(() => props.active ? 'Activo' : 'Inactivo')
</script>

<template>
<div>
  <p>{{props.active ? 'ACTIVO' : 'INACTIVO'}}</p>
  <p>{{statusText()}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Ternary in text interpolation should call the signal
    expect(code).toContain("this._state.active ? 'ACTIVO' : 'INACTIVO'");

    // Computed should use _state access (Phase 2: no __computed runtime)
    expect(code).toContain('this._state.statusText');
  });

  it('should handle props.x in ternary within if-block branches', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps, signal } from 'wcc'

export default defineComponent({
  tag: 'test-prop-ternary-if',
})

const props = defineProps({
  active: false
})

const showDetails = signal(true)
</script>

<template>
<div>
  <div if="showDetails()">
    <p>{{props.active ? 'ON' : 'OFF'}}</p>
  </div>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Even inside if-block branches, the ternary should call the signal
    expect(code).toContain("this._state.active ? 'ON' : 'OFF'");

    // Should NOT have the buggy pattern
    expect(code).not.toMatch(/this\._s_active \? 'ON'/);
  });

  it('should handle props.x equality comparison in ternary', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'test-prop-equality-ternary',
})

const props = defineProps({
  status: 'idle'
})
</script>

<template>
<div>
  <p>{{props.status === 'loading' ? 'Cargando...' : 'Listo'}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should call the signal for comparison
    expect(code).toContain("this._state.status === 'loading'");

    // Should NOT have the buggy pattern
    expect(code).not.toMatch(/this\._s_status ===|this\._s_status ===/);
  });

  it('should handle props.x with negation in ternary', async () => {
    const sfcContent = `<script>
import { defineComponent, defineProps } from 'wcc'

export default defineComponent({
  tag: 'test-prop-negation-ternary',
})

const props = defineProps({
  disabled: false
})
</script>

<template>
<div>
  <p>{{!props.disabled ? 'Enabled' : 'Disabled'}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Should call the signal even with negation
    expect(code).toContain('this._state.disabled');

    // The expression should be wrapped (contains ternary)
    const match = code.match(/textContent = (.+?) \?\? '';/);
    expect(match).not.toBeNull();
    expect(match[1].startsWith('(')).toBe(true);
  });

  it('should not break method calls without parentheses (simple method binding)', async () => {
    const sfcContent = `<script>
import { defineComponent } from 'wcc'

export default defineComponent({
  tag: 'test-method-binding',
})

function getLabel() {
  return 'Hello'
}
</script>

<template>
<div>
  <p>{{getLabel()}}</p>
</div>
</template>`;

    writeFileSync(join(dir, 'component.wcc'), sfcContent);
    const { code } = await compile(join(dir, 'component.wcc'));

    // Method calls should still work
    expect(code).toContain('_getLabel');
  });
});
