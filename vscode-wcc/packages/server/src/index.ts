import { createServer, createConnection, createTypeScriptProject } from '@volar/language-server/node';
import { create as createTsService } from 'volar-service-typescript';
import { create as createHtmlService } from 'volar-service-html';
import { create as createCssService } from 'volar-service-css';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { wccLanguagePlugin } from './languagePlugin';
import { parseWccBlocks } from './wccParser';

const connection = createConnection();
const server = createServer(connection);

// ── WCC Custom Data Provider ────────────────────────────────────────

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

/**
 * Build HTMLDataV1 from workspace .wcc files.
 */
function buildHtmlCustomData(workspaceFolders: string[]): any {
  const tags: any[] = [];
  
  for (const folder of workspaceFolders) {
    // Scan src/ directory
    const srcDir = path.join(folder, 'src');
    if (fs.existsSync(srcDir)) {
      const components = scanWccFiles(srcDir);
      for (const comp of components) {
        const attributes = [
          ...comp.props.map(p => ({ name: `:${p.name}`, description: `(prop) ${p.type}` })),
          ...comp.events.map(e => ({ name: `@${e}`, description: `(event)` })),
        ];
        tags.push({ name: comp.tag, description: `WCC Component`, attributes });
      }
    }

    // Also check if dist/wcc-html-data.json exists (from wcc build)
    const dataFile = path.join(folder, 'dist', 'wcc-html-data.json');
    if (fs.existsSync(dataFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        if (data.tags) {
          for (const tag of data.tags) {
            if (!tags.find(t => t.name === tag.name)) {
              tags.push(tag);
            }
          }
        }
      } catch {}
    }
  }

  return { version: 1.1, tags };
}

// ── Server Setup ────────────────────────────────────────────────────

connection.onInitialize((params) => {
  // Extract workspace folder paths for scanning
  const workspaceFolders = (params.workspaceFolders || []).map(f => {
    const uri = f.uri;
    if (uri.startsWith('file://')) return decodeURIComponent(uri.slice(7));
    return uri;
  });

  // Build custom data from workspace .wcc files
  const customData = buildHtmlCustomData(workspaceFolders);

  // Create HTML service with custom getCustomData that includes WCC components
  const wccHtmlService = createHtmlService({
    getCustomData: async (context) => {
      // Load user-configured custom data (standard behavior)
      const html = await import('vscode-html-languageservice');
      const userCustomData: string[] = await context.env.getConfiguration?.('html.customData') ?? [];
      const providers: any[] = [];

      for (const customDataPath of userCustomData) {
        for (const workspaceFolder of context.env.workspaceFolders) {
          try {
            const { Utils } = await import('vscode-uri');
            const uri = Utils.resolvePath(workspaceFolder, customDataPath);
            const json = await context.env.fs?.readFile?.(uri);
            if (json) {
              providers.push(html.newHTMLDataProvider(customDataPath, JSON.parse(json)));
              break;
            }
          } catch {}
        }
      }

      // Add WCC component data (auto-discovered from workspace)
      if (customData.tags.length > 0) {
        providers.push(html.newHTMLDataProvider('wcc-components', customData));
      }

      return providers;
    },
  });

  return server.initialize(
    params,
    createTypeScriptProject(ts, undefined, () => ({
      languagePlugins: [wccLanguagePlugin],
    })),
    [wccHtmlService, createCssService(), ...createTsService(ts)],
  );
});

connection.onInitialized(() => {
  server.initialized();
});

connection.onShutdown(() => {
  server.shutdown();
});

connection.listen();
