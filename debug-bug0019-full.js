import { compile } from './lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-debug-bug0019-full');

try {
  mkdirSync(tmpDir, { recursive: true });
  
  const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-bug0019' })

const categories = signal([
  {
    id: 1,
    name: 'Electronics',
    expanded: false,
    items: [
      { id: 1, name: 'Laptop' },
      { id: 2, name: 'Phone' }
    ]
  }
])
</script>

<template>
<div each="category in categories()" key={{ category.id }}>
  <div>{{ category.name }}</div>
  
  <div if={{ category.expanded }} class="items-container">
    <div each="item in category.items" key={{ item.id }}>
      {{ item.name }}
    </div>
  </div>
</div>
</template>`;

  writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
  const { code } = await compile(join(tmpDir, 'component.wcc'));

  // Write full code to file for inspection
  writeFileSync('BUG0019-generated-code.js', code);
  console.log('Full generated code written to BUG0019-generated-code.js');
  
  // Extract just the outer loop section
  const startIdx = code.indexOf('categories().forEach');
  if (startIdx !== -1) {
    // Find matching closing brace
    let braceCount = 0;
    let endIdx = startIdx;
    let started = false;
    
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        started = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    
    const outerLoopCode = code.substring(startIdx, endIdx);
    console.log('\n=== OUTER LOOP CODE ===\n');
    console.log(outerLoopCode);
  }

} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
