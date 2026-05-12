import { createServer, createConnection, createTypeScriptProject } from '@volar/language-server/node';
import { create as createTsService } from 'volar-service-typescript';
import { create as createHtmlService } from 'volar-service-html';
import { create as createCssService } from 'volar-service-css';
import { newHTMLDataProvider } from 'vscode-html-languageservice';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { wccLanguagePlugin } from './languagePlugin';
import { parseWccBlocks } from './wccParser';

const connection = createConnection();
const server = createServer(connection);

// ── Scan workspace for .wcc component metadata ──────────────────────

function extractPropsFromScript(s: string): { name: string; type: string }[] {
  const props: { name: string; type: string }[] = [];
  const gm = s.match(/defineProps\s*<\s*\{([^}]+)\}\s*>/);
  if (gm) { const re = /(\w+)\s*[?]?\s*:\s*([^,;\n}]+)/g; let m; while ((m = re.exec(gm[1])) !== null) props.push({ name: m[1], type: m[2].trim() }); if (props.length) return props; }
  const om = s.match(/defineProps\(\s*\{([^}]+)\}\s*\)/);
  if (om) { const re = /(\w+)\s*:\s*([^,}]+)/g; let m; while ((m = re.exec(om[1])) !== null) { const v = m[2].trim(); let t = 'any'; if (/^['"]/.test(v)) t = 'string'; else if (/^\d/.test(v)) t = 'number'; else if (v === 'true' || v === 'false') t = 'boolean'; props.push({ name: m[1], type: t }); } if (props.length) return props; }
  const am = s.match(/defineProps\(\s*\[([^\]]+)\]\s*\)/);
  if (am) { const re = /['"](\w+)['"]/g; let m; while ((m = re.exec(am[1])) !== null) props.push({ name: m[1], type: 'any' }); }
  return props;
}

function extractEventsFromScript(s: string): string[] {
  const events: string[] = [];
  const gm = s.match(/defineEmits\s*<\s*\{([^}]+)\}\s*>/);
  if (gm) { const re = /\(\s*e\s*:\s*['"]([^'"]+)['"]/g; let m; while ((m = re.exec(gm[1])) !== null) events.push(m[1]); if (events.length) return events; }
  const am = s.match(/defineEmits\(\s*\[([^\]]+)\]\s*\)/);
  if (am) { const re = /['"]([^'"]+)['"]/g; let m; while ((m = re.exec(am[1])) !== null) events.push(m[1]); }
  return events;
}

function scanWccFiles(dir: string): { tag: string; props: { name: string; type: string }[]; events: string[] }[] {
  const results: { tag: string; props: { name: string; type: string }[]; events: string[] }[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.wcc')) {
        try {
          const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
          const parsed = parseWccBlocks(content);
          if (!parsed.script) continue;
          const tagMatch = parsed.script.content.match(/tag\s*:\s*['"]([^'"]+)['"]/);
          if (!tagMatch) continue;
          results.push({
            tag: tagMatch[1],
            props: extractPropsFromScript(parsed.script.content),
            events: extractEventsFromScript(parsed.script.content),
          });
        } catch {}
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        results.push(...scanWccFiles(path.join(dir, entry.name)));
      }
    }
  } catch {}
  return results;
}

// ── Common DOM events ────────────────────────────────────────────────

/** DOM events that should be suggested on any element via @event syntax */
const COMMON_DOM_EVENTS = [
  { name: 'click', description: 'Fired when the element is clicked' },
  { name: 'dblclick', description: 'Fired on double click' },
  { name: 'input', description: 'Fired when the value of an input changes' },
  { name: 'change', description: 'Fired when the value is committed (blur/enter)' },
  { name: 'submit', description: 'Fired when a form is submitted' },
  { name: 'focus', description: 'Fired when the element receives focus' },
  { name: 'blur', description: 'Fired when the element loses focus' },
  { name: 'keydown', description: 'Fired when a key is pressed down' },
  { name: 'keyup', description: 'Fired when a key is released' },
  { name: 'keypress', description: 'Fired when a key produces a character' },
  { name: 'mouseenter', description: 'Fired when pointer enters the element' },
  { name: 'mouseleave', description: 'Fired when pointer leaves the element' },
  { name: 'mouseover', description: 'Fired when pointer moves over the element' },
  { name: 'mouseout', description: 'Fired when pointer moves out of the element' },
  { name: 'mousedown', description: 'Fired when a mouse button is pressed' },
  { name: 'mouseup', description: 'Fired when a mouse button is released' },
  { name: 'contextmenu', description: 'Fired on right-click' },
  { name: 'touchstart', description: 'Fired when a touch point is placed' },
  { name: 'touchend', description: 'Fired when a touch point is removed' },
  { name: 'touchmove', description: 'Fired when a touch point moves' },
  { name: 'scroll', description: 'Fired when the element is scrolled' },
  { name: 'wheel', description: 'Fired on mouse wheel/trackpad scroll' },
  { name: 'dragstart', description: 'Fired when drag operation begins' },
  { name: 'dragend', description: 'Fired when drag operation ends' },
  { name: 'drop', description: 'Fired when an element is dropped' },
  { name: 'dragover', description: 'Fired when dragged element is over a drop target' },
];

// ── WCC directives ──────────────────────────────────────────────────

/** Global attributes for WCC directives (available on any element) */
const WCC_GLOBAL_ATTRIBUTES = [
  { name: 'ref', description: { kind: 'markdown', value: '(wcc) Template element reference — use with `templateRef(\'name\')`' } },
  { name: 'show', description: { kind: 'markdown', value: '(wcc) Conditional visibility — `show="expression"`' } },
  { name: 'if', description: { kind: 'markdown', value: '(wcc) Conditional rendering — `if="expression"`' } },
  { name: 'else-if', description: { kind: 'markdown', value: '(wcc) Conditional branch — `else-if="expression"`' } },
  { name: 'else', description: { kind: 'markdown', value: '(wcc) Fallback branch — `else`' } },
  { name: 'each', description: { kind: 'markdown', value: '(wcc) List rendering — `each="item in items()"` or `each="(item, index) in items()"`' } },
];

/** Attributes specific to form elements */
const WCC_FORM_ATTRIBUTES = [
  { name: 'model', description: { kind: 'markdown', value: '(wcc) Two-way binding — `model="signalName"`' } },
];

// ── Server ──────────────────────────────────────────────────────────

connection.onInitialize((params) => {
  // Scan workspace for WCC components
  const workspacePaths = (params.workspaceFolders || []).map(f => {
    const uri = f.uri;
    return uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;
  });

  // Log for debugging
  try { fs.writeFileSync('/tmp/wcc-server.log', `workspacePaths: ${JSON.stringify(workspacePaths)}\n`); } catch {}

  // Build HTML custom data from .wcc files
  const tags: any[] = [];

  function kebabToPascal(tag: string): string {
    return tag.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
  }

  function buildTagEntries(comp: { tag: string; props: { name: string; type: string }[]; events: string[] }) {
    const attributes = [
      // Props: static and dynamic bindings
      ...comp.props.map(p => ({ name: p.name, description: { kind: 'markdown', value: `(prop) \`${p.type}\` — static value` } })),
      ...comp.props.map(p => ({ name: `:${p.name}`, description: { kind: 'markdown', value: `(prop) \`${p.type}\` — dynamic binding` } })),
      // Custom events from defineEmits
      ...comp.events.map(e => ({ name: `@${e}`, description: { kind: 'markdown', value: `(event) custom — from \`defineEmits\`` } })),
      // Common DOM events
      ...COMMON_DOM_EVENTS.map(e => ({ name: `@${e.name}`, description: { kind: 'markdown', value: `(event) DOM — ${e.description}` } })),
      // model:propName for two-way binding on custom elements
      ...comp.props.map(p => ({ name: `model:${p.name}`, description: { kind: 'markdown', value: `(model) \`${p.type}\` — two-way binding to \`${p.name}\`` } })),
      // WCC directives
      ...WCC_GLOBAL_ATTRIBUTES,
    ];
    // Add both kebab-case and PascalCase variants
    tags.push({ name: comp.tag, attributes, void: false });
    tags.push({ name: kebabToPascal(comp.tag), attributes, void: true }); // void=true enables self-closing suggestion
  }

  for (const folder of workspacePaths) {
    // Search in src/ directly
    const srcDir = path.join(folder, 'src');
    if (fs.existsSync(srcDir)) {
      for (const comp of scanWccFiles(srcDir)) {
        buildTagEntries(comp);
      }
    }

    // Also search in subdirectories that have src/ (monorepo support)
    try {
      const entries = fs.readdirSync(folder, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          const subSrc = path.join(folder, entry.name, 'src');
          if (fs.existsSync(subSrc)) {
            for (const comp of scanWccFiles(subSrc)) {
              if (!tags.find(t => t.name === comp.tag)) {
                buildTagEntries(comp);
              }
            }
          }
        }
      }
    } catch {}
  }

  try { fs.appendFileSync('/tmp/wcc-server.log', `tags: ${tags.length}, names: ${tags.map(t => t.name).join(', ')}\n`); } catch {}

  // Build global attributes (available on ALL elements in WCC templates)
  const globalAttributes = [
    ...WCC_GLOBAL_ATTRIBUTES.map(a => ({ name: a.name, description: a.description as { kind: 'markdown'; value: string } })),
    ...WCC_FORM_ATTRIBUTES.map(a => ({ name: a.name, description: a.description as { kind: 'markdown'; value: string } })),
    ...COMMON_DOM_EVENTS.map(e => ({ name: `@${e.name}`, description: { kind: 'markdown' as const, value: `(event) DOM — ${e.description}` } })),
  ];

  // Create HTML service with WCC custom data
  const wccDataProvider = newHTMLDataProvider('wcc-components', {
    version: 1.1,
    tags: tags.length > 0 ? tags : undefined,
    globalAttributes,
  });

  const htmlService = createHtmlService({
    getCustomData: async () => [wccDataProvider],
  });

  return server.initialize(
    params,
    createTypeScriptProject(ts, undefined, () => ({
      languagePlugins: [wccLanguagePlugin],
    })),
    [htmlService, createCssService(), ...createTsService(ts)],
  );
});

connection.onInitialized(() => {
  server.initialized();
});

connection.onShutdown(() => {
  server.shutdown();
});

connection.listen();
