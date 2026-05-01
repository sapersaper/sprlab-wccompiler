// ../lib/parser-extractors.js
function stripMacroImport(source) {
  return source.replace(
    /import\s*\{[^}]*\}\s*from\s*['"](?:wcc|@sprlab\/wccompiler)['"]\s*;?/g,
    ""
  );
}
function toClassName(tagName) {
  return tagName.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}
function camelToKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
function extractPropsGeneric(source) {
  const m = source.match(/defineProps\s*<\s*\{([^}]*)\}\s*>/);
  if (!m) return [];
  const body = m[1];
  const props = [];
  const re = /(\w+)\s*[?]?\s*:/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    props.push(match[1]);
  }
  return props;
}
function extractPropsArray(source) {
  const m = source.match(/defineProps\(\s*\[([^\]]*)\]\s*\)/);
  if (!m) return [];
  const body = m[1];
  const props = [];
  const re = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    props.push(match[1]);
  }
  return props;
}
function extractPropsDefaults(source) {
  const idx = source.indexOf("defineProps(");
  if (idx === -1) return {};
  const start = idx + "defineProps(".length;
  let argStart = start;
  while (argStart < source.length && /\s/.test(source[argStart])) argStart++;
  if (source[argStart] === "[") return {};
  if (source[argStart] !== "{") return {};
  let depth = 0;
  let i = argStart;
  let inString = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const objLiteral = source.slice(argStart, i).trim();
  const inner = objLiteral.slice(1, -1).trim();
  if (!inner) return {};
  const defaults = {};
  let pos = 0;
  while (pos < inner.length) {
    while (pos < inner.length && /\s/.test(inner[pos])) pos++;
    if (pos >= inner.length) break;
    const keyMatch = inner.slice(pos).match(/^(\w+)\s*:\s*/);
    if (!keyMatch) break;
    const key = keyMatch[1];
    pos += keyMatch[0].length;
    let valDepth = 0;
    let valStart = pos;
    let valInString = null;
    for (; pos < inner.length; pos++) {
      const ch = inner[pos];
      if (valInString) {
        if (ch === "\\") {
          pos++;
          continue;
        }
        if (ch === valInString) valInString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        valInString = ch;
        continue;
      }
      if (ch === "(" || ch === "[" || ch === "{") valDepth++;
      if (ch === ")" || ch === "]" || ch === "}") valDepth--;
      if (valDepth === 0 && ch === ",") {
        break;
      }
    }
    const value = inner.slice(valStart, pos).trim();
    defaults[key] = value;
    if (pos < inner.length && inner[pos] === ",") pos++;
  }
  return defaults;
}
function extractPropsObjectName(source) {
  const m = source.match(/(?:const|let|var)\s+([$\w]+)\s*=\s*defineProps\s*[<(]/);
  return m ? m[1] : null;
}
function extractEmitsFromCallSignatures(source) {
  const m = source.match(/defineEmits\s*<\s*\{([\s\S]*?)\}\s*>\s*\(\s*\)/);
  if (!m) return [];
  const body = m[1];
  const emits = [];
  const re = /\(\s*\w+\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    emits.push(match[1]);
  }
  return emits;
}
function extractEmits(source) {
  const m = source.match(/defineEmits\(\[([^\]]*)\]\)/);
  if (!m) return [];
  const body = m[1];
  const emits = [];
  const re = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    emits.push(match[1]);
  }
  return emits;
}
function extractEmitsObjectName(source) {
  const m = source.match(/(?:const|let|var)\s+([$\w]+)\s*=\s*defineEmits\s*\(/);
  return m ? m[1] : null;
}
function extractSignalArgument(source, startIdx) {
  let depth = 0;
  let i = startIdx;
  let inString = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      if (depth === 0) break;
      depth--;
    }
  }
  return source.slice(startIdx, i).trim() || "undefined";
}
function extractSignals(source) {
  const signals = [];
  const re = /(?:const|let|var)\s+([$\w]+)\s*=\s*signal\(/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const argStart = m.index + m[0].length;
    const value = extractSignalArgument(source, argStart);
    signals.push({ name, value });
  }
  return signals;
}
var REACTIVE_CALLS = /\b(?:signal|computed|effect|watch|defineProps|defineEmits|defineComponent|templateRef|templateBindings|onMount|onDestroy)\s*[<(]/;
function extractConstants(source) {
  const constants = [];
  let depth = 0;
  for (const line of source.split("\n")) {
    for (const ch of line) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    if (depth > 0) continue;
    const m = line.match(/^\s*(?:const|let|var)\s+([$\w]+)\s*=\s*(.+?);?\s*$/);
    if (!m) continue;
    const value = m[2].trim();
    if (REACTIVE_CALLS.test(value)) continue;
    if (/^\s*export\s+default/.test(line)) continue;
    constants.push({ name: m[1], value });
  }
  return constants;
}
function extractComputeds(source) {
  const out = [];
  const re = /(?:const|let|var)\s+(\w+)\s*=\s*computed\(\s*\(\)\s*=>\s*/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    let inString = null;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (inString) {
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        continue;
      }
      if (ch === "(") depth++;
      if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = source.slice(bodyStart, i).trim();
    if (body) {
      out.push({ name, body });
    }
  }
  return out;
}
function extractEffects(source) {
  const effects = [];
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const effectMatch = line.match(/\beffect\s*\(\s*\(\s*\)\s*=>\s*\{/);
    if (effectMatch) {
      let depth = 0;
      let bodyLines = [];
      let started = false;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === "{") {
            if (started) depth++;
            else {
              depth = 1;
              started = true;
            }
          }
          if (ch === "}") depth--;
        }
        if (j === i) {
          const braceIdx = l.indexOf("{");
          const afterBrace = l.substring(braceIdx + 1);
          if (afterBrace.trim()) bodyLines.push(afterBrace);
        } else if (depth <= 0) {
          const lastBraceIdx = l.lastIndexOf("}");
          const before = l.substring(0, lastBraceIdx);
          if (before.trim()) bodyLines.push(before);
          i = j;
          break;
        } else {
          bodyLines.push(l);
        }
      }
      const nonEmptyLines = bodyLines.filter((l) => l.trim().length > 0);
      let minIndent = Infinity;
      for (const bl of nonEmptyLines) {
        const leadingSpaces = bl.match(/^(\s*)/)[1].length;
        if (leadingSpaces < minIndent) minIndent = leadingSpaces;
      }
      if (minIndent === Infinity) minIndent = 0;
      const dedentedLines = bodyLines.map((bl) => bl.substring(minIndent));
      const body = dedentedLines.join("\n").trim();
      effects.push({ body });
    }
    i++;
  }
  return effects;
}
function extractWatchers(source) {
  const watchers = [];
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/\bwatch\(\s*['"](\w+)['"]\s*,\s*\((\w+)\s*,\s*(\w+)\)\s*=>\s*\{/);
    if (m) {
      const target = m[1];
      const newParam = m[2];
      const oldParam = m[3];
      let depth = 0;
      let bodyLines = [];
      let started = false;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === "{") {
            if (started) depth++;
            else {
              depth = 1;
              started = true;
            }
          }
          if (ch === "}") depth--;
        }
        if (j === i) {
          const braceIdx = l.indexOf("{");
          const afterBrace = l.substring(braceIdx + 1);
          if (depth <= 0) {
            const lastBraceIdx = l.lastIndexOf("}");
            const inner = l.substring(braceIdx + 1, lastBraceIdx);
            if (inner.trim()) bodyLines.push(inner);
            i = j;
            break;
          }
          if (afterBrace.trim()) bodyLines.push(afterBrace);
        } else if (depth <= 0) {
          const lastBraceIdx = l.lastIndexOf("}");
          const before = l.substring(0, lastBraceIdx);
          if (before.trim()) bodyLines.push(before);
          i = j;
          break;
        } else {
          bodyLines.push(l);
        }
      }
      const nonEmpty = bodyLines.filter((l) => l.trim().length > 0);
      let minIndent = Infinity;
      for (const bl of nonEmpty) {
        const leading = bl.match(/^(\s*)/)[1].length;
        if (leading < minIndent) minIndent = leading;
      }
      if (minIndent === Infinity) minIndent = 0;
      const body = bodyLines.map((bl) => bl.substring(minIndent)).join("\n").trim();
      watchers.push({ target, newParam, oldParam, body });
    }
    i++;
  }
  return watchers;
}
function extractFunctions(source) {
  const functions = [];
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^\s*function\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    if (m) {
      const name = m[1];
      const params = m[2].trim();
      let depth = 0;
      let bodyLines = [];
      let started = false;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === "{") {
            if (started) depth++;
            else {
              depth = 1;
              started = true;
            }
          }
          if (ch === "}") depth--;
        }
        if (j === i) {
          const afterBrace = l.substring(l.indexOf("{") + 1);
          if (afterBrace.trim()) bodyLines.push(afterBrace);
        } else if (depth <= 0) {
          const lastBraceIdx = l.lastIndexOf("}");
          const before = l.substring(0, lastBraceIdx);
          if (before.trim()) bodyLines.push(before);
          i = j;
          break;
        } else {
          bodyLines.push(l);
        }
      }
      functions.push({
        name,
        params,
        body: bodyLines.join("\n").trim()
      });
    }
    i++;
  }
  return functions;
}
function extractLifecycleHooks(script) {
  const onMountHooks = [];
  const onDestroyHooks = [];
  const lines = script.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const mountMatch = line.match(/\bonMount\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/);
    const destroyMatch = line.match(/\bonDestroy\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/);
    if (mountMatch || destroyMatch) {
      const isAsync = /\basync\s*\(/.test(line);
      let depth = 0;
      let bodyLines = [];
      let started = false;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === "{") {
            if (started) depth++;
            else {
              depth = 1;
              started = true;
            }
          }
          if (ch === "}") depth--;
        }
        if (j === i) {
          const braceIdx = l.indexOf("{");
          const afterBrace = l.substring(braceIdx + 1);
          if (depth <= 0) {
            const lastBraceIdx = l.lastIndexOf("}");
            const inner = l.substring(braceIdx + 1, lastBraceIdx);
            if (inner.trim()) bodyLines.push(inner);
            i = j;
            break;
          }
          if (afterBrace.trim()) bodyLines.push(afterBrace);
        } else if (depth <= 0) {
          const lastBraceIdx = l.lastIndexOf("}");
          const before = l.substring(0, lastBraceIdx);
          if (before.trim()) bodyLines.push(before);
          i = j;
          break;
        } else {
          bodyLines.push(l);
        }
      }
      const nonEmptyLines = bodyLines.filter((l) => l.trim().length > 0);
      let minIndent = Infinity;
      for (const bl of nonEmptyLines) {
        const leadingSpaces = bl.match(/^(\s*)/)[1].length;
        if (leadingSpaces < minIndent) minIndent = leadingSpaces;
      }
      if (minIndent === Infinity) minIndent = 0;
      const dedentedLines = bodyLines.map((bl) => bl.substring(minIndent));
      const body = dedentedLines.join("\n").trim();
      if (mountMatch) {
        onMountHooks.push({ body, async: isAsync });
      } else {
        onDestroyHooks.push({ body, async: isAsync });
      }
    }
    i++;
  }
  return { onMountHooks, onDestroyHooks };
}
function extractRefs(source) {
  const refs = [];
  const re = /(?:const|let|var)\s+([$\w]+)\s*=\s*templateRef\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    refs.push({ varName: m[1], refName: m[2] });
  }
  return refs;
}

// ../lib/reactive-runtime.js
var reactiveRuntime = `
let __currentEffect = null;
let __batchDepth = 0;
const __pendingEffects = [];

function __signal(initial) {
  let _value = initial;
  const _subs = new Set();
  return (...args) => {
    if (args.length === 0) {
      if (__currentEffect) _subs.add(__currentEffect);
      return _value;
    }
    const old = _value;
    _value = args[0];
    if (old !== _value) {
      if (__batchDepth > 0) {
        for (const fn of _subs) {
          if (!__pendingEffects.includes(fn)) __pendingEffects.push(fn);
        }
      } else {
        for (const fn of [..._subs]) fn();
      }
    }
  };
}

function __computed(fn) {
  let _cached, _dirty = true;
  const _subs = new Set();
  const recompute = () => {
    _dirty = true;
    if (__batchDepth > 0) {
      for (const fn of _subs) {
        if (!__pendingEffects.includes(fn)) __pendingEffects.push(fn);
      }
    } else {
      for (const fn of [..._subs]) fn();
    }
  };
  return () => {
    if (__currentEffect) _subs.add(__currentEffect);
    if (_dirty) {
      const prev = __currentEffect;
      __currentEffect = recompute;
      _cached = fn();
      __currentEffect = prev;
      _dirty = false;
    }
    return _cached;
  };
}

function __effect(fn) {
  let _cleanup = null;
  const run = () => {
    if (typeof _cleanup === 'function') _cleanup();
    const prev = __currentEffect;
    __currentEffect = run;
    _cleanup = fn();
    __currentEffect = prev;
  };
  run();
}

function __batch(fn) {
  __batchDepth++;
  try {
    fn();
  } finally {
    __batchDepth--;
    if (__batchDepth === 0) {
      const pending = __pendingEffects.splice(0);
      for (const f of pending) f();
    }
  }
}
`;

// ../lib/css-scoper.js
function scopeCSS(css, tagName) {
  if (!css || !css.trim()) return "";
  const result = [];
  let i = 0;
  while (i < css.length) {
    if (/\s/.test(css[i])) {
      result.push(css[i]);
      i++;
      continue;
    }
    if (css[i] === "@") {
      const atResult = consumeAtRule(css, i, tagName);
      result.push(atResult.text);
      i = atResult.end;
      continue;
    }
    if (css[i] === "}") {
      result.push("}");
      i++;
      continue;
    }
    const selectorEnd = css.indexOf("{", i);
    if (selectorEnd === -1) {
      result.push(css.slice(i));
      break;
    }
    const rawSelector = css.slice(i, selectorEnd);
    const scopedSelector = prefixSelectors(rawSelector, tagName);
    result.push(scopedSelector);
    const blockResult = consumeBlock(css, selectorEnd);
    result.push(blockResult.text);
    i = blockResult.end;
  }
  return result.join("");
}
function prefixSelectors(raw, tagName) {
  return raw.split(",").map((s) => {
    const trimmed = s.trim();
    if (!trimmed) return s;
    const leadingWs = s.match(/^(\s*)/)[1];
    return `${leadingWs}${tagName} ${trimmed}`;
  }).join(",");
}
function consumeBlock(css, start) {
  let depth = 0;
  let i = start;
  const chars = [];
  while (i < css.length) {
    chars.push(css[i]);
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        return { text: chars.join(""), end: i + 1 };
      }
    }
    i++;
  }
  return { text: chars.join(""), end: i };
}
function consumeAtRule(css, start, tagName) {
  let i = start;
  const prelude = [];
  while (i < css.length && css[i] !== "{" && css[i] !== ";") {
    prelude.push(css[i]);
    i++;
  }
  if (i >= css.length) {
    return { text: prelude.join(""), end: i };
  }
  if (css[i] === ";") {
    prelude.push(";");
    return { text: prelude.join(""), end: i + 1 };
  }
  const preludeStr = prelude.join("");
  const atName = preludeStr.trim().split(/\s/)[0];
  if (atName === "@keyframes" || atName === "@-webkit-keyframes") {
    const block = consumeBlock(css, i);
    return { text: preludeStr + block.text, end: block.end };
  }
  const innerStart = i + 1;
  let depth = 1;
  let j = innerStart;
  while (j < css.length && depth > 0) {
    if (css[j] === "{") depth++;
    if (css[j] === "}") depth--;
    if (depth > 0) j++;
  }
  const innerCSS = css.slice(innerStart, j);
  const scopedInner = scopeCSS(innerCSS, tagName);
  return {
    text: `${preludeStr}{${scopedInner}}`,
    end: j + 1
  };
}

// ../lib/codegen.js
function pathExpr(parts, rootVar) {
  return parts.length === 0 ? rootVar : rootVar + "." + parts.join(".");
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function slotPropRef(source, signalNames, computedNames, propNames) {
  if (propNames.has(source)) return `this._s_${source}()`;
  if (computedNames.includes(source)) return `this._c_${source}()`;
  if (signalNames.includes(source)) return `this._${source}()`;
  return `'${source}'`;
}
function transformExpr(expr, signalNames, computedNames, propsObjectName = null, propNames = /* @__PURE__ */ new Set(), emitsObjectName = null, constantNames = []) {
  let result = expr;
  if (emitsObjectName) {
    const emitsRe = new RegExp(`\\b${escapeRegex(emitsObjectName)}\\(`, "g");
    result = result.replace(emitsRe, "this._emit(");
  }
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, "g");
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._s_${propName}()`;
      }
      return match;
    });
  }
  for (const propName of propNames) {
    if (propsObjectName && propName === propsObjectName) continue;
    if (emitsObjectName && propName === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b(${propName})\\b(?!\\.set\\()(?!\\()`, "g");
    result = result.replace(bareRe, `this._s_${propName}()`);
  }
  for (const name of computedNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const callRe = new RegExp(`\\b${name}\\(\\)`, "g");
    result = result.replace(callRe, `this._c_${name}()`);
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, "g");
    result = result.replace(bareRe, `this._c_${name}()`);
  }
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const callRe = new RegExp(`\\b${name}\\(\\)`, "g");
    result = result.replace(callRe, `this._${name}()`);
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, "g");
    result = result.replace(bareRe, `this._${name}()`);
  }
  for (const name of constantNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b(${name})\\b(?!\\.set\\()(?!\\()`, "g");
    result = result.replace(bareRe, `this._const_${name}`);
  }
  return result;
}
function transformMethodBody(body, signalNames, computedNames, propsObjectName = null, propNames = /* @__PURE__ */ new Set(), emitsObjectName = null, refVarNames = [], constantNames = []) {
  let result = body;
  if (emitsObjectName) {
    const emitsRe = new RegExp(`\\b${escapeRegex(emitsObjectName)}\\(`, "g");
    result = result.replace(emitsRe, "this._emit(");
  }
  if (propsObjectName && propNames.size > 0) {
    const propsRe = new RegExp(`\\b${propsObjectName}\\.(\\w+)`, "g");
    result = result.replace(propsRe, (match, propName) => {
      if (propNames.has(propName)) {
        return `this._s_${propName}()`;
      }
      return match;
    });
  }
  for (const name of refVarNames) {
    const refRe = new RegExp(`\\b${name}\\.value\\b`, "g");
    result = result.replace(refRe, `this._${name}.value`);
  }
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const setRe = new RegExp(`\\b${name}\\.set\\(`, "g");
    result = result.replace(setRe, `this._${name}(`);
  }
  for (const name of computedNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, "g");
    result = result.replace(readRe, `this._c_${name}()`);
  }
  for (const name of signalNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const readRe = new RegExp(`\\b${name}\\(\\)`, "g");
    result = result.replace(readRe, `this._${name}()`);
  }
  for (const name of constantNames) {
    if (propsObjectName && name === propsObjectName) continue;
    if (emitsObjectName && name === emitsObjectName) continue;
    const bareRe = new RegExp(`\\b${name}\\b(?!\\()`, "g");
    result = result.replace(bareRe, `this._const_${name}`);
  }
  return result;
}
function transformForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames) {
  let r = expr;
  const excludeSet = /* @__PURE__ */ new Set([itemVar]);
  if (indexVar) excludeSet.add(indexVar);
  for (const p of propsSet) {
    if (excludeSet.has(p)) continue;
    r = r.replace(new RegExp(`\\b${p}\\b`, "g"), `this._s_${p}()`);
  }
  for (const n of rootVarNames) {
    if (excludeSet.has(n)) continue;
    r = r.replace(new RegExp(`\\b${n}\\b`, "g"), `this._${n}()`);
  }
  for (const n of computedNames) {
    if (excludeSet.has(n)) continue;
    r = r.replace(new RegExp(`\\b${n}\\b`, "g"), `this._c_${n}()`);
  }
  return r;
}
function isStaticForBinding(name, itemVar, indexVar) {
  if (name === itemVar || name.startsWith(itemVar + ".")) return true;
  if (indexVar && name === indexVar) return true;
  return false;
}
function isStaticForExpr(expr, itemVar, indexVar, propsSet, rootVarNames, computedNames) {
  const excludeSet = /* @__PURE__ */ new Set([itemVar]);
  if (indexVar) excludeSet.add(indexVar);
  for (const p of propsSet) {
    if (excludeSet.has(p)) continue;
    if (new RegExp(`\\b${p}\\b`).test(expr)) return false;
  }
  for (const n of rootVarNames) {
    if (excludeSet.has(n)) continue;
    if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
  }
  for (const n of computedNames) {
    if (excludeSet.has(n)) continue;
    if (new RegExp(`\\b${n}\\b`).test(expr)) return false;
  }
  return true;
}
function generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet) {
  const indent = "        ";
  for (const b of forBlock.bindings) {
    const nodeRef = pathExpr(b.path, "node");
    if (isStaticForBinding(b.name, itemVar, indexVar)) {
      lines.push(`${indent}  ${nodeRef}.textContent = ${b.name} ?? '';`);
    } else {
      const expr = transformForExpr(b.name, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push(`${indent}  __effect(() => { ${nodeRef}.textContent = ${expr} ?? ''; });`);
    }
  }
  for (const e of forBlock.events) {
    const nodeRef = pathExpr(e.path, "node");
    lines.push(`${indent}  ${nodeRef}.addEventListener('${e.event}', this._${e.handler}.bind(this));`);
  }
  for (const sb of forBlock.showBindings) {
    const nodeRef = pathExpr(sb.path, "node");
    if (isStaticForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
      lines.push(`${indent}  ${nodeRef}.style.display = (${sb.expression}) ? '' : 'none';`);
    } else {
      const expr = transformForExpr(sb.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push(`${indent}  __effect(() => { ${nodeRef}.style.display = (${expr}) ? '' : 'none'; });`);
    }
  }
  for (const ab of forBlock.attrBindings) {
    const nodeRef = pathExpr(ab.path, "node");
    if (isStaticForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet)) {
      lines.push(`${indent}  const __val_${ab.varName} = ${ab.expression};`);
      lines.push(`${indent}  if (__val_${ab.varName} != null && __val_${ab.varName} !== false) { ${nodeRef}.setAttribute('${ab.attr}', __val_${ab.varName}); }`);
    } else {
      const expr = transformForExpr(ab.expression, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push(`${indent}  __effect(() => {`);
      lines.push(`${indent}    const __val = ${expr};`);
      lines.push(`${indent}    if (__val == null || __val === false) { ${nodeRef}.removeAttribute('${ab.attr}'); }`);
      lines.push(`${indent}    else { ${nodeRef}.setAttribute('${ab.attr}', __val); }`);
      lines.push(`${indent}  });`);
    }
  }
  for (const mb of forBlock.modelBindings || []) {
    const nodeRef = pathExpr(mb.path, "node");
    lines.push(`${indent}  __effect(() => {`);
    if (mb.prop === "checked" && mb.radioValue !== null) {
      lines.push(`${indent}    ${nodeRef}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
    } else if (mb.prop === "checked") {
      lines.push(`${indent}    ${nodeRef}.checked = !!this._${mb.signal}();`);
    } else {
      lines.push(`${indent}    ${nodeRef}.value = this._${mb.signal}() ?? '';`);
    }
    lines.push(`${indent}  });`);
    if (mb.prop === "checked" && mb.radioValue === null) {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
    } else if (mb.coerce) {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
    } else {
      lines.push(`${indent}  ${nodeRef}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
    }
  }
  for (const s of forBlock.slots || []) {
    if (s.slotProps.length > 0) {
      const slotNodeRef = pathExpr(s.path, "node");
      const propsEntries = s.slotProps.map((sp) => `'${sp.prop}': ${sp.source}`).join(", ");
      lines.push(`${indent}  { const __slotEl = ${slotNodeRef};`);
      lines.push(`${indent}    const __sp = { ${propsEntries} };`);
      lines.push(`${indent}    let __h = __slotEl.innerHTML;`);
      lines.push(`${indent}    for (const [k, v] of Object.entries(__sp)) {`);
      lines.push(`${indent}      __h = __h.replace(new RegExp('\\\\{\\\\{\\\\s*' + k + '\\\\s*\\\\}\\\\}', 'g'), v ?? '');`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    __slotEl.innerHTML = __h;`);
      lines.push(`${indent}  }`);
    }
  }
}
function generateComponent(parseResult) {
  const {
    tagName,
    className,
    style,
    signals,
    computeds,
    effects,
    methods,
    bindings,
    events,
    processedTemplate,
    propDefs = [],
    propsObjectName = null,
    emits = [],
    emitsObjectName = null,
    ifBlocks = [],
    showBindings = [],
    forBlocks = [],
    onMountHooks = [],
    onDestroyHooks = [],
    modelBindings = [],
    attrBindings = [],
    slots = [],
    constantVars = [],
    watchers = [],
    refs = [],
    refBindings = [],
    childComponents = [],
    childImports = []
  } = parseResult;
  const signalNames = signals.map((s) => s.name);
  const computedNames = computeds.map((c) => c.name);
  const constantNames = constantVars.map((v) => v.name);
  const refVarNames = refs.map((r) => r.varName);
  const propNames = new Set(propDefs.map((p) => p.name));
  const lines = [];
  lines.push(reactiveRuntime.trim());
  lines.push("");
  for (const ci of childImports) {
    lines.push(`import '${ci.importPath}';`);
  }
  if (childImports.length > 0) {
    lines.push("");
  }
  if (style) {
    const scoped = scopeCSS(style, tagName);
    lines.push(`const __css_${className} = document.createElement('style');`);
    lines.push(`__css_${className}.textContent = \`${scoped}\`;`);
    lines.push(`document.head.appendChild(__css_${className});`);
    lines.push("");
  }
  lines.push(`const __t_${className} = document.createElement('template');`);
  lines.push(`__t_${className}.innerHTML = \`${processedTemplate || ""}\`;`);
  lines.push("");
  lines.push(`class ${className} extends HTMLElement {`);
  if (propDefs.length > 0) {
    const attrNames = propDefs.map((p) => `'${p.attrName}'`).join(", ");
    lines.push(`  static get observedAttributes() { return [${attrNames}]; }`);
    lines.push("");
  }
  lines.push("  constructor() {");
  lines.push("    super();");
  if (slots.length > 0) {
    lines.push("    const __slotMap = {};");
    lines.push("    const __defaultSlotNodes = [];");
    lines.push("    for (const child of Array.from(this.childNodes)) {");
    lines.push("      if (child.nodeName === 'TEMPLATE') {");
    lines.push("        for (const attr of child.attributes) {");
    lines.push("          if (attr.name.startsWith('#')) {");
    lines.push("            const slotName = attr.name.slice(1);");
    lines.push("            __slotMap[slotName] = { content: child.innerHTML, propsExpr: attr.value };");
    lines.push("          }");
    lines.push("        }");
    lines.push("      } else if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {");
    lines.push("        __defaultSlotNodes.push(child);");
    lines.push("      }");
    lines.push("    }");
  }
  lines.push(`    const __root = __t_${className}.content.cloneNode(true);`);
  for (const b of bindings) {
    lines.push(`    this.${b.varName} = ${pathExpr(b.path, "__root")};`);
  }
  for (const e of events) {
    lines.push(`    this.${e.varName} = ${pathExpr(e.path, "__root")};`);
  }
  for (const sb of showBindings) {
    lines.push(`    this.${sb.varName} = ${pathExpr(sb.path, "__root")};`);
  }
  for (const mb of modelBindings) {
    lines.push(`    this.${mb.varName} = ${pathExpr(mb.path, "__root")};`);
  }
  for (const s of slots) {
    lines.push(`    this.${s.varName} = ${pathExpr(s.path, "__root")};`);
  }
  for (const cc of childComponents) {
    lines.push(`    this.${cc.varName} = ${pathExpr(cc.path, "__root")};`);
  }
  const attrPathMap = /* @__PURE__ */ new Map();
  for (const ab of attrBindings) {
    const pathKey = ab.path.join(".");
    if (attrPathMap.has(pathKey)) {
      lines.push(`    this.${ab.varName} = this.${attrPathMap.get(pathKey)};`);
    } else {
      lines.push(`    this.${ab.varName} = ${pathExpr(ab.path, "__root")};`);
      attrPathMap.set(pathKey, ab.varName);
    }
  }
  for (const p of propDefs) {
    lines.push(`    this._s_${p.name} = __signal(${p.default});`);
  }
  for (const s of signals) {
    lines.push(`    this._${s.name} = __signal(${s.value});`);
  }
  for (const c of constantVars) {
    lines.push(`    this._const_${c.name} = ${c.value};`);
  }
  for (const c of computeds) {
    const body = transformExpr(c.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
    lines.push(`    this._c_${c.name} = __computed(() => ${body});`);
  }
  for (const w of watchers) {
    lines.push(`    this.__prev_${w.target} = undefined;`);
  }
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      lines.push(`    this.${vn}_t${i} = document.createElement('template');`);
      lines.push(`    this.${vn}_t${i}.innerHTML = \`${branch.templateHtml}\`;`);
    }
    lines.push(`    this.${vn}_anchor = ${pathExpr(ifBlock.anchorPath, "__root")};`);
    lines.push(`    this.${vn}_current = null;`);
    lines.push(`    this.${vn}_active = undefined;`);
  }
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    lines.push(`    this.${vn}_tpl = document.createElement('template');`);
    lines.push(`    this.${vn}_tpl.innerHTML = \`${forBlock.templateHtml}\`;`);
    lines.push(`    this.${vn}_anchor = ${pathExpr(forBlock.anchorPath, "__root")};`);
    lines.push(`    this.${vn}_nodes = [];`);
  }
  for (const rb of refBindings) {
    lines.push(`    this._ref_${rb.refName} = ${pathExpr(rb.path, "__root")};`);
  }
  lines.push("    this.innerHTML = '';");
  lines.push("    this.appendChild(__root);");
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      lines.push(`    if (__slotMap['${s.name}']) { this.__slotTpl_${s.name} = __slotMap['${s.name}'].content; }`);
      if (s.defaultContent) {
        lines.push(`    else { this.__slotTpl_${s.name} = \`${s.defaultContent}\`; }`);
      }
    } else if (s.name) {
      lines.push(`    if (__slotMap['${s.name}']) { this.${s.varName}.innerHTML = __slotMap['${s.name}'].content; }`);
    } else {
      lines.push(`    if (__defaultSlotNodes.length) { this.${s.varName}.textContent = ''; __defaultSlotNodes.forEach(n => this.${s.varName}.appendChild(n.cloneNode(true))); }`);
    }
  }
  lines.push("  }");
  lines.push("");
  lines.push("  connectedCallback() {");
  for (const b of bindings) {
    if (b.type === "prop") {
      lines.push("    __effect(() => {");
      lines.push(`      this.${b.varName}.textContent = this._s_${b.name}() ?? '';`);
      lines.push("    });");
    } else if (b.type === "signal") {
      lines.push("    __effect(() => {");
      lines.push(`      this.${b.varName}.textContent = this._${b.name}() ?? '';`);
      lines.push("    });");
    } else if (b.type === "computed") {
      lines.push("    __effect(() => {");
      lines.push(`      this.${b.varName}.textContent = this._c_${b.name}() ?? '';`);
      lines.push("    });");
    } else {
      lines.push("    __effect(() => {");
      lines.push(`      this.${b.varName}.textContent = this._${b.name}() ?? '';`);
      lines.push("    });");
    }
  }
  for (const s of slots) {
    if (s.name && s.slotProps.length > 0) {
      const propsObj = s.slotProps.map((sp) => {
        const ref = slotPropRef(sp.source, signalNames, computedNames, propNames);
        return `${sp.prop}: ${ref}`;
      }).join(", ");
      lines.push(`    if (this.__slotTpl_${s.name}) {`);
      lines.push("      __effect(() => {");
      lines.push(`        const __props = { ${propsObj} };`);
      lines.push(`        let __html = this.__slotTpl_${s.name};`);
      lines.push("        for (const [k, v] of Object.entries(__props)) {");
      lines.push(`          __html = __html.replace(new RegExp('\\\\{\\\\{\\\\s*' + k + '\\\\s*\\\\}\\\\}', 'g'), v ?? '');`);
      lines.push("        }");
      lines.push(`        this.${s.varName}.innerHTML = __html;`);
      lines.push("      });");
      lines.push("    }");
    }
  }
  for (const cc of childComponents) {
    for (const pb of cc.propBindings) {
      let ref;
      if (pb.type === "prop") {
        ref = `this._s_${pb.expr}()`;
      } else if (pb.type === "computed") {
        ref = `this._c_${pb.expr}()`;
      } else if (pb.type === "signal") {
        ref = `this._${pb.expr}()`;
      } else if (pb.type === "constant") {
        ref = `this._const_${pb.expr}`;
      } else {
        ref = `this._${pb.expr}()`;
      }
      lines.push("    __effect(() => {");
      lines.push(`      this.${cc.varName}.setAttribute('${pb.attr}', ${ref} ?? '');`);
      lines.push("    });");
    }
  }
  for (const eff of effects) {
    const body = transformMethodBody(eff.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    lines.push("    __effect(() => {");
    const bodyLines = body.split("\n");
    for (const line of bodyLines) {
      lines.push(`      ${line}`);
    }
    lines.push("    });");
  }
  for (const w of watchers) {
    let watchRef;
    if (propNames.has(w.target)) {
      watchRef = `this._s_${w.target}()`;
    } else if (computedNames.includes(w.target)) {
      watchRef = `this._c_${w.target}()`;
    } else {
      watchRef = `this._${w.target}()`;
    }
    const body = transformMethodBody(w.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    lines.push("    __effect(() => {");
    lines.push(`      const ${w.newParam} = ${watchRef};`);
    lines.push(`      if (this.__prev_${w.target} !== undefined) {`);
    lines.push(`        const ${w.oldParam} = this.__prev_${w.target};`);
    const bodyLines = body.split("\n");
    for (const line of bodyLines) {
      lines.push(`        ${line}`);
    }
    lines.push("      }");
    lines.push(`      this.__prev_${w.target} = ${w.newParam};`);
    lines.push("    });");
  }
  for (const e of events) {
    lines.push(`    this.${e.varName}.addEventListener('${e.event}', this._${e.handler}.bind(this));`);
  }
  for (const sb of showBindings) {
    const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
    lines.push("    __effect(() => {");
    lines.push(`      this.${sb.varName}.style.display = (${expr}) ? '' : 'none';`);
    lines.push("    });");
  }
  for (const mb of modelBindings) {
    if (mb.prop === "checked" && mb.radioValue !== null) {
      lines.push("    __effect(() => {");
      lines.push(`      this.${mb.varName}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
      lines.push("    });");
    } else if (mb.prop === "checked") {
      lines.push("    __effect(() => {");
      lines.push(`      this.${mb.varName}.checked = !!this._${mb.signal}();`);
      lines.push("    });");
    } else {
      lines.push("    __effect(() => {");
      lines.push(`      this.${mb.varName}.value = this._${mb.signal}() ?? '';`);
      lines.push("    });");
    }
  }
  for (const mb of modelBindings) {
    if (mb.prop === "checked" && mb.radioValue === null) {
      lines.push(`    this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
    } else if (mb.coerce) {
      lines.push(`    this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
    } else {
      lines.push(`    this.${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
    }
  }
  for (const ab of attrBindings) {
    const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
    if (ab.kind === "attr") {
      lines.push("    __effect(() => {");
      lines.push(`      const __v = ${expr};`);
      lines.push(`      if (__v || __v === '') { this.${ab.varName}.setAttribute('${ab.attr}', __v); }`);
      lines.push(`      else { this.${ab.varName}.removeAttribute('${ab.attr}'); }`);
      lines.push("    });");
    } else if (ab.kind === "bool") {
      lines.push("    __effect(() => {");
      lines.push(`      this.${ab.varName}.${ab.attr} = !!(${expr});`);
      lines.push("    });");
    } else if (ab.kind === "class") {
      if (ab.expression.trimStart().startsWith("{")) {
        lines.push("    __effect(() => {");
        lines.push(`      const __obj = ${expr};`);
        lines.push("      for (const [__k, __val] of Object.entries(__obj)) {");
        lines.push(`        __val ? this.${ab.varName}.classList.add(__k) : this.${ab.varName}.classList.remove(__k);`);
        lines.push("      }");
        lines.push("    });");
      } else {
        lines.push("    __effect(() => {");
        lines.push(`      this.${ab.varName}.className = ${expr};`);
        lines.push("    });");
      }
    } else if (ab.kind === "style") {
      if (ab.expression.trimStart().startsWith("{")) {
        lines.push("    __effect(() => {");
        lines.push(`      const __obj = ${expr};`);
        lines.push("      for (const [__k, __val] of Object.entries(__obj)) {");
        lines.push(`        this.${ab.varName}.style[__k] = __val;`);
        lines.push("      }");
        lines.push("    });");
      } else {
        lines.push("    __effect(() => {");
        lines.push(`      this.${ab.varName}.style.cssText = ${expr};`);
        lines.push("    });");
      }
    }
  }
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    lines.push("    __effect(() => {");
    lines.push("      let __branch = null;");
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      if (branch.type === "if") {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      if (${expr}) { __branch = ${i}; }`);
      } else if (branch.type === "else-if") {
        const expr = transformExpr(branch.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      else if (${expr}) { __branch = ${i}; }`);
      } else {
        lines.push(`      else { __branch = ${i}; }`);
      }
    }
    lines.push(`      if (__branch === this.${vn}_active) return;`);
    lines.push(`      if (this.${vn}_current) { this.${vn}_current.remove(); this.${vn}_current = null; }`);
    lines.push("      if (__branch !== null) {");
    const tplArray = ifBlock.branches.map((_, i) => `this.${vn}_t${i}`).join(", ");
    lines.push(`        const tpl = [${tplArray}][__branch];`);
    lines.push("        const clone = tpl.content.cloneNode(true);");
    lines.push("        const node = clone.firstChild;");
    lines.push(`        this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
    lines.push(`        this.${vn}_current = node;`);
    const hasSetup = ifBlock.branches.some(
      (b) => b.bindings && b.bindings.length > 0 || b.events && b.events.length > 0 || b.showBindings && b.showBindings.length > 0 || b.attrBindings && b.attrBindings.length > 0 || b.modelBindings && b.modelBindings.length > 0
    );
    if (hasSetup) {
      lines.push(`        this.${vn}_setup(node, __branch);`);
    }
    lines.push("      }");
    lines.push(`      this.${vn}_active = __branch;`);
    lines.push("    });");
  }
  for (const forBlock of forBlocks) {
    const vn = forBlock.varName;
    const { itemVar, indexVar, source, keyExpr } = forBlock;
    const signalNamesSet = new Set(signalNames);
    const computedNamesSet = new Set(computedNames);
    const sourceExpr = transformForExpr(source, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
    lines.push("    __effect(() => {");
    lines.push(`      const __source = ${sourceExpr};`);
    lines.push("");
    lines.push("      const __iter = typeof __source === 'number'");
    lines.push("        ? Array.from({ length: __source }, (_, i) => i + 1)");
    lines.push("        : (__source || []);");
    lines.push("");
    if (keyExpr) {
      lines.push(`      const __oldMap = this.${vn}_keyMap || new Map();`);
      lines.push("      const __newMap = new Map();");
      lines.push("      const __newNodes = [];");
      lines.push("");
      lines.push(`      __iter.forEach((${itemVar}, ${indexVar || "__idx"}) => {`);
      lines.push(`        const __key = ${keyExpr};`);
      lines.push("        if (__oldMap.has(__key)) {");
      lines.push("          const node = __oldMap.get(__key);");
      lines.push("          __newMap.set(__key, node);");
      lines.push("          __newNodes.push(node);");
      lines.push("          __oldMap.delete(__key);");
      lines.push("        } else {");
      lines.push(`          const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push("          const node = clone.firstChild;");
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push("          __newMap.set(__key, node);");
      lines.push("          __newNodes.push(node);");
      lines.push("        }");
      lines.push("      });");
      lines.push("");
      lines.push("      // Remove nodes no longer in the list");
      lines.push("      for (const n of __oldMap.values()) n.remove();");
      lines.push("");
      lines.push("      // Reorder: insert all nodes in correct order before anchor");
      lines.push(`      for (const n of __newNodes) this.${vn}_anchor.parentNode.insertBefore(n, this.${vn}_anchor);`);
      lines.push("");
      lines.push(`      this.${vn}_nodes = __newNodes;`);
      lines.push(`      this.${vn}_keyMap = __newMap;`);
      lines.push("    });");
    } else {
      lines.push(`      for (const n of this.${vn}_nodes) n.remove();`);
      lines.push(`      this.${vn}_nodes = [];`);
      lines.push("");
      lines.push(`      __iter.forEach((${itemVar}, ${indexVar || "__idx"}) => {`);
      lines.push(`        const clone = this.${vn}_tpl.content.cloneNode(true);`);
      lines.push("        const node = clone.firstChild;");
      generateItemSetup(lines, forBlock, itemVar, indexVar, propNames, signalNamesSet, computedNamesSet);
      lines.push(`        this.${vn}_anchor.parentNode.insertBefore(node, this.${vn}_anchor);`);
      lines.push(`        this.${vn}_nodes.push(node);`);
      lines.push("      });");
      lines.push("    });");
    }
  }
  for (const hook of onMountHooks) {
    const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    if (hook.async) {
      lines.push("    (async () => {");
      const bodyLines = body.split("\n");
      for (const line of bodyLines) {
        lines.push(`      ${line}`);
      }
      lines.push("    })();");
    } else {
      const bodyLines = body.split("\n");
      for (const line of bodyLines) {
        lines.push(`    ${line}`);
      }
    }
  }
  lines.push("  }");
  lines.push("");
  if (onDestroyHooks.length > 0) {
    lines.push("  disconnectedCallback() {");
    for (const hook of onDestroyHooks) {
      const body = transformMethodBody(hook.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
      if (hook.async) {
        lines.push("    (async () => {");
        const bodyLines = body.split("\n");
        for (const line of bodyLines) {
          lines.push(`      ${line}`);
        }
        lines.push("    })();");
      } else {
        const bodyLines = body.split("\n");
        for (const line of bodyLines) {
          lines.push(`    ${line}`);
        }
      }
    }
    lines.push("  }");
    lines.push("");
  }
  if (propDefs.length > 0) {
    lines.push("  attributeChangedCallback(name, oldVal, newVal) {");
    for (const p of propDefs) {
      const defaultVal = p.default;
      let updateExpr;
      if (defaultVal === "true" || defaultVal === "false") {
        updateExpr = `this._s_${p.name}(newVal != null)`;
      } else if (/^-?\d+(\.\d+)?$/.test(defaultVal)) {
        updateExpr = `this._s_${p.name}(newVal != null ? Number(newVal) : ${defaultVal})`;
      } else if (defaultVal === "undefined") {
        updateExpr = `this._s_${p.name}(newVal)`;
      } else {
        updateExpr = `this._s_${p.name}(newVal ?? ${defaultVal})`;
      }
      lines.push(`    if (name === '${p.attrName}') ${updateExpr};`);
    }
    lines.push("  }");
    lines.push("");
    for (const p of propDefs) {
      lines.push(`  get ${p.name}() { return this._s_${p.name}(); }`);
      lines.push(`  set ${p.name}(val) { this._s_${p.name}(val); this.setAttribute('${p.attrName}', String(val)); }`);
      lines.push("");
    }
  }
  if (emits.length > 0) {
    lines.push("  _emit(name, detail) {");
    lines.push("    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));");
    lines.push("  }");
    lines.push("");
  }
  for (const m of methods) {
    const body = transformMethodBody(m.body, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, refVarNames, constantNames);
    lines.push(`  _${m.name}(${m.params}) {`);
    const bodyLines = body.split("\n");
    for (const line of bodyLines) {
      lines.push(`    ${line}`);
    }
    lines.push("  }");
    lines.push("");
  }
  for (const rd of refs) {
    const rb = refBindings.find((b) => b.refName === rd.refName);
    if (rb) {
      lines.push(`  get _${rd.varName}() { return { value: this._ref_${rd.refName} }; }`);
      lines.push("");
    }
  }
  for (const ifBlock of ifBlocks) {
    const vn = ifBlock.varName;
    const hasSetup = ifBlock.branches.some(
      (b) => b.bindings && b.bindings.length > 0 || b.events && b.events.length > 0 || b.showBindings && b.showBindings.length > 0 || b.attrBindings && b.attrBindings.length > 0 || b.modelBindings && b.modelBindings.length > 0
    );
    if (!hasSetup) continue;
    lines.push(`  ${vn}_setup(node, branch) {`);
    for (let i = 0; i < ifBlock.branches.length; i++) {
      const branch = ifBlock.branches[i];
      const hasBranchSetup = branch.bindings && branch.bindings.length > 0 || branch.events && branch.events.length > 0 || branch.showBindings && branch.showBindings.length > 0 || branch.attrBindings && branch.attrBindings.length > 0 || branch.modelBindings && branch.modelBindings.length > 0;
      if (!hasBranchSetup) continue;
      const keyword = i === 0 ? "if" : "else if";
      lines.push(`    ${keyword} (branch === ${i}) {`);
      for (const b of branch.bindings) {
        lines.push(`      const ${b.varName} = ${pathExpr(b.path, "node")};`);
        if (b.type === "prop") {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._s_${b.name}() ?? ''; });`);
        } else if (b.type === "signal") {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._${b.name}() ?? ''; });`);
        } else if (b.type === "computed") {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._c_${b.name}() ?? ''; });`);
        } else {
          lines.push(`      __effect(() => { ${b.varName}.textContent = this._${b.name}() ?? ''; });`);
        }
      }
      for (const e of branch.events) {
        lines.push(`      const ${e.varName} = ${pathExpr(e.path, "node")};`);
        lines.push(`      ${e.varName}.addEventListener('${e.event}', this._${e.handler}.bind(this));`);
      }
      for (const sb of branch.showBindings) {
        const expr = transformExpr(sb.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      const ${sb.varName} = ${pathExpr(sb.path, "node")};`);
        lines.push(`      __effect(() => { ${sb.varName}.style.display = (${expr}) ? '' : 'none'; });`);
      }
      for (const ab of branch.attrBindings) {
        const expr = transformExpr(ab.expression, signalNames, computedNames, propsObjectName, propNames, emitsObjectName, constantNames);
        lines.push(`      const ${ab.varName} = ${pathExpr(ab.path, "node")};`);
        lines.push(`      __effect(() => {`);
        lines.push(`        const __val = ${expr};`);
        lines.push(`        if (__val == null || __val === false) { ${ab.varName}.removeAttribute('${ab.attr}'); }`);
        lines.push(`        else { ${ab.varName}.setAttribute('${ab.attr}', __val); }`);
        lines.push(`      });`);
      }
      for (const mb of branch.modelBindings || []) {
        const nodeRef = pathExpr(mb.path, "node");
        lines.push(`      const ${mb.varName} = ${nodeRef};`);
        lines.push(`      __effect(() => {`);
        if (mb.prop === "checked" && mb.radioValue !== null) {
          lines.push(`        ${mb.varName}.checked = (this._${mb.signal}() === '${mb.radioValue}');`);
        } else if (mb.prop === "checked") {
          lines.push(`        ${mb.varName}.checked = !!this._${mb.signal}();`);
        } else {
          lines.push(`        ${mb.varName}.value = this._${mb.signal}() ?? '';`);
        }
        lines.push(`      });`);
        if (mb.prop === "checked" && mb.radioValue === null) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.checked); });`);
        } else if (mb.coerce) {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(Number(e.target.value)); });`);
        } else {
          lines.push(`      ${mb.varName}.addEventListener('${mb.event}', (e) => { this._${mb.signal}(e.target.value); });`);
        }
      }
      lines.push("    }");
    }
    lines.push("  }");
    lines.push("");
  }
  lines.push("}");
  lines.push("");
  lines.push(`customElements.define('${tagName}', ${className});`);
  return lines.join("\n");
}

// ../lib/types.js
var BOOLEAN_ATTRIBUTES = /* @__PURE__ */ new Set([
  "disabled",
  "checked",
  "hidden",
  "readonly",
  "required",
  "selected",
  "multiple",
  "autofocus",
  "autoplay",
  "controls",
  "loop",
  "muted",
  "open",
  "novalidate"
]);

// ../lib/compiler-browser.js
function createRoot(html) {
  const doc = new DOMParser().parseFromString(
    `<html><body><div id="__root">${html}</div></body></html>`,
    "text/html"
  );
  return doc.getElementById("__root");
}
function walkTree(rootEl, signalNames, computedNames, propNames = /* @__PURE__ */ new Set()) {
  const bindings = [];
  const events = [];
  const showBindings = [];
  const modelBindings = [];
  const attrBindings = [];
  const slots = [];
  const childComponents = [];
  let bindIdx = 0, eventIdx = 0, showIdx = 0, modelIdx = 0, attrIdx = 0, slotIdx = 0, childIdx = 0;
  function bindingType(name) {
    if (propNames.has(name)) return "prop";
    if (signalNames.has(name)) return "signal";
    if (computedNames.has(name)) return "computed";
    return "method";
  }
  function walk(node, pathParts) {
    if (node.nodeType === 1) {
      const el = node;
      if (el.tagName === "SLOT") {
        const slotName = el.getAttribute("name") || "";
        const varName = `__s${slotIdx++}`;
        const defaultContent = el.innerHTML.trim();
        const slotProps = [];
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith(":")) slotProps.push({ prop: attr.name.slice(1), source: attr.value });
        }
        slots.push({ varName, name: slotName, path: [...pathParts], defaultContent, slotProps });
        const placeholder = el.ownerDocument.createElement("span");
        placeholder.setAttribute("data-slot", slotName || "default");
        if (defaultContent) placeholder.innerHTML = defaultContent;
        el.parentNode.replaceChild(placeholder, el);
        return;
      }
      const tagLower = el.tagName.toLowerCase();
      if (tagLower.includes("-") && tagLower !== rootEl.tagName?.toLowerCase()) {
        const propBindings = [];
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith("@") || attr.name.startsWith(":") || attr.name.startsWith("bind:")) continue;
          if (["show", "model", "if", "else-if", "else", "each", "ref"].includes(attr.name)) continue;
          const interpMatch = attr.value.match(/^\{\{([\w.]+)\}\}$/);
          if (interpMatch) {
            const expr = interpMatch[1];
            propBindings.push({
              attr: attr.name,
              expr,
              type: propNames.has(expr) ? "prop" : signalNames.has(expr) ? "signal" : computedNames.has(expr) ? "computed" : "method"
            });
            el.setAttribute(attr.name, "");
          }
        }
        if (propBindings.length > 0) {
          childComponents.push({ tag: tagLower, varName: `__child${childIdx++}`, path: [...pathParts], propBindings });
        }
      }
      const attrsToRemove = [];
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith("@")) {
          events.push({ varName: `__e${eventIdx++}`, event: attr.name.slice(1), handler: attr.value, path: [...pathParts] });
          attrsToRemove.push(attr.name);
        } else if (attr.name.startsWith(":") || attr.name.startsWith("bind:")) {
          const attrName = attr.name.startsWith(":") ? attr.name.slice(1) : attr.name.slice(5);
          let kind = "attr";
          if (attrName === "class") kind = "class";
          else if (attrName === "style") kind = "style";
          else if (BOOLEAN_ATTRIBUTES.has(attrName)) kind = "bool";
          attrBindings.push({ varName: `__attr${attrIdx++}`, attr: attrName, expression: attr.value, kind, path: [...pathParts] });
          attrsToRemove.push(attr.name);
        }
      }
      attrsToRemove.forEach((a) => el.removeAttribute(a));
      if (el.hasAttribute("show")) {
        showBindings.push({ varName: `__show${showIdx++}`, expression: el.getAttribute("show"), path: [...pathParts] });
        el.removeAttribute("show");
      }
      if (el.hasAttribute("model")) {
        const signalName = el.getAttribute("model");
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute("type") || "text";
        let prop, event, coerce = false, radioValue = null;
        if (tag === "select") {
          prop = "value";
          event = "change";
        } else if (tag === "textarea") {
          prop = "value";
          event = "input";
        } else if (type === "checkbox") {
          prop = "checked";
          event = "change";
        } else if (type === "radio") {
          prop = "checked";
          event = "change";
          radioValue = el.getAttribute("value");
        } else if (type === "number") {
          prop = "value";
          event = "input";
          coerce = true;
        } else {
          prop = "value";
          event = "input";
        }
        modelBindings.push({ varName: `__model${modelIdx++}`, signal: signalName, prop, event, coerce, radioValue, path: [...pathParts] });
        el.removeAttribute("model");
      }
    }
    if (node.nodeType === 3 && /\{\{[\w.]+\}\}/.test(node.textContent)) {
      const text = node.textContent;
      const trimmed = text.trim();
      const soleMatch = trimmed.match(/^\{\{([\w.]+)\}\}$/);
      const parent = node.parentNode;
      if (soleMatch && parent.childNodes.length === 1) {
        bindings.push({ varName: `__b${bindIdx++}`, name: soleMatch[1], type: bindingType(soleMatch[1]), path: pathParts.slice(0, -1) });
        parent.textContent = "";
        return;
      }
      const doc = node.ownerDocument;
      const fragment = doc.createDocumentFragment();
      const parts = text.split(/(\{\{[\w.]+\}\})/);
      const parentPath = pathParts.slice(0, -1);
      let baseIndex = 0;
      for (const child of parent.childNodes) {
        if (child === node) break;
        baseIndex++;
      }
      let offset = 0;
      for (const part of parts) {
        const bm = part.match(/^\{\{([\w.]+)\}\}$/);
        if (bm) {
          fragment.appendChild(doc.createElement("span"));
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
      if (item.path && item.path.length > 0 && item.path[0].startsWith("childNodes[")) {
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
      const hasIf = el.hasAttribute("if");
      const hasElseIf = el.hasAttribute("else-if");
      const hasElse = el.hasAttribute("else");
      if (hasIf) {
        if (currentChain) {
          ifBlocks.push(buildIfBlock(currentChain, node, currentPath, ifIdx++, signalNames, computedNames, propNames));
          currentChain = null;
        }
        currentChain = { elements: [el], branches: [{ type: "if", expression: el.getAttribute("if"), element: el }] };
      } else if (hasElseIf && currentChain) {
        currentChain.elements.push(el);
        currentChain.branches.push({ type: "else-if", expression: el.getAttribute("else-if"), element: el });
      } else if (hasElse && currentChain) {
        currentChain.elements.push(el);
        currentChain.branches.push({ type: "else", expression: null, element: el });
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
  const branches = chain.branches.map((branch) => {
    const clone = branch.element.cloneNode(true);
    clone.removeAttribute("if");
    clone.removeAttribute("else-if");
    clone.removeAttribute("else");
    const { bindings, events, showBindings, attrBindings, modelBindings, slots, processedHtml } = walkBranch(clone.outerHTML, signalNames, computedNames, propNames);
    return { type: branch.type, expression: branch.expression, templateHtml: processedHtml, bindings, events, showBindings, attrBindings, modelBindings, slots };
  });
  const comment = doc.createComment(" if ");
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
    throw new Error("Invalid each expression: " + expr);
  }
  function find(node, currentPath) {
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType !== 1) continue;
      const el = child;
      if (el.hasAttribute("each")) {
        const { itemVar, indexVar, source } = parseEach(el.getAttribute("each"));
        const keyExpr = el.hasAttribute(":key") ? el.getAttribute(":key") : null;
        const clone = el.cloneNode(true);
        clone.removeAttribute("each");
        clone.removeAttribute(":key");
        const { bindings, events, showBindings, attrBindings, modelBindings, slots, processedHtml } = walkBranch(clone.outerHTML, signalNames, computedNames, propNames);
        const doc = node.ownerDocument;
        const comment = doc.createComment(" each ");
        node.replaceChild(comment, el);
        const updatedChildren = Array.from(node.childNodes);
        const commentIndex = updatedChildren.indexOf(comment);
        forBlocks.push({
          varName: `__for${forIdx++}`,
          itemVar,
          indexVar,
          source,
          keyExpr,
          templateHtml: processedHtml,
          anchorPath: [...currentPath, `childNodes[${commentIndex}]`],
          _anchorNode: comment,
          bindings,
          events,
          showBindings,
          attrBindings,
          modelBindings,
          slots
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
  const elements = rootEl.querySelectorAll("[ref]");
  for (const el of elements) {
    const refName = el.getAttribute("ref");
    const path = [];
    let current = el;
    while (current && current !== rootEl) {
      const parent = current.parentNode;
      if (!parent) break;
      const children = Array.from(parent.childNodes);
      path.unshift(`childNodes[${children.indexOf(current)}`);
      current = parent;
    }
    el.removeAttribute("ref");
    refBindings.push({ refName, path });
  }
  return refBindings;
}
async function compileFromStrings({ script, template, style = "", tag, lang = "js", stripTypes }) {
  const className = toClassName(tag);
  let source = stripMacroImport(script);
  const propsFromGeneric = extractPropsGeneric(source);
  const propsObjectNameFromGeneric = extractPropsObjectName(source);
  const emitsFromCallSignatures = extractEmitsFromCallSignatures(source);
  const emitsObjectNameGenericMatch = source.match(/(?:const|let|var)\s+([$\w]+)\s*=\s*defineEmits\s*<\s*\{/);
  const emitsObjectNameFromGeneric = emitsObjectNameGenericMatch ? emitsObjectNameGenericMatch[1] : null;
  if (lang === "ts" && stripTypes) {
    source = await stripTypes(source);
  }
  const { onMountHooks, onDestroyHooks } = extractLifecycleHooks(source);
  const hookLinePattern = /\bonMount\s*\(|\bonDestroy\s*\(|\bwatch\s*\(/;
  const sourceLines = source.split("\n");
  const filteredLines = [];
  let skipDepth = 0, skipping = false;
  for (const line of sourceLines) {
    if (!skipping && hookLinePattern.test(line)) {
      skipping = true;
      skipDepth = 0;
      for (const ch of line) {
        if (ch === "{") skipDepth++;
        if (ch === "}") skipDepth--;
      }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    if (skipping) {
      for (const ch of line) {
        if (ch === "{") skipDepth++;
        if (ch === "}") skipDepth--;
      }
      if (skipDepth <= 0) skipping = false;
      continue;
    }
    filteredLines.push(line);
  }
  const src = filteredLines.join("\n");
  const signals = extractSignals(src);
  const computeds = extractComputeds(src);
  const effects = extractEffects(src);
  const watchers = extractWatchers(source);
  const methods = extractFunctions(src);
  const refs = extractRefs(src);
  const constantVars = extractConstants(src);
  const propsFromArray = propsFromGeneric.length > 0 ? [] : extractPropsArray(source);
  let propNames = propsFromGeneric.length > 0 ? propsFromGeneric : propsFromArray;
  const propsDefaults = extractPropsDefaults(source);
  if (propNames.length === 0 && Object.keys(propsDefaults).length > 0) propNames = Object.keys(propsDefaults);
  const propsObjectName = propsObjectNameFromGeneric ?? extractPropsObjectName(source);
  const propDefs = propNames.map((name) => ({ name, default: propsDefaults[name] ?? "undefined", attrName: camelToKebab(name) }));
  const emitsFromArray = emitsFromCallSignatures.length > 0 ? [] : extractEmits(source);
  const emitNames = emitsFromCallSignatures.length > 0 ? emitsFromCallSignatures : emitsFromArray;
  const emitsObjectName = emitsObjectNameFromGeneric ?? extractEmitsObjectName(source);
  const rootEl = createRoot(template);
  const signalNameSet = new Set(signals.map((s) => s.name));
  const computedNameSet = new Set(computeds.map((c) => c.name));
  const propNameSet = new Set(propDefs.map((p) => p.name));
  const forBlocks = processForBlocks(rootEl, [], signalNameSet, computedNameSet, propNameSet);
  const ifBlocks = processIfChains(rootEl, [], signalNameSet, computedNameSet, propNameSet);
  rootEl.normalize();
  for (const fb of forBlocks) fb.anchorPath = recomputeAnchorPath(rootEl, fb._anchorNode);
  for (const ib of ifBlocks) ib.anchorPath = recomputeAnchorPath(rootEl, ib._anchorNode);
  const { bindings, events, showBindings, modelBindings, attrBindings, slots, childComponents } = walkTree(rootEl, signalNameSet, computedNameSet, propNameSet);
  const refBindings = detectRefs(rootEl);
  return generateComponent({
    tagName: tag,
    className,
    template,
    style,
    signals,
    computeds,
    effects,
    constantVars,
    watchers,
    methods,
    propDefs,
    propsObjectName: propsObjectName ?? null,
    emits: emitNames,
    emitsObjectName: emitsObjectName ?? null,
    bindings,
    events,
    showBindings,
    modelBindings,
    attrBindings,
    ifBlocks,
    forBlocks,
    slots,
    onMountHooks,
    onDestroyHooks,
    refs,
    refBindings,
    childComponents,
    childImports: [],
    processedTemplate: rootEl.innerHTML
  });
}
export {
  compileFromStrings
};
