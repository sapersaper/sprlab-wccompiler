import { compile } from './lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-debug-handlers');

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

  console.log('=== EVENT HANDLER ANALYSIS ===\n');
  
  // Find all addEventListener calls
  const listenerMatches = [...code.matchAll(/\.addEventListener\('[^']+',\s*([^)]+)\)/g)];
  console.log(`Total addEventListener calls: ${listenerMatches.length}\n`);
  
  listenerMatches.forEach((match, idx) => {
    console.log(`Handler #${idx + 1}:`);
    console.log(`  Full match: ${match[0]}`);
    console.log(`  Handler expression: ${match[1]}`);
    
    // Check if it uses .bind()
    if (match[1].includes('.bind(')) {
      console.log('  ⚠️  WARNING: Uses .bind() - may fail if method is undefined');
      
      // Extract what's being bound
      const bindMatch = match[1].match(/(.+)\.bind\(/);
      if (bindMatch) {
        console.log(`  Binding: ${bindMatch[1]}`);
        console.log(`  This could be undefined if the method doesn't exist`);
      }
    }
    
    // Check if it references toggleCategory
    if (match[1].includes('toggleCategory')) {
      console.log('  ℹ️  References toggleCategory');
    }
    
    console.log();
  });
  
  // Check if toggleCategory method exists in class
  const hasToggleMethod = code.includes('_toggleCategory(') || code.includes('toggleCategory(');
  console.log(`\nDoes generated code contain toggleCategory method? ${hasToggleMethod ? 'YES' : 'NO'}`);
  
  if (!hasToggleMethod) {
    console.log('⚠️  CRITICAL: Method toggleCategory is NOT defined in the class!');
    console.log('   Event handlers will fail with "Cannot read properties of undefined"');
  }
  
  // Show method definitions
  const methodDefs = [...code.matchAll(/^\s+_(\w+)\s*\(/gm)];
  console.log(`\nMethods defined in class (${methodDefs.length}):`);
  methodDefs.forEach(match => {
    console.log(`  - _${match[1]}`);
  });

} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
