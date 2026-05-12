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
      ...comp.props.map(p => ({ name: p.name, description: { kind: 'markdown', value: `(prop) \`${p.type}\` — static value` } })),
      ...comp.props.map(p => ({ name: `:${p.name}`, description: { kind: 'markdown', value: `(prop) \`${p.type}\` — dynamic binding` } })),
      ...comp.events.map(e => ({ name: `@${e}`, description: { kind: 'markdown', value: `(event)` } })),
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

  // Create HTML service with WCC custom data
  const wccDataProvider = tags.length > 0
    ? newHTMLDataProvider('wcc-components', { version: 1.1, tags })
    : null;

  const htmlService = createHtmlService({
    getCustomData: async () => wccDataProvider ? [wccDataProvider] : [],
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
