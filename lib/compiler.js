/**
 * Compiler — integrates parser, tree-walker, css-scoper, and codegen
 * into a single compile(filePath, config) function.
 *
 * This is the main entry point for compiling a .html source file
 * into a self-contained .js web component.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { JSDOM } from 'jsdom';
import { parse } from './parser.js';
import { walkTree } from './tree-walker.js';
import { generateComponent } from './codegen.js';

/**
 * Compile a single .html source file into a self-contained JS component string.
 *
 * @param {string} filePath - Absolute or relative path to the .html source file
 * @param {object} [config] - Optional config (currently unused, reserved for future options)
 * @returns {string} The generated JavaScript component code
 */
export function compile(filePath, config) {
  // 1. Read the source file
  const html = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath);

  // 2. Parse the HTML into the IR
  const parseResult = parse(html, fileName);

  // 3. Create a jsdom DOM from the template and walk it
  const dom = new JSDOM(`<div id="__root">${parseResult.template}</div>`);
  const rootEl = dom.window.document.getElementById('__root');

  const propsSet = new Set(parseResult.props);
  const computedNames = new Set(parseResult.computeds.map(c => c.name));
  const rootVarNames = new Set(parseResult.reactiveVars.map(v => v.name));

  const { bindings, events, slots } = walkTree(rootEl, propsSet, computedNames, rootVarNames);

  // 4. Update the parseResult with tree-walker results
  parseResult.bindings = bindings;
  parseResult.events = events;
  parseResult.slots = slots;
  parseResult.processedTemplate = rootEl.innerHTML;

  // 5. Generate the component code
  return generateComponent(parseResult);
}
