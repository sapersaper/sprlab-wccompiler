import { compileFromStrings } from '../dist/wcc-compiler.js';
import { presets } from './presets.js';

// ── State ───────────────────────────────────────────────────────────

let currentPreset = 'counter';
let editorContent = {
  script: '',
  template: '',
  style: '',
};
let activeLeftTab = 'script';
let activeRightTab = 'output';
let compileTimer = null;

// ── LocalStorage persistence for blank preset ───────────────────────

const BLANK_STORAGE_KEY = 'wcc-playground-blank';

function saveBlankContent() {
  if (currentPreset === 'blank') {
    localStorage.setItem(BLANK_STORAGE_KEY, JSON.stringify(editorContent));
  }
}

function loadBlankContent() {
  try {
    const saved = localStorage.getItem(BLANK_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

// ── DOM refs ────────────────────────────────────────────────────────

const presetSelect = document.getElementById('preset-select');
const statusEl = document.getElementById('status');
const outputText = document.getElementById('output-text');
const previewFrame = document.getElementById('preview-frame');
const errorDisplay = document.getElementById('error-display');

const editors = {
  script: document.getElementById('editor-script'),
  template: document.getElementById('editor-template'),
  style: document.getElementById('editor-style'),
};

// ── Simple code editors (textarea-based, no Monaco for now) ─────────

function createEditors() {
  for (const [key, container] of Object.entries(editors)) {
    const textarea = document.createElement('textarea');
    textarea.spellcheck = false;
    textarea.style.cssText = `
      width: 100%; height: 100%; resize: none; border: none; outline: none;
      background: #1e1e1e; color: #d4d4d4; padding: 12px;
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 13px; line-height: 1.5; tab-size: 2;
    `;
    textarea.addEventListener('input', () => {
      editorContent[key] = textarea.value;
      saveBlankContent();
      scheduleCompile();
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(textarea.selectionEnd);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        editorContent[key] = textarea.value;
        saveBlankContent();
        scheduleCompile();
      }
    });
    container.appendChild(textarea);
    container._textarea = textarea;
  }
}

function setEditorContent(key, value) {
  editorContent[key] = value;
  if (editors[key]._textarea) {
    editors[key]._textarea.value = value;
  }
}

// ── Tab switching ───────────────────────────────────────────────────

document.querySelectorAll('#left-pane .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeLeftTab = tab.dataset.tab;
    document.querySelectorAll('#left-pane .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Object.entries(editors).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== activeLeftTab);
    });
  });
});

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
      setEditorContent('script', saved.script || preset.script);
      setEditorContent('template', saved.template || preset.template);
      setEditorContent('style', saved.style || preset.style);
      compile();
      return;
    }
  }

  setEditorContent('script', preset.script);
  setEditorContent('template', preset.template);
  setEditorContent('style', preset.style);
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
  const preset = presets[currentPreset];
  if (!preset) return;

  statusEl.textContent = 'Compiling...';
  statusEl.style.color = '#dcdcaa';

  try {
    const output = await compileFromStrings({
      script: editorContent.script,
      template: editorContent.template,
      style: editorContent.style,
      tag: preset.tag,
      lang: preset.lang || 'js',
    });

    outputText.textContent = output;
    errorDisplay.classList.add('hidden');
    updatePreview(output, preset.tag);

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

createEditors();
loadPreset('counter');
