/**
 * DOM update operation generator — emitted inside __invalidate(key) switch cases.
 * Transforms a DepEntry into DOM manipulation code (textContent, style.display,
 * setAttribute, etc.) with support for if-block guards and each-block loops.
 */
import { wrapTernaryExpr } from '../transform/expr-transformer.js';

/**
 * @param {import('../transform/dep-graph.js').DepEntry} entry
 * @param {string[]} lines
 * @param {string} indent
 */
export function generateUpdateOp(entry, lines, indent) {
  // Helper: wrap operation in a for-loop if entry is for each-block items
  function eachForOpen() {
    if (entry.eachBlockIndex !== undefined) {
      lines.push(`${indent}for (let __i = 0; __i < this.__for${entry.eachBlockIndex}_nodes.length; __i++) {`);
    }
  }
  function eachForClose() {
    if (entry.eachBlockIndex !== undefined) {
      lines.push(`${indent}}`);
    }
  }
  // Build the node reference for each-block items
  const nodeRef = entry.eachBlockIndex !== undefined
    ? entry.path
      ? `this.__for${entry.eachBlockIndex}_nodes[__i].${entry.path.join('.')}`
      : `this.__for${entry.eachBlockIndex}_nodes[__i]`
    : `this.${entry.varName}`;
  switch (entry.type) {
    case 'text':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  ${entry.ifPathExpr}.textContent = ${wrapTernaryExpr(entry.expr)} ?? '';`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  ${nodeRef}.textContent = ${wrapTernaryExpr(entry.expr)} ?? '';`);
        eachForClose();
      } else {
        lines.push(`${indent}this.${entry.varName}.textContent = ${wrapTernaryExpr(entry.expr)} ?? '';`);
      }
      break;
    case 'show':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  ${entry.ifPathExpr}.style.display = (${entry.expr}) ? '' : 'none';`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  ${nodeRef}.style.display = (${entry.expr}) ? '' : 'none';`);
        eachForClose();
      } else {
        lines.push(`${indent}this.${entry.varName}.style.display = (${entry.expr}) ? '' : 'none';`);
      }
      break;
    case 'showEach':
      if (entry.eachBlockIndex !== undefined) {
        lines.push(`${indent}for (const __el of (this.__show_elements && this.__show_elements['${entry.depKey}'] || [])) {`);
        lines.push(`${indent}  __el.style.display = (${entry.expr}) ? '' : 'none';`);
        lines.push(`${indent}}`);
      }
      break;
    case 'attr':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  const __v = ${entry.expr};`);
        lines.push(`${indent}  if (__v || __v === '') { ${entry.ifPathExpr}.setAttribute('${entry.attr}', __v); }`);
        lines.push(`${indent}  else { ${entry.ifPathExpr}.removeAttribute('${entry.attr}'); }`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  const __v = ${entry.expr};`);
        lines.push(`${indent}  if (__v || __v === '') { ${nodeRef}.setAttribute('${entry.attr}', __v); }`);
        lines.push(`${indent}  else { ${nodeRef}.removeAttribute('${entry.attr}'); }`);
        eachForClose();
      } else {
        lines.push(`${indent}{ const __v = ${entry.expr};`);
        lines.push(`${indent}  if (__v || __v === '') { this.${entry.varName}.setAttribute('${entry.attr}', __v); }`);
        lines.push(`${indent}  else { this.${entry.varName}.removeAttribute('${entry.attr}'); } }`);
      }
      break;
    case 'bool':
      if (entry.ifPathExpr) {
        lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
        lines.push(`${indent}  ${entry.ifPathExpr}.${entry.attr} = !!(${entry.expr});`);
        lines.push(`${indent}}`);
      } else if (entry.eachBlockIndex !== undefined) {
        eachForOpen();
        lines.push(`${indent}  ${nodeRef}.${entry.attr} = !!(${entry.expr});`);
        eachForClose();
      } else {
        lines.push(`${indent}this.${entry.varName}.${entry.attr} = !!(${entry.expr});`);
      }
      break;
    case 'class':
      if (entry.subKind === 'object') {
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${entry.ifPathExpr}.classList.add(__k) : ${entry.ifPathExpr}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? ${nodeRef}.classList.add(__k) : ${nodeRef}.classList.remove(__k);`);
          lines.push(`${indent}  }`);
          eachForClose();
        } else {
          lines.push(`${indent}{ const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    __val ? this.${entry.varName}.classList.add(__k) : this.${entry.varName}.classList.remove(__k);`);
          lines.push(`${indent}  } }`);
        }
      } else if (entry.subKind === 'array') {
        const staticPrefix = entry.staticValue ? `'${entry.staticValue} ' + ` : '';
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  ${entry.ifPathExpr}.className = ${staticPrefix}(${entry.expr}).join(' ');`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}(${entry.expr}).join(' ');`);
          eachForClose();
        } else {
          lines.push(`${indent}this.${entry.varName}.className = ${staticPrefix}(${entry.expr}).join(' ');`);
        }
      } else {
        const staticPrefix = entry.staticValue ? `'${entry.staticValue} ' + ` : '';
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  ${entry.ifPathExpr}.className = ${staticPrefix}${wrapTernaryExpr(entry.expr)};`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  ${nodeRef}.className = ${staticPrefix}${wrapTernaryExpr(entry.expr)};`);
          eachForClose();
        } else {
          lines.push(`${indent}this.${entry.varName}.className = ${staticPrefix}${wrapTernaryExpr(entry.expr)};`);
        }
      }
      break;
    case 'style':
      if (entry.subKind === 'object') {
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    ${entry.ifPathExpr}.style[__k] = __val;`);
          lines.push(`${indent}  }`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    ${nodeRef}.style[__k] = __val;`);
          lines.push(`${indent}  }`);
          eachForClose();
        } else {
          lines.push(`${indent}{ const __obj = ${entry.expr};`);
          lines.push(`${indent}  for (const [__k, __val] of Object.entries(__obj)) {`);
          lines.push(`${indent}    this.${entry.varName}.style[__k] = __val;`);
          lines.push(`${indent}  } }`);
        }
      } else {
        const staticPrefix = entry.staticValue ? `'${entry.staticValue}; ' + ` : '';
        if (entry.ifPathExpr) {
          lines.push(`${indent}if (this.__if${entry.ifBlockIndex}_current) {`);
          lines.push(`${indent}  ${entry.ifPathExpr}.style.cssText = ${staticPrefix}${entry.expr};`);
          lines.push(`${indent}}`);
        } else if (entry.eachBlockIndex !== undefined) {
          eachForOpen();
          lines.push(`${indent}  ${nodeRef}.style.cssText = ${staticPrefix}${entry.expr};`);
          eachForClose();
        } else {
          lines.push(`${indent}this.${entry.varName}.style.cssText = ${staticPrefix}${entry.expr};`);
        }
      }
      break;
    case 'computed':
      lines.push(`${indent}this._state.${entry.computedName} = ${entry.expr};`);
      break;
    case 'renderIf':
      lines.push(`${indent}this.__renderIf_${entry.ifBlockIndex}();`);
      break;
    case 'renderEach':
      lines.push(`${indent}this.__renderEach_${entry.eachBlockIndex}();`);
      break;
    case 'renderDynamic':
      lines.push(`${indent}this.__renderDynamic_${entry.dynIndex}();`);
      break;
    case 'modelValue':
      lines.push(`${indent}this.${entry.varName}.value = this._state.${entry.signal} ?? '';`);
      break;
    case 'modelCheckbox':
      lines.push(`${indent}this.${entry.varName}.checked = !!this._state.${entry.signal};`);
      break;
    case 'modelRadio':
      lines.push(`${indent}this.${entry.varName}.checked = (this._state.${entry.signal} === '${entry.radioValue}');`);
      break;
    case 'modelProp':
      lines.push(`${indent}if (this.${entry.varName}) this.${entry.varName}.setAttribute('${entry.attr}', this._state.${entry.signal} ?? '');`);
      break;
    case 'childProp':
      lines.push(`${indent}if (this.${entry.varName}) {`);
      lines.push(`${indent}  const __v = ${entry.expr};`);
      lines.push(`${indent}  if (__v || __v === '') { this.${entry.varName}.setAttribute('${entry.attr}', __v); }`);
      lines.push(`${indent}  else { this.${entry.varName}.removeAttribute('${entry.attr}'); }`);
      lines.push(`${indent}}`);
      break;
    case 'watcher':
      if (entry.initOnly) {
        // Initialize old value without calling callback (used only in case '*')
        if (entry.watcherKind === 'signal') {
          lines.push(`${indent}this.${entry.prevName} = this._state.${entry.watcherTarget};`);
        } else {
          lines.push(`${indent}this.${entry.prevName} = ${entry.getterExpr};`);
        }
      } else {
        // Runtime watcher invocation
        if (entry.watcherKind === 'signal') {
          lines.push(`${indent}if (this.${entry.prevName} !== undefined && this.${entry.prevName} !== this._state.${entry.watcherTarget}) {`);
          lines.push(`${indent}  const ${entry.newParam} = this._state.${entry.watcherTarget};`);
          if (entry.oldParam) {
            lines.push(`${indent}  const ${entry.oldParam} = this.${entry.prevName};`);
          }
          const bodyLines = entry.expr ? entry.expr.trim().split('\n') : [];
          for (const line of bodyLines) {
            lines.push(`${indent}  ${line}`);
          }
          lines.push(`${indent}}`);
          lines.push(`${indent}this.${entry.prevName} = this._state.${entry.watcherTarget};`);
        } else {
          // Getter watcher
          lines.push(`${indent}if (this.${entry.prevName} !== undefined) {`);
          lines.push(`${indent}  const ${entry.newParam} = ${entry.getterExpr};`);
          lines.push(`${indent}  if (this.${entry.prevName} !== ${entry.newParam}) {`);
          if (entry.oldParam) {
            lines.push(`${indent}    const ${entry.oldParam} = this.${entry.prevName};`);
          }
          const bodyLines = entry.expr ? entry.expr.trim().split('\n') : [];
          for (const line of bodyLines) {
            lines.push(`${indent}    ${line}`);
          }
          lines.push(`${indent}  }`);
          lines.push(`${indent}  this.${entry.prevName} = ${entry.newParam};`);
          lines.push(`${indent}}`);
        }
      }
      break;
  }
}
