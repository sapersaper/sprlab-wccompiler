/**
 * Vue Vite plugin for WCC custom elements.
 * Configures isCustomElement and enables v-model:propName on custom elements.
 *
 * @module @sprlab/wccompiler/integrations/vue
 *
 * IMPORTANT: This file is for vite.config.js (Node.js context).
 * For browser-side model adapter, use app.use(wccVue) from '@sprlab/wccompiler/adapters/vue'.
 *
 * @example vite.config.js
 * ```js
 * import { wccVuePlugin } from '@sprlab/wccompiler/integrations/vue'
 * export default { plugins: [wccVuePlugin()] }
 * ```
 *
 * @example main.js (browser — enables v-model event translation)
 * ```js
 * import { wccVue } from '@sprlab/wccompiler/adapters/vue'
 * app.use(wccVue)
 * ```
 *
 * With this plugin, v-model:propName works natively on WCC custom elements:
 * ```vue
 * <wcc-input v-model="text"></wcc-input>
 * <wcc-form v-model:count="countRef" v-model:title="titleRef"></wcc-form>
 * ```
 */

import vue from '@vitejs/plugin-vue'

/**
 * @typedef {Object} WccVuePluginOptions
 * @property {string} [prefix='wcc-'] - Tag prefix for custom element detection
 */

/**
 * AST node transform that enables v-model:propName on custom elements.
 *
 * Vue's compiler normally doesn't support v-model with arguments on custom elements.
 * This transform intercepts v-model:arg directives on custom elements and rewrites them
 * to the equivalent :prop + @update:prop binding that Vue understands.
 *
 * Transforms:
 *   <wcc-input v-model:value="text" />
 * Into the equivalent of:
 *   <wcc-input :value="text" @update:value="text = $event" />
 *
 * @param {object} node - Vue compiler AST node
 * @param {object} context - Vue compiler transform context
 */
function wccVModelTransform(node, context) {
  // Only process element nodes (type 1 = ELEMENT)
  if (node.type !== 1) return;

  // Only process custom elements (tag contains a hyphen)
  if (!node.tag.includes('-')) return;

  // Find v-model directives with arguments
  const newProps = [];
  let modified = false;

  for (const prop of node.props) {
    // Check if this is a v-model directive (with or without argument)
    if (
      prop.type === 7 && // DIRECTIVE
      prop.name === 'model'
    ) {
      // Determine prop name: explicit arg or default 'modelValue'
      const propName = prop.arg ? prop.arg.content : 'modelValue';
      const expr = prop.exp;

      if (!expr) {
        newProps.push(prop);
        continue;
      }

      // Create the arg node (use existing or create for modelValue)
      const argNode = prop.arg || {
        type: 4, // SIMPLE_EXPRESSION
        content: 'modelValue',
        isStatic: true,
        constType: 3,
        loc: prop.loc
      };

      // Replace v-model:propName="expr" with:
      // :propName="expr" (bind directive)
      newProps.push({
        type: 7, // DIRECTIVE
        name: 'bind',
        arg: argNode,
        exp: expr,
        modifiers: [],
        loc: prop.loc
      });

      // @update:propName="$event => { expr = $event }" (on directive)
      newProps.push({
        type: 7, // DIRECTIVE
        name: 'on',
        arg: {
          type: 4, // SIMPLE_EXPRESSION
          content: `update:${propName}`,
          isStatic: true,
          constType: 3,
          loc: prop.loc
        },
        exp: {
          type: 4, // SIMPLE_EXPRESSION
          content: `$event => { ${expr.content} = $event.detail ?? $event }`,
          isStatic: false,
          constType: 0,
          loc: prop.loc
        },
        modifiers: [],
        loc: prop.loc
      });

      modified = true;
    } else {
      newProps.push(prop);
    }
  }

  if (modified) {
    node.props = newProps;
  }
}

/**
 * Creates a Vite plugin that configures Vue's template compiler
 * to recognize custom elements with the given prefix and enables
 * v-model:propName on those elements.
 *
 * @param {WccVuePluginOptions} [options]
 * @returns {import('vite').Plugin}
 */
export function wccVuePlugin(options = {}) {
  const prefix = typeof options.prefix === 'string' ? options.prefix : 'wcc-'
  return vue({
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith(prefix),
        nodeTransforms: [wccVModelTransform]
      }
    }
  })
}
