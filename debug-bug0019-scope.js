import { compile } from './lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-debug-bug0019');

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

  console.log('=== GENERATED CODE ANALYSIS ===\n');
  
  // Find the outer loop section
  const outerLoopMatch = code.match(/categories\(\)\.forEach\([^)]+\) \{[\s\S]*?\}\);/);
  if (outerLoopMatch) {
    console.log('OUTER LOOP STRUCTURE:\n');
    console.log(outerLoopMatch[0]);
    console.log('\n---\n');
  }
  
  // Check for conditional block
  const conditionalMatch = code.match(/if \(category\.expanded\) \{[\s\S]*?__if0_branch = 0;[\s\S]*?\}/);
  if (conditionalMatch) {
    console.log('CONDITIONAL CHECK:\n');
    console.log(conditionalMatch[0]);
    console.log('\n---\n');
  }
  
  // Check for inner loop
  const innerLoopMatch = code.match(/category\.items\.forEach\([^)]+\) \{[\s\S]*?\}\);/);
  if (innerLoopMatch) {
    console.log('INNER LOOP:\n');
    console.log(innerLoopMatch[0]);
    console.log('\n---\n');
  }
  
  // Check anchor usage
  const anchorMatches = code.matchAll(/__for\d+_anchor\s*=/g);
  console.log('ANCHOR ASSIGNMENTS:');
  for (const match of anchorMatches) {
    const lineStart = code.lastIndexOf('\n', match.index) + 1;
    const lineEnd = code.indexOf('\n', match.index);
    console.log('  ', code.substring(lineStart, lineEnd).trim());
  }
  console.log('\n---\n');
  
  // Show execution order
  console.log('EXECUTION FLOW ANALYSIS:\n');
  
  const lines = code.split('\n');
  let inOuterLoop = false;
  let braceCount = 0;
  let step = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('categories().forEach')) {
      console.log(`${step}. Outer loop starts`);
      inOuterLoop = true;
      step++;
    }
    
    if (inOuterLoop) {
      if (line.includes('if (category.expanded)')) {
        console.log(`${step}. Conditional check`);
        step++;
      }
      
      if (line.includes('__if0_branch !== null')) {
        console.log(`${step}. Conditional wrapper insertion`);
        step++;
      }
      
      if (line.includes('category.items.forEach')) {
        console.log(`${step}. Inner loop execution`);
        step++;
      }
      
      if (line.includes('__for0_anchor.parentNode')) {
        console.log(`${step}. Inner loop node insertion (USES ANCHOR)`);
        step++;
      }
    }
  }
  
  console.log('\n=== CRITICAL ISSUE ===');
  console.log('If conditional is FALSE:');
  console.log('- __if0_branch stays null');
  console.log('- Conditional wrapper NEVER inserted');
  console.log('- BUT inner loop STILL executes');
  console.log('- Inner loop tries to use anchor that doesn\'t exist');
  console.log('- Result: Cannot read properties of undefined');

} catch (error) {
  console.error('Error:', error.message);
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
