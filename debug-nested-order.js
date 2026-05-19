import { compile } from './lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-debug-nested-struct');

try {
  mkdirSync(tmpDir, { recursive: true });
  
  const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-debug' })

const categories = signal([
  {
    id: 1,
    name: 'Electronics',
    expanded: true,
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
  
  console.log('=== Generated Code Structure Analysis ===\n');
  
  // Find the connectedCallback section
  const connectedMatch = code.match(/connectedCallback\(\) \{[\s\S]*?disconnectedCallback/s);
  if (connectedMatch) {
    const connectedCode = connectedMatch[0];
    const lines = connectedCode.split('\n');
    
    console.log('Key sections in order:\n');
    
    let lineNum = 0;
    lines.forEach((line, idx) => {
      lineNum++;
      
      // Look for important structural elements
      if (line.includes('categories()') && line.includes('forEach')) {
        console.log(`${lineNum}: OUTER LOOP START`);
        console.log(`   ${line.trim().substring(0, 80)}...`);
      }
      
      if (line.includes('category.expanded')) {
        console.log(`${lineNum}: CONDITIONAL CHECK`);
        console.log(`   ${line.trim().substring(0, 80)}`);
      }
      
      if (line.includes('class="items-container"')) {
        console.log(`${lineNum}: CONTAINER TEMPLATE CREATED`);
        console.log(`   ${line.trim().substring(0, 80)}`);
      }
      
      if (line.includes('category.items') && line.includes('forEach')) {
        console.log(`${lineNum}: INNER LOOP START`);
        console.log(`   ${line.trim().substring(0, 80)}...`);
      }
      
      if (line.includes('insertBefore') && line.includes('__for')) {
        console.log(`${lineNum}: NODE INSERTION`);
        console.log(`   ${line.trim().substring(0, 80)}`);
      }
    });
    
    console.log('\n\n=== Checking Order ===\n');
    
    const outerLoopIdx = connectedCode.indexOf('categories()');
    const conditionalIdx = connectedCode.indexOf('category.expanded');
    const containerIdx = connectedCode.indexOf('items-container');
    const innerLoopIdx = connectedCode.indexOf('category.items');
    
    console.log('Order of execution:');
    console.log(`1. Outer loop: position ${outerLoopIdx}`);
    console.log(`2. Conditional: position ${conditionalIdx}`);
    console.log(`3. Container template: position ${containerIdx}`);
    console.log(`4. Inner loop: position ${innerLoopIdx}`);
    console.log();
    
    if (innerLoopIdx < conditionalIdx) {
      console.log('❌ BUG CONFIRMED: Inner loop executes BEFORE conditional check');
    } else if (conditionalIdx < innerLoopIdx) {
      console.log('✅ CORRECT: Conditional check comes before inner loop');
    }
    
    if (containerIdx < innerLoopIdx) {
      console.log('✅ Container created before inner loop');
    } else {
      console.log('❌ Container created AFTER inner loop - WRONG ORDER');
    }
  }
  
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
