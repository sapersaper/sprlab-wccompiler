import { compile } from './lib/compiler.js';

const result = await compile('test-kitchen-sink-bug0014.wcc');
console.log('=== GENERATED CODE (conditional lines) ===');
const lines = result.code.split('\n');
lines.forEach((line, i) => {
  if (line.includes('if') && (line.includes('items') || line.includes('count') || line.includes('status'))) {
    console.log(`Line ${i}: ${line}`);
  }
});

// Also check for syntax errors
if (result.code.includes('{{')) {
  console.log('\n❌ BUG DETECTED: Raw {{ found in generated code!');
  const linesWithMustache = result.code.split('\n').filter(l => l.includes('{{'));
  linesWithMustache.forEach((line, i) => {
    console.log(`  Line ${i}: ${line.trim()}`);
  });
} else {
  console.log('\n✅ No raw {{ delimiters found');
}
