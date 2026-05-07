/**
 * Exact reproduction of QA's watch(() => props.x) bug report.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { compile } from './compiler.js';

describe('QA reproduction: watch(() => props.value) not compiled', () => {
  it('generates watcher effect for getter over prop (exact QA source)', async () => {
    const dir = join(tmpdir(), 'wcc-repro-' + Date.now());
    mkdirSync(dir, { recursive: true });

    // Exact source from QA report
    const sfc = `<script>
import { defineComponent, defineProps, defineEmits, signal, watch } from 'wcc'

export default defineComponent({
  tag: 'wcc-input-test',
})

const props = defineProps({ value: '' })
const emit = defineEmits(['input', 'change'])

const internal = signal('')

// THIS WATCH DOESN'T COMPILE:
watch(() => props.value, (newVal) => {
  internal.set(newVal)
})

watch(internal, (newVal, oldVal) => {
  emit('input', newVal)
  emit('change', newVal)
})
</script>

<template>
<div class="input-test">
  <label>WCC Input:</label>
  <input type="text" model="internal" placeholder="Type here...">
  <p class="preview">Internal value: "{{internal()}}"</p>
</div>
</template>
`;

    writeFileSync(join(dir, 'wcc-input-test.wcc'), sfc);
    const { code } = await compile(join(dir, 'wcc-input-test.wcc'));

    console.log('=== FULL OUTPUT ===');
    console.log(code);
    console.log('=== END ===');

    // Should have TWO watcher effects
    const watcherMatches = code.match(/__prev_watch/g) || [];
    const prevInternalMatches = code.match(/__prev_internal/g) || [];
    
    console.log('__prev_watch occurrences:', watcherMatches.length);
    console.log('__prev_internal occurrences:', prevInternalMatches.length);

    // The getter watcher should generate __prev_watch0
    expect(code).toContain('__prev_watch0');
    // And should read _s_value()
    expect(code).toContain('this._s_value()');
    // The direct signal watcher should generate __prev_internal
    expect(code).toContain('__prev_internal');

    rmSync(dir, { recursive: true, force: true });
  });
});
