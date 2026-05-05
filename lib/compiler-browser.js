/**
 * Browser Compiler — compiles web components from strings using native browser APIs.
 *
 * This is the browser-compatible entry point for wcCompiler.
 * Uses DOMParser instead of jsdom, accepts strings instead of file paths.
 * Reuses codegen and css-scoper directly. Reimplements the tree-walking
 * pipeline using browser-native DOM APIs.
 *
 * Usage:
 *   import { compileFromStrings } from '@sprlab/wccompiler/browser'
 *
 *   const js = await compileFromStrings({
 *     script: 'import { signal } from "wcc"\nconst count = signal(0)',
 *     template: '<div>{{count}}</div>',
 *     style: '.counter { display: flex; }',
 *     tag: 'wcc-counter',
 *     lang: 'ts',
 *     stripTypes: async (code) => esbuild.transform(code, { loader: 'ts' }).then(r => r.code)
 *   })
 */

import {
  stripMacroImport,
  toClassName,
  camelToKebab,
  extractPropsGeneric,
  extractPropsArray,
  extractPropsDefaults,
  extractPropsObjectName,
  extractEmitsFromCallSignatures,
  extractEmits,
  extractEmitsObjectName,
  extractEmitsObjectNameFromGeneric,
  extractSignals,
  extractComputeds,
  extractEffects,
  extractWatchers,
  extractFunctions,
  extractLifecycleHooks,
  extractRefs,
  extractConstants,
} from './parser-extractors.js';

import { generateComponent } from './codegen.js';
import { BOOLEAN_ATTRIBUTES } from './types.js';
import { parseSFC } from './sfc-parser.js';

// ── Browser-compatible DOM helpers ──────────────────────────────────

/**
 * Create a DOM root from HTML using the browser's DOMParser.
 * @param {string} html
 * @returns {Element}
 */
function createRoot(html) {
  const doc = new DOMParser().parseFromString(
    `<html><body><div id="__root">${html}</div></body></html>`,
    'text/html'
  );
  return doc.getElementById('__root');
}

// ── Inline tree-walker (browser-compatible, no jsdom import) ────────
// These are copies of the tree-walker functions that use DOMParser
// instead of JSDOM for walkBranch. walkTree itself is DOM-agnostic.

function walkTree(rootEl, signalNames, computedNames, propNames = new Set()) {
  const bindings = [];
  const events = [];
  const showBindings = [];
  const modelBindings = [];
  const attrBindings = [];
  const slots = [];
  const childComponents = [];
  let bindIdx = 0, eventIdx = 0, showIdx = 0, modelIdx = 0, attrIdx = 0, slotIdx = 0, childIdx = 0;

  function bindingType(name) {
    if (propNames.has(name)) return 'prop';
    if (signalNames.has(name)) return 'signal';
    if (computedNames.has(name)) return 'computed';
    return 'method';
  }

  function walk(node, pathParts) {
    if (node.nodeType === 1) {
      const el = node;

      if (el.tagName === 'SLOT') {
        const slotName = el.getAttribute('name') || '';
        const varName = `__s${slotIdx++}`;
        const defaultContent = el.innerHTML.trim();
        const slotProps = [];
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith(':')) slotProps.push({ prop: attr.name.slice(1), source: attr.value });
        }
        slots.push({ varName, name: slotName, path: [...pathParts], defaultContent, slotProps });
        const placeholder = el.ownerDocument.createElement('span');
        placeholder.setAttribute('data-slot', slotName || 'default');
        if (defaultContent) placeholder.innerHTML = defaultContent;
        el.parentNode.replaceChild(placeholder, el);
        return;
      }

      const tagLower = el.tagName.toLowerCase();
      if (tagLower.includes('-') && tagLower !== rootEl.tagName?.toLowerCase()) {
        const propBindings = [];
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith('@') || attr.name.startsWith(':') || attr.name.startsWith('bind:')) continue;
          if (['show', 'model', 'if', 'else-if', 'else', 'each', 'ref'].includes(attr.name)) continue;
          const interpMatch = attr.value.match(/^\{\{([\w.]+)\}\}$/);
          if (interpMatch) {
            const expr = interpMatch[1];
            propBindings.push({
              attr: attr.name, expr,
              type: propNames.has(expr) ? 'prop' : signalNames.has(expr) ? 'signal' : computedNames.has(expr) ? 'computed' : 'method',
            });
            el.setAttribute(attr.name, '');
          }
        }
        if (propBindings.length > 0) {
          childComponents.push({ tag: tagLower, varName: `__child${childIdx++}`, path: [...pathParts], propBindings });
        }
      }

      const attrsToRemove = [];
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('@')) {
          events.push({ varName: `__e${eventIdx++}`, event: attr.name.slice(1), handler: attr.value, path: [...pathParts] });
          attrsToRemove.push(attr.name);
        } else if (attr.name.startsWith(':') || attr.name.startsWith('bind:')) {
          const attrName = attr.name.startsWith(':') ? attr.name.slice(1) : attr.name.slice(5);
          let kind = 'attr';
          if (attrName === 'class') kind = 'class';
          else if (attrName === 'style') kind = 'style';
          else if (BOOLEAN_ATTRIBUTES.has(attrName)) kind = 'bool';
          attrBindings.push({ varName: `__attr${attrIdx++}`, attr: attrName, expression: attr.value, kind, path: [...pathParts] });
          attrsToRemove.push(attr.name);
        }
      }
      attrsToRemove.forEach(a => el.removeAttribute(a));

      if (el.hasAttribute('show')) {
        showBindings.push({ varName: `__show${showIdx++}`, expression: el.getAttribute('show'), path: [...pathParts] });
        el.removeAttribute('show');
      }

      if (el.hasAttribute('model')) {
        const signalName = el.getAttribute('model');
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type') || 'text';
        let prop, event, coerce = false, radioValue = null;
        if (tag === 'select') { prop = 'value'; event = 'change'; }
        else if (tag === 'textarea') { prop = 'value'; event = 'input'; }
        else if (type === 'checkbox') { prop = 'checked'; event = 'change'; }
        else if (type === 'radio') { prop = 'checked'; event = 'change'; radioValue = el.getAttribute('value'); }
        else if (type === 'number') { prop = 'value'; event = 'input'; coerce = true; }
        else { prop = 'value'; event = 'input'; }
        modelBindings.push({ varName: `__model${modelIdx++}`, signal: signalName, prop, event, coerce, radioValue, path: [...pathParts] });
        el.removeAttribute('model');
      }
    }

    if (node.nodeType === 3 && /\{\{[\w.]+\}\}/.test(node.textContent)) {
      const text = node.textContent;
      const trimmed = text.trim();
      const soleMatch = trimmed.match(/^\{\{([\w.]+)\}\}$/);
      const parent = node.parentNode;

      if (soleMatch && parent.childNodes.length === 1) {
        bindings.push({ varName: `__b${bindIdx++}`, name: soleMatch[1], type: bindingType(soleMatch[1]), path: pathParts.slice(0, -1) });
        parent.textContent = '';
        return;
      }

      const doc = node.ownerDocument;
      const fragment = doc.createDocumentFragment();
      const parts = text.split(/(\{\{[\w.]+\}\})/);
      const parentPath = pathParts.slice(0, -1);
      let baseIndex = 0;
      for (const child of parent.childNodes) { if (child === node) break; baseIndex++; }
      let offset = 0;
      for (const part of parts) {
        const bm = part.match(/^\{\{([\w.]+)\}\}$/);
        if (bm) {
          fragment.appendChild(doc.createElement('span'));
          bindings.push({ varName: `__b${bindIdx++}`, name: bm[1], type: bindingType(bm[1]), path: [...parentPath, `childNodes[${baseIndex + offset}]`] });
          offset++;
        } else if (part) {
          fragment.appendChild(doc.createTextNode(part));
          offset++;
        }
      }
      parent.replaceChild(fragment, node);
      return;
    }

    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      walk(children[i], [...pathParts, `childNodes[${i}]`]);
    }
  }

  walk(rootEl, []);
  return { bindings, events, showBindings, modelBindings, attrBindings, slots, childComponents };
}

function recomputeAnchorPath(rootEl, targetNode) {
  const segments = [];
  let current = targetNode;
  while (current && current !== rootEl) {
    const parent = current.parentNode;
    if (!parent) break;
    const children = Array.from(parent.childNodes);
    const idx = children.indexOf(current);
    segments.unshift(`childNodes[${idx}]`);
    current = parent;
  }
  return segments;
}

function walkBranch(html, signalNames, computedNames, propNames) {
  const branchRoot = createRoot(html);
  const result = walkTree(branchRoot, signalNames, computedNames, propNames);
  const processedHtml = branchRoot.innerHTML;

  function stripFirstSegment(items) {
    for (const item of items) {
      if (item.path && item.path.length > 0 && item.path[0].startsWith('childNodes[')) {
        item.path = item.path.slice(1);
      }
    }
  }
  stripFirstSegment(result.bindings);
  stripFirstSegment(result.events);
  stripFirstSegment(result.showBindings);
  stripFirstSegment(result.attrBindings);
  stripFirstSegment(result.modelBindings);
  stripFirstSegment(result.slots);
  stripFirstSegment(result.childComponents);

  return { ...result, processedHtml };
}

// Simplified processIfChains and processForBlocks for browser
// (same logic as tree-walker.js but using browser DOM)

function isChainPredecessor(el) {
  return el.hasAttribute('if') || el.hasAttribute('else-if');
}

function processIfChains(parent, parentPath, signalNames, computedNames, propNames) {
  const ifBlocks = [];
  let ifIdx = 0;

  function findIfChains(node, currentPath) {
    const children = Array.from(node.childNodes);
    let currentChain = null;
    let prevElement = null;

    for (const child of children) {
      if (child.nodeType !== 1) continue;
      const el = child;
      const hasIf = el.hasAttribute('if');
      const hasElseIf = el.hasAttribute('else-if');
      const hasElse = el.hasAttribute('else');

      if (hasIf) {
        if (currentChain) {
          ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
          currentChain = null;
        }
        currentChain = { elements: [el], branches: [{ type: 'if', expression: el.getAttribute('if'), element: el }] };
      } else if (hasElseIf && currentChain) {
        currentChain.elements.push(el);
        currentChain.branches.push({ type: 'else-if', expression: el.getAttribute('else-if'), element: el });
      } else if (hasElse && currentChain) {
        currentChain.elements.push(el);
        currentChain.branches.push({ type: 'else', expression: null, element: el });
        ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
        currentChain = null;
      } else {
        if (currentChain) {
          ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
          currentChain = null;
        }
        const childIdx = Array.from(node.childNodes).indexOf(el);
        findIfChains(el, [...currentPath, `childNodes[${childIdx}]`]);
      }
      prevElement = el;
    }
    if (currentChain) {
      ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
    }
  }

  findIfChains(parent, parentPath);
  parent.normalize();
  for (const ib of ifBlocks) ib.anchorPath = recomputeAnchorPath(parent, ib._anchorNode);
  return ifBlocks;
}

function buildIfBlock(chain, parent, parentPath, idx, signalNames, computedNames, propNames) {
  const doc = parent.ownerDocument;
  const branches = chain.branches.map(branch => {
    const clone = branch.element.cloneNode(true);
    clone.removeAttribute('if');
    clone.removeAttribute('else-if');
    clone.removeAttribute('else');
    const { bindings, events, showBindings, attrBindings, modelBindings, slots, processedHtml } = walkBranch(clone.outerHTML, signalNames, computedNames, propNames);
    return { type: branch.type, expression: branch.expression, templateHtml: processedHtml, bindings, events, showBindings, attrBindings, modelBindings, slots };
  });

  const comment = doc.createComment(' if ');
  parent.insertBefore(comment, chain.elements[0]);
  for (const el of chain.elements) parent.removeChild(el);

  const childNodes = Array.from(parent.childNodes);
  const commentIndex = childNodes.indexOf(comment);

  return { varName: `__if${idx}`, anchorPath: [...parentPath, `childNodes[${commentIndex}]`], _anchorNode: comment, branches };
}

function processForBlocks(parent, parentPath, signalNames, computedNames, propNames) {
  const forBlocks = [];
  let forIdx = 0;
  const simpleRe = /^\s*(\w+)\s+in\s+(.+)\s*$/;
  const destructuredRe = /^\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(.+)\s*$/;

  function parseEach(expr) {
    const d = destructuredRe.exec(expr);
    if (d) return { itemVar: d[1], indexVar: d[2], source: d[3].trim() };
    const s = simpleRe.exec(expr);
    if (s) return { itemVar: s[1], indexVar: null, source: s[2].trim() };
    throw new Error('Invalid each expression: ' + expr);
  }

  function find(node, currentPath) {
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType !== 1) continue;
      const el = child;
      if (el.hasAttribute('each')) {
        const { itemVar, indexVar, source } = parseEach(el.getAttribute('each'));
        const keyExpr = el.hasAttribute(':key') ? el.getAttribute(':key') : null;
        const clone = el.cloneNode(true);
        clone.removeAttribute('each');
        clone.removeAttribute(':key');
        const { bindings, events, showBindings, attrBindings, modelBindings, slots, processedHtml } = walkBranch(clone.outerHTML, signalNames, computedNames, propNames);
        const doc = node.ownerDocument;
        const comment = doc.createComment(' each ');
        node.replaceChild(comment, el);
        const updatedChildren = Array.from(node.childNodes);
        const commentIndex = updatedChildren.indexOf(comment);
        forBlocks.push({
          varName: `__for${forIdx++}`, itemVar, indexVar, source, keyExpr,
          templateHtml: processedHtml, anchorPath: [...currentPath, `childNodes[${commentIndex}]`],
          _anchorNode: comment, bindings, events, showBindings, attrBindings, modelBindings, slots,
        });
      } else {
        find(el, [...currentPath, `childNodes[${i}]`]);
      }
    }
  }

  find(parent, parentPath);
  return forBlocks;
}

function detectRefs(rootEl) {
  const refBindings = [];
  const elements = rootEl.querySelectorAll('[ref]');
  for (const el of elements) {
    const refName = el.getAttribute('ref');
    const path = [];
    let current = el;
    while (current && current !== rootEl) {
      const parent = current.parentNode;
      if (!parent) break;
      const children = Array.from(parent.childNodes);
      path.unshift(`childNodes[${children.indexOf(current)}`);
      current = parent;
    }
    el.removeAttribute('ref');
    refBindings.push({ refName, path });
  }
  return refBindings;
}

// ── Main compile function ───────────────────────────────────────────

/**
 * @typedef {Object} CompileFromStringsOptions
 * @property {string} script
 * @property {string} template
 * @property {string} [style]
 * @property {string} tag
 * @property {'ts'|'js'} [lang]
 * @property {(code: string) => Promise<string>} [stripTypes]
 */

/**
 * Compile a web component from source strings.
 * Browser-compatible — uses DOMParser instead of jsdom.
 *
 * @param {CompileFromStringsOptions} options
 * @returns {Promise<string>} Compiled JavaScript
 */
export async function compileFromStrings({ script, template, style = '', tag, lang = 'js', stripTypes }) {
  const className = toClassName(tag);

  // 1. Strip macro imports
  let source = stripMacroImport(script);

  // 2. Extract from generic form BEFORE type stripping
  const propsFromGeneric = extractPropsGeneric(source);
  const propsObjectNameFromGeneric = extractPropsObjectName(source);
  const emitsFromCallSignatures = extractEmitsFromCallSignatures(source);
  const emitsObjectNameGenericMatch = source.match(/(?:const|let|var)\s+([$\w]+)\s*=\s*defineEmits\s*<\s*\{/);
  const emitsObjectNameFromGeneric = emitsObjectNameGenericMatch ? emitsObjectNameGenericMatch[1] : null;

  // 3. Strip TypeScript types if needed
  if (lang === 'ts' && stripTypes) {
    source = await stripTypes(source);
  }

  // 4. Extract lifecycle hooks
  const { onMountHooks, onDestroyHooks } = extractLifecycleHooks(source);

  // 4b. Strip lifecycle + watch blocks
  const hookLinePattern = /\bonMount\s*\(|\bonDestroy\s*\(|\bwatch\s*\(/;
  const sourceLines = source.split('\n');
  const filteredLines = [];
  let skipDepth = 0, skipping = false;
  for (const line of sourceLines) {
    if (!skipping && hookLinePattern.test(line)) {
      skipping = true; skipDepth = 0;
      for (const ch of line) { if (ch === '{') skipDepth++; if (ch === '}') skipDepth--; }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    if (skipping) {
      for (const ch of line) { if (ch === '{') skipDepth++; if (ch === '}') skipDepth--; }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    filteredLines.push(line);
  }
  const src = filteredLines.join('\n');

  // 5. Extract declarations
  const signals = extractSignals(src);
  const computeds = extractComputeds(src);
  const effects = extractEffects(src);
  const watchers = extractWatchers(source);
  const methods = extractFunctions(src);
  const refs = extractRefs(src);
  const constantVars = extractConstants(src);

  // 6. Props
  const propsFromArray = propsFromGeneric.length > 0 ? [] : extractPropsArray(source);
  let propNames = propsFromGeneric.length > 0 ? propsFromGeneric : propsFromArray;
  const propsDefaults = extractPropsDefaults(source);
  if (propNames.length === 0 && Object.keys(propsDefaults).length > 0) propNames = Object.keys(propsDefaults);
  const propsObjectName = propsObjectNameFromGeneric ?? extractPropsObjectName(source);
  const propDefs = propNames.map(name => ({ name, default: propsDefaults[name] ?? 'undefined', attrName: camelToKebab(name) }));

  // 7. Emits
  const emitsFromArray = emitsFromCallSignatures.length > 0 ? [] : extractEmits(source);
  const emitNames = emitsFromCallSignatures.length > 0 ? emitsFromCallSignatures : emitsFromArray;
  const emitsObjectName = emitsObjectNameFromGeneric ?? extractEmitsObjectName(source);

  // 8. Parse template
  const rootEl = createRoot(template);

  // 9. Name sets
  const signalNameSet = new Set(signals.map(s => s.name));
  const computedNameSet = new Set(computeds.map(c => c.name));
  const propNameSet = new Set(propDefs.map(p => p.name));

  // 10. Process directives
  const forBlocks = processForBlocks(rootEl, [], signalNameSet, computedNameSet, propNameSet);
  const ifBlocks = processIfChains(rootEl, [], signalNameSet, computedNameSet, propNameSet);
  rootEl.normalize();
  for (const fb of forBlocks) fb.anchorPath = recomputeAnchorPath(rootEl, fb._anchorNode);
  for (const ib of ifBlocks) ib.anchorPath = recomputeAnchorPath(rootEl, ib._anchorNode);

  // 11. Walk tree
  const { bindings, events, showBindings, modelBindings, attrBindings, slots, childComponents } = walkTree(rootEl, signalNameSet, computedNameSet, propNameSet);

  // 12. Detect refs
  const refBindings = detectRefs(rootEl);

  // 13. Generate
  return generateComponent({
    tagName: tag, className, template, style,
    signals, computeds, effects, constantVars, watchers, methods,
    propDefs, propsObjectName: propsObjectName ?? null,
    emits: emitNames, emitsObjectName: emitsObjectName ?? null,
    bindings, events, showBindings, modelBindings, attrBindings,
    ifBlocks, forBlocks, slots, onMountHooks, onDestroyHooks,
    refs, refBindings, childComponents, childImports: [],
    processedTemplate: rootEl.innerHTML,
  });
}

/**
 * Compile an SFC component from a source string (browser-compatible).
 * Parses the SFC to extract blocks, then delegates to compileFromStrings.
 *
 * @param {string} source — Full content of the .wcc file
 * @param {{ stripTypes?: (code: string) => Promise<string> }} [options]
 * @returns {Promise<string>} Compiled JavaScript
 */
export async function compileFromSFC(source, options) {
  const descriptor = parseSFC(source);
  return compileFromStrings({
    script: descriptor.script,
    template: descriptor.template,
    style: descriptor.style,
    tag: descriptor.tag,
    lang: descriptor.lang,
    stripTypes: options?.stripTypes,
  });
}

