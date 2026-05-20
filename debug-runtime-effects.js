import { compile } from './lib/compiler.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = join(process.cwd(), 'tmp-debug-runtime');

try {
  mkdirSync(tmpDir, { recursive: true });
  
  const sfcContent = `<script>
import { defineComponent, signal } from 'wcc'

export default defineComponent({ tag: 'test-runtime-debug' })

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

function toggleCategory(id) {
  const cat = categories().find(c => c.id === id)
  if (cat) cat.expanded = !cat.expanded
  categories.set([...categories()])
}
</script>

<template>
<div each="category in categories()" key={{ category.id }}>
  <div @click={{ () => toggleCategory(category.id) }}>
    {{ category.name }}
  </div>
  
  <div if={{ category.expanded }} class="items-container">
    <div each="item in category.items" key={{ item.id }}>
      {{ item.name }}
    </div>
  </div>
</div>
</template>`;

  writeFileSync(join(tmpDir, 'component.wcc'), sfcContent);
  const { code } = await compile(join(tmpDir, 'component.wcc'));

  console.log('=== ANALYZING EFFECT CREATION ===\n');
  
  // Find all __effect calls
  const effectMatches = [...code.matchAll(/__effect\(\(\) => \{/g)];
  console.log(`Total __effect calls found: ${effectMatches.length}\n`);
  
  // Extract context around each effect
  effectMatches.forEach((match, idx) => {
    const startIdx = match.index;
    const contextStart = Math.max(0, startIdx - 200);
    const contextEnd = Math.min(code.length, startIdx + 300);
    const context = code.substring(contextStart, contextEnd);
    
    console.log(`--- Effect #${idx + 1} ---`);
    console.log('Context (200 chars before, 300 after):');
    console.log(context);
    console.log('\n');
  });
  
  // Look for nested effect patterns
  console.log('=== CHECKING FOR NESTED EFFECTS ===\n');
  const nestedPattern = /__effect\([^)]*__effect/g;
  const nestedMatches = [...code.matchAll(nestedPattern)];
  console.log(`Nested __effect calls (effect inside effect): ${nestedMatches.length}`);
  
  if (nestedMatches.length > 0) {
    console.log('\nWARNING: Found nested effects! This may cause issues.');
    nestedMatches.forEach((match, idx) => {
      console.log(`\nNested pattern #${idx + 1}:`);
      const startIdx = match.index;
      const context = code.substring(Math.max(0, startIdx - 100), Math.min(code.length, startIdx + 200));
      console.log(context);
    });
  }
  
  // Check for anchor access patterns
  console.log('\n=== CHECKING ANCHOR ACCESS PATTERNS ===\n');
  const anchorPatterns = [
    /__if\d+_node\.childNodes\[\d+\]\.childNodes\[\d+\]/g,
    /__for\d+_anchor\s*=/g
  ];
  
  anchorPatterns.forEach((pattern, pidx) => {
    const matches = [...code.matchAll(pattern)];
    console.log(`Anchor pattern ${pidx + 1}: ${matches.length} occurrences`);
    matches.forEach(match => {
      const lineStart = code.lastIndexOf('\n', match.index) + 1;
      const lineEnd = code.indexOf('\n', match.index);
      console.log('  ', code.substring(lineStart, lineEnd).trim());
    });
  });
  
  // Check for potential undefined access
  console.log('\n=== POTENTIAL ISSUES ===\n');
  
  // Pattern: accessing childNodes on potentially undefined nodes
  const unsafeAccess = /(\w+)\.childNodes\[(\d+)\]\.childNodes\[(\d+)\]/g;
  const unsafeMatches = [...code.matchAll(unsafeAccess)];
  
  console.log(`Unsafe childNodes access patterns: ${unsafeMatches.length}`);
  unsafeMatches.forEach(match => {
    console.log(`  ${match[0]}`);
    console.log(`    Parent node: ${match[1]}[child ${match[2]}]`);
    console.log(`    Accessing: childNodes[${match[3]}]`);
    
    // Check if parent could be undefined
    const parentVar = match[1];
    const parentDefRegex = new RegExp(`const ${parentVar}\\s*=`, 'g');
    const parentDefs = [...code.matchAll(parentDefRegex)];
    
    if (parentDefs.length > 0) {
      console.log(`    Defined at positions: ${parentDefs.map(d => d.index).join(', ')}`);
      
      // Check if definition is inside conditional
      const defIdx = parentDefs[0].index;
      const beforeDef = code.substring(Math.max(0, defIdx - 500), defIdx);
      if (beforeDef.includes('if (__if')) {
        console.log(`    ⚠️  WARNING: ${parentVar} defined INSIDE conditional block`);
        console.log(`       May not exist when effect executes`);
      }
    }
    console.log();
  });

} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
