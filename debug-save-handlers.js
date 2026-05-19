import { compile } from './lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-save-code');

try {
  mkdirSync(tmpDir, { recursive: true });
  
  const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-handlers' })

const categories = signal([
  { id: 1, name: 'Cat1', expanded: false, items: [{ id: 1, name: 'Item1' }] }
])

function toggleCategory(id) {
  console.log('Toggling', id)
}
</script>

<template>
<div each="category in categories()" key={{ category.id }}>
  <div @click={{ () => toggleCategory(category.id) }}>
    {{ category.name }}
  </div>
  
  <div if={{ category.expanded }}>
    <div each="item in category.items" key={{ item.id }}>
      {{ item.name }}
    </div>
  </div>
</div>
</template>`;

  writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
  const { code } = await compile(join(tmpDir, 'component.wcc'));

  writeFileSync('handlers-generated-code.js', code);
  console.log('Code saved to handlers-generated-code.js');
  
  // Find and print lines with addEventListener
  const lines = code.split('\n');
  console.log('\nLines containing addEventListener:');
  lines.forEach((line, idx) => {
    if (line.includes('addEventListener')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });

} catch (error) {
  console.error('Error:', error.message);
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
