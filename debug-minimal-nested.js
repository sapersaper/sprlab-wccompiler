import { compile } from './lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-minimal-nested');

try {
  mkdirSync(tmpDir, { recursive: true });
  
  // Minimal case: just outer loop + conditional + inner loop, NO events
  const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-minimal' })

const data = signal([
  { show: true, items: ['a', 'b'] },
  { show: false, items: ['c', 'd'] }
])
</script>

<template>
<div each="item in data()" key={{ item }}>
  <div if={{ item.show }}>
    <div each="sub in item.items">
      {{ sub }}
    </div>
  </div>
</div>
</template>`;

  writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
  const { code } = await compile(join(tmpDir, 'component.wcc'));

  console.log('=== MINIMAL NESTED LOOP CODE ===\n');
  console.log(code);
  
  // Write to file for easier inspection
  writeFileSync('minimal-nested-code.js', code);
  console.log('\n\nCode written to minimal-nested-code.js');

} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
