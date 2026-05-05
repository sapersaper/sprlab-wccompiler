import { compileFromSFC } from '../dist/wcc-compiler.js';
import { presets } from './presets.js';

// ── State ───────────────────────────────────────────────────────────

let currentPreset = 'counter';
let editorContent = '';
let activeRightTab = 'output';
let compileTimer = null;

// ── LocalStorage persistence for blank preset ───────────────────────

const BLANK_STORAGE_KEY = 'wcc-playground-blank';

function saveBlankContent() {
  if (currentPreset === 'blank') {
    localStorage.setItem(BLANK_STORAGE_KEY, editorContent);
  }
}

function loadBlankContent() {
  try {
    return localStorage.getItem(BLANK_STORAGE_KEY);
  } catch {}
  return null;
}

// ── DOM refs ────────────────────────────────────────────────────────

const presetSelect = document.getElementById('preset-select');
const statusEl = document.getElementById('status');
const outputText = document.getElementById('output-text');
const previewFrame = document.getElementById('preview-frame');
const errorDisplay = document.getElementById('error-display');
const editorContainer = document.getElementById('editor-wcc');

// ── Single code editor (textarea-based) ─────────────────────────────

let textarea;

function createEditor() {
  textarea = document.createElement('textarea');
  textarea.spellcheck = false;
  textarea.style.cssText = `
    width: 100%; height: 100%; resize: none; border: none; outline: none;
    background: #1e1e1e; color: #d4d4d4; padding: 12px;
    font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
    font-size: 13px; line-height: 1.5; tab-size: 2;
  `;
  textarea.addEventListener('input', () => {
    editorContent = textarea.value;
    saveBlankContent();
    scheduleCompile();
  });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(textarea.selectionEnd);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      editorContent = textarea.value;
      saveBlankContent();
      scheduleCompile();
    }
  });
  editorContainer.appendChild(textarea);
}

function setEditorContent(value) {
  editorContent = value;
  if (textarea) {
    textarea.value = value;
  }
}

// ── Tab switching (right pane only) ─────────────────────────────────

document.querySelectorAll('#right-pane .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeRightTab = tab.dataset.tab;
    document.querySelectorAll('#right-pane .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    outputText.classList.toggle('hidden', activeRightTab !== 'output');
    previewFrame.classList.toggle('hidden', activeRightTab !== 'preview');
    errorDisplay.classList.add('hidden');
  });
});

// ── Preset loading ──────────────────────────────────────────────────

function loadPreset(name) {
  const preset = presets[name];
  if (!preset) return;
  currentPreset = name;

  // For blank: restore from localStorage if available
  if (name === 'blank') {
    const saved = loadBlankContent();
    if (saved) {
      setEditorContent(saved);
      compile();
      return;
    }
  }

  setEditorContent(preset.source);
  compile();
}

presetSelect.addEventListener('change', () => {
  loadPreset(presetSelect.value);
});

// ── Compilation ─────────────────────────────────────────────────────

function scheduleCompile() {
  if (compileTimer) clearTimeout(compileTimer);
  compileTimer = setTimeout(compile, 500);
}

async function compile() {
  statusEl.textContent = 'Compiling...';
  statusEl.style.color = '#dcdcaa';

  try {
    const output = await compileFromSFC(editorContent);

    outputText.textContent = output;
    errorDisplay.classList.add('hidden');

    // Extract tag name from the source for preview
    const tagMatch = editorContent.match(/tag:\s*['"]([^'"]+)['"]/);
    const tagName = tagMatch ? tagMatch[1] : 'wcc-app';
    updatePreview(output, tagName);

    statusEl.textContent = 'Compiled successfully';
    statusEl.style.color = '#6a9955';
  } catch (err) {
    outputText.textContent = '';
    errorDisplay.textContent = err.message;
    errorDisplay.classList.remove('hidden');

    statusEl.textContent = 'Compilation error';
    statusEl.style.color = '#f44747';
  }
}

function updatePreview(compiledJS, tagName) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; margin: 0; }
  </style>
</head>
<body>
  <${tagName}></${tagName}>
  <script type="module">${compiledJS}<\/script>
</body>
</html>`;

  previewFrame.srcdoc = html;
}

// ── Init ────────────────────────────────────────────────────────────

createEditor();
loadPreset('counter');
