/**
 * Pretty Printer — reconstructs .html source from a ParseResult IR.
 *
 * Produces a valid source file with <template>, <script>, and <style> blocks
 * that preserves the order and semantics of all IR elements.
 */

/**
 * Reconstruct the <template> block from the IR.
 * Uses the original template string (before tree-walking) since it
 * already contains {{var}} bindings, @event attributes, and <slot> elements.
 *
 * @param {import('./parser.js').ParseResult} ir
 * @returns {string}
 */
function reconstructTemplate(ir) {
  return ir.template;
}

/**
 * Reconstruct the <script> block from the IR's extracted constructs.
 *
 * @param {import('./parser.js').ParseResult} ir
 * @returns {string}
 */
function reconstructScript(ir) {
  const lines = [];

  // defineProps
  if (ir.props.length > 0) {
    const propsList = ir.props.map(p => `'${p}'`).join(', ');
    lines.push(`  defineProps([${propsList}])`);
    lines.push('');
  }

  // Reactive variables
  for (const v of ir.reactiveVars) {
    lines.push(`  const ${v.name} = ${v.value}`);
  }
  if (ir.reactiveVars.length > 0) lines.push('');

  // Computed properties
  for (const c of ir.computeds) {
    lines.push(`  const ${c.name} = computed(() => ${c.body})`);
  }
  if (ir.computeds.length > 0) lines.push('');

  // Watchers
  for (const w of ir.watchers) {
    lines.push(`  watch('${w.target}', (${w.newParam}, ${w.oldParam}) => {`);
    // Indent the body lines
    for (const bodyLine of w.body.split('\n')) {
      lines.push(`    ${bodyLine}`);
    }
    lines.push('  })');
  }
  if (ir.watchers.length > 0) lines.push('');

  // Functions
  for (const m of ir.methods) {
    lines.push(`  function ${m.name}(${m.params}) {`);
    for (const bodyLine of m.body.split('\n')) {
      lines.push(`    ${bodyLine}`);
    }
    lines.push('  }');
  }

  return lines.join('\n');
}

/**
 * Pretty-print a ParseResult IR back to .html source format.
 *
 * @param {import('./parser.js').ParseResult} ir - The intermediate representation
 * @returns {string} Reconstructed .html source
 */
export function prettyPrint(ir) {
  const parts = [];

  // <template> block
  parts.push('<template>');
  parts.push(reconstructTemplate(ir));
  parts.push('</template>');

  // <style> block (if present)
  if (ir.style) {
    parts.push('');
    parts.push('<style>');
    parts.push(ir.style);
    parts.push('</style>');
  }

  // <script> block (if there's any script content)
  const scriptContent = reconstructScript(ir);
  if (scriptContent.trim()) {
    parts.push('');
    parts.push('<script>');
    parts.push(scriptContent);
    parts.push('</script>');
  }

  parts.push('');
  return parts.join('\n');
}
