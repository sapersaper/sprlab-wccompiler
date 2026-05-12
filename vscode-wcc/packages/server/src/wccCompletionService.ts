/**
 * WCC Completion Service Plugin — provides prop/event autocompletion
 * for child WCC components used in templates.
 *
 * When the cursor is on a tag like `<wcc-child :`, this plugin:
 * 1. Detects the tag name (must contain a hyphen)
 * 2. Searches the workspace for a matching .wcc file
 * 3. Reads its defineProps and defineEmits
 * 4. Returns completion items for props (with `:` prefix) and events (with `@` prefix)
 */

import type { LanguageServicePlugin, LanguageServicePluginInstance, LanguageServiceContext } from '@volar/language-service/lib/types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { parseWccBlocks } from './wccParser';

/**
 * Extracts prop names and types from a script block's defineProps call.
 * Reuses the same logic as languagePlugin.ts.
 */
function extractPropsFromScript(scriptContent: string): { name: string; type: string }[] {
  const props: { name: string; type: string }[] = [];

  // Generic form: defineProps<{ name: string, age: number }>
  const genericMatch = scriptContent.match(/defineProps\s*<\s*\{([^}]+)\}\s*>/);
  if (genericMatch) {
    const body = genericMatch[1];
    const propRe = /(\w+)\s*[?]?\s*:\s*([^,;\n}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(body)) !== null) {
      props.push({ name: m[1], type: m[2].trim() });
    }
    if (props.length > 0) return props;
  }

  // Object defaults form: defineProps({ name: 'default', age: 0 })
  const objectMatch = scriptContent.match(/defineProps\(\s*\{([^}]+)\}\s*\)/);
  if (objectMatch) {
    const body = objectMatch[1];
    const propRe = /(\w+)\s*:\s*([^,}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(body)) !== null) {
      const name = m[1];
      const value = m[2].trim();
      let type = 'any';
      if (/^['"]/.test(value)) type = 'string';
      else if (/^\d/.test(value)) type = 'number';
      else if (value === 'true' || value === 'false') type = 'boolean';
      props.push({ name, type });
    }
    if (props.length > 0) return props;
  }

  // Array form: defineProps(['name', 'age'])
  const arrayMatch = scriptContent.match(/defineProps\(\s*\[([^\]]+)\]\s*\)/);
  if (arrayMatch) {
    const body = arrayMatch[1];
    const strRe = /['"](\w+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = strRe.exec(body)) !== null) {
      props.push({ name: m[1], type: 'any' });
    }
  }

  return props;
}

/**
 * Extracts event names from a script block's defineEmits call.
 */
function extractEventsFromScript(scriptContent: string): string[] {
  const events: string[] = [];

  // Call signatures form: defineEmits<{ (e: 'change', ...): void }>()
  const genericMatch = scriptContent.match(/defineEmits\s*<\s*\{([^}]+)\}\s*>/);
  if (genericMatch) {
    const body = genericMatch[1];
    const eventRe = /\(\s*e\s*:\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = eventRe.exec(body)) !== null) {
      events.push(m[1]);
    }
    if (events.length > 0) return events;
  }

  // Array form: defineEmits(['change', 'reset'])
  const arrayMatch = scriptContent.match(/defineEmits\(\s*\[([^\]]+)\]\s*\)/);
  if (arrayMatch) {
    const body = arrayMatch[1];
    const strRe = /['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = strRe.exec(body)) !== null) {
      events.push(m[1]);
    }
  }

  return events;
}

/**
 * Extracts model prop names from defineModel calls.
 */
function extractModelsFromScript(scriptContent: string): string[] {
  const models: string[] = [];
  const modelRe = /defineModel\(\s*\{[^}]*name\s*:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(scriptContent)) !== null) {
    models.push(m[1]);
  }
  return models;
}

/**
 * Detects the tag name at the cursor position in an HTML template.
 * Returns the tag name if the cursor is in attribute position of a hyphenated tag.
 */
function getTagAtPosition(text: string, offset: number): string | null {
  // Walk backwards from offset to find the opening < of the current tag
  let i = offset;
  while (i > 0 && text[i] !== '<') {
    if (text[i] === '>') return null; // We're outside a tag
    i--;
  }
  if (i < 0 || text[i] !== '<') return null;

  // Extract tag name
  const afterOpen = text.substring(i + 1);
  const tagMatch = afterOpen.match(/^([\w-]+)/);
  if (!tagMatch) return null;

  const tagName = tagMatch[1];
  // Only process custom elements (must contain a hyphen)
  if (!tagName.includes('-')) return null;

  return tagName;
}

/**
 * Creates the WCC completion service plugin.
 */
export function createWccCompletionService(): LanguageServicePlugin {
  return {
    name: 'wcc-component-completions',
    capabilities: {
      completionProvider: {
        triggerCharacters: [':', '@', ' '],
      },
    },
    create(context: LanguageServiceContext): LanguageServicePluginInstance {
      // Cache for resolved component metadata
      const componentCache = new Map<string, {
        props: { name: string; type: string }[];
        events: string[];
        models: string[];
        timestamp: number;
      }>();

      return {
        isAdditionalCompletion: true,

        async provideCompletionItems(document: TextDocument, position: vscode.Position, _completionContext, _token) {
          // Only handle HTML template documents (embedded in .wcc)
          if (document.languageId !== 'html') return null;

          const text = document.getText();
          const offset = document.offsetAt(position);

          // Detect if we're in attribute position of a custom element
          const tagName = getTagAtPosition(text, offset);
          if (!tagName) return null;

          // Resolve the .wcc file for this tag
          const componentMeta = await resolveComponentMeta(tagName, context, componentCache);
          if (!componentMeta) return null;

          const items: vscode.CompletionItem[] = [];

          // Determine what prefix the user typed
          const lineText = text.substring(text.lastIndexOf('\n', offset - 1) + 1, offset);
          const lastChar = lineText[lineText.length - 1];

          // Props as :propName bindings
          for (const prop of componentMeta.props) {
            items.push({
              label: `:${prop.name}`,
              kind: 10, // Property
              detail: `prop: ${prop.type}`,
              documentation: `Bind to prop '${prop.name}' of <${tagName}>`,
              insertText: lastChar === ':' ? `${prop.name}=""` : `:${prop.name}=""`,
              sortText: `0_${prop.name}`,
            });
          }

          // Model props as :modelName bindings
          for (const model of componentMeta.models) {
            items.push({
              label: `:${model}`,
              kind: 10, // Property
              detail: `model (two-way)`,
              documentation: `Two-way bind to model '${model}' of <${tagName}>. Use model:${model}="signal" for WCC-to-WCC binding.`,
              insertText: lastChar === ':' ? `${model}=""` : `:${model}=""`,
              sortText: `0_${model}`,
            });
          }

          // Events as @eventName handlers
          for (const event of componentMeta.events) {
            items.push({
              label: `@${event}`,
              kind: 23, // Event
              detail: `event`,
              documentation: `Listen to '${event}' event from <${tagName}>`,
              insertText: lastChar === '@' ? `${event}=""` : `@${event}=""`,
              sortText: `1_${event}`,
            });
          }

          if (items.length === 0) return null;

          return { isIncomplete: false, items };
        },
      };
    },
  };
}

/**
 * Resolves component metadata (props, events, models) for a given tag name.
 * Searches workspace folders for a matching .wcc file.
 */
async function resolveComponentMeta(
  tagName: string,
  context: LanguageServiceContext,
  cache: Map<string, { props: { name: string; type: string }[]; events: string[]; models: string[]; timestamp: number }>
): Promise<{ props: { name: string; type: string }[]; events: string[]; models: string[] } | null> {
  // Check cache (5 second TTL)
  const cached = cache.get(tagName);
  if (cached && Date.now() - cached.timestamp < 5000) {
    return cached;
  }

  // Search for the .wcc file in workspace
  const fs = context.env.fs;
  if (!fs) return null;

  for (const folder of context.env.workspaceFolders) {
    const found = await findWccFile(tagName, folder, fs);
    if (found) {
      const content = await fs.readFile(found);
      if (!content) continue;

      const parsed = parseWccBlocks(content);
      if (!parsed.script) continue;

      const props = extractPropsFromScript(parsed.script.content);
      const events = extractEventsFromScript(parsed.script.content);
      const models = extractModelsFromScript(parsed.script.content);

      const meta = { props, events, models, timestamp: Date.now() };
      cache.set(tagName, meta);
      return meta;
    }
  }

  return null;
}

/**
 * Searches for a .wcc file matching the given tag name.
 * Looks in common locations: src/, src/components/, and root.
 * Tag name convention: wcc-counter → wcc-counter.wcc
 */
async function findWccFile(
  tagName: string,
  workspaceFolder: import('vscode-uri').URI,
  fs: import('@volar/language-service/lib/types').FileSystem
): Promise<import('vscode-uri').URI | null> {
  const { Utils } = await import('vscode-uri');
  const fileName = `${tagName}.wcc`;

  // Search paths in priority order
  const searchPaths = [
    `src/${fileName}`,
    `src/components/${fileName}`,
    `src/nested/${fileName}`,
    fileName,
  ];

  for (const relPath of searchPaths) {
    const uri = Utils.joinPath(workspaceFolder, relPath);
    const stat = await fs.stat(uri);
    if (stat && stat.type === 1 /* File */) {
      return uri;
    }
  }

  // Recursive search in src/ if not found in common paths
  const srcUri = Utils.joinPath(workspaceFolder, 'src');
  const srcStat = await fs.stat(srcUri);
  if (srcStat && srcStat.type === 2 /* Directory */) {
    const found = await searchDirectory(srcUri, fileName, fs);
    if (found) return found;
  }

  return null;
}

/**
 * Recursively searches a directory for a file with the given name.
 */
async function searchDirectory(
  dirUri: import('vscode-uri').URI,
  fileName: string,
  fs: import('@volar/language-service/lib/types').FileSystem
): Promise<import('vscode-uri').URI | null> {
  const { Utils } = await import('vscode-uri');
  const entries = await fs.readDirectory(dirUri);
  if (!entries) return null;

  for (const [name, type] of entries) {
    if (type === 1 /* File */ && name === fileName) {
      return Utils.joinPath(dirUri, name);
    }
    if (type === 2 /* Directory */) {
      const found = await searchDirectory(Utils.joinPath(dirUri, name), fileName, fs);
      if (found) return found;
    }
  }

  return null;
}
