/**
 * Pretty Printer — serializes a ParseResult IR back to valid .js source format.
 *
 * Used for round-trip testing: parse → prettyPrint → parse should yield
 * an equivalent IR.
 */

/** @import { ParseResult } from './types.js' */

/**
 * Pretty-print a ParseResult IR back to component source format.
 *
 * @param {ParseResult} ir — The intermediate representation
 * @returns {string} Reconstructed source code
 */
export function prettyPrint(ir) {
  const sections = [];

  // 1. Import statement — include only macros actually used
  const macros = ['defineComponent'];
  if ((ir.propDefs || []).length > 0) macros.push('defineProps');
  if ((ir.emits || []).length > 0) macros.push('defineEmits');
  if (ir.signals.length > 0) macros.push('signal');
  if (ir.computeds.length > 0) macros.push('computed');
  if (ir.effects.length > 0) macros.push('effect');
  if ((ir.onMountHooks || []).length > 0) macros.push('onMount');
  if ((ir.onDestroyHooks || []).length > 0) macros.push('onDestroy');
  sections.push(`import { ${macros.join(', ')} } from 'wcc'`);

  // 2. defineComponent call
  const defParts = [];
  defParts.push(`  tag: '${ir.tagName}',`);
  defParts.push(`  template: './${ir.tagName}.html',`);
  if (ir.style !== '') {
    defParts.push(`  styles: './${ir.tagName}.css',`);
  }
  sections.push(`export default defineComponent({\n${defParts.join('\n')}\n})`);

  // 3. defineProps (if present)
  if ((ir.propDefs || []).length > 0) {
    const propsObjName = ir.propsObjectName || 'props';
    const propEntries = ir.propDefs.map(p => `${p.name}: ${p.default}`);
    sections.push(`const ${propsObjName} = defineProps({ ${propEntries.join(', ')} })`);
  }

  // 3b. defineEmits (if present)
  if ((ir.emits || []).length > 0) {
    const emitsObjName = ir.emitsObjectName || 'emit';
    const emitEntries = ir.emits.map(e => `'${e}'`).join(', ');
    sections.push(`const ${emitsObjName} = defineEmits([${emitEntries}])`);
  }

  // 4. Signal declarations
  if (ir.signals.length > 0) {
    const signalLines = ir.signals.map(
      s => `const ${s.name} = signal(${s.value})`
    );
    sections.push(signalLines.join('\n'));
  }

  // 5. Computed declarations
  if (ir.computeds.length > 0) {
    const computedLines = ir.computeds.map(
      c => `const ${c.name} = computed(() => ${c.body})`
    );
    sections.push(computedLines.join('\n'));
  }

  // 6. Effect declarations
  if (ir.effects.length > 0) {
    const effectBlocks = ir.effects.map(e => {
      const indentedBody = e.body
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
      return `effect(() => {\n${indentedBody}\n})`;
    });
    sections.push(effectBlocks.join('\n\n'));
  }

  // 7. Function declarations
  if (ir.methods.length > 0) {
    const fnBlocks = ir.methods.map(m => {
      const indentedBody = m.body
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
      return `function ${m.name}(${m.params}) {\n${indentedBody}\n}`;
    });
    sections.push(fnBlocks.join('\n\n'));
  }

  // 8. Lifecycle hooks — onMount
  if ((ir.onMountHooks || []).length > 0) {
    const mountBlocks = ir.onMountHooks.map(h => {
      const indentedBody = h.body
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
      return `onMount(() => {\n${indentedBody}\n})`;
    });
    sections.push(mountBlocks.join('\n\n'));
  }

  // 9. Lifecycle hooks — onDestroy
  if ((ir.onDestroyHooks || []).length > 0) {
    const destroyBlocks = ir.onDestroyHooks.map(h => {
      const indentedBody = h.body
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
      return `onDestroy(() => {\n${indentedBody}\n})`;
    });
    sections.push(destroyBlocks.join('\n\n'));
  }

  return sections.join('\n\n') + '\n';
}
