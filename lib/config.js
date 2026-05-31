import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {Object} WccConfig
 * @property {number} port — Dev server port (default: 4100)
 * @property {string} input — Source directory (default: 'src')
 * @property {string} output — Output directory (default: 'dist')
 * @property {boolean} [runtime] — Copy wcc-runtime.js to output (default: false)
 * @property {boolean} [htmlData] — Generate wcc-html-data.json for HTML intellisense (default: true)
 * @property {boolean} [minify] — Minify output (default: false)
 * @property {boolean} [comments] — Include generator comments in output (default: false)
 * @property {string[]} [integrations] — Framework integrations: ['vue', 'react', 'angular'] (default: [])
 */

/**
 * Load wcc.config.js from the project root (or a custom path).
 * Returns defaults if the file doesn't exist.
 * Validates port (finite number), input (non-empty string), output (non-empty string).
 *
 * @param {string} projectRoot
 * @param {string} [configFile] — Optional path to a specific config file (relative to projectRoot or absolute)
 * @returns {Promise<WccConfig>}
 */
export async function loadConfig(projectRoot, configFile) {
  const defaults = { port: 4100, input: 'src', output: 'dist', minify: false, comments: false, runtime: false, htmlData: true, integrations: [] };
  const configPath = configFile
    ? resolve(projectRoot, configFile)
    : resolve(projectRoot, 'wcc.config.js');

  if (!existsSync(configPath)) return defaults;

  const configUrl = pathToFileURL(configPath).href;
  // Add cache-busting query to avoid ESM module cache issues
  const mod = await import(`${configUrl}?t=${Date.now()}`);
  // Unwrap ESM module namespace: handle double-nesting from dynamic import
  let userConfig = mod.default || mod;
  if (userConfig.__esModule && userConfig.default) {
    userConfig = userConfig.default;
  }

  const config = { ...defaults, ...userConfig };

  // Validate
  if (typeof config.port !== 'number' || !isFinite(config.port)) {
    const error = new Error(`Error en wcc.config.js: port debe ser un número finito`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  if (typeof config.input !== 'string' || !config.input.trim()) {
    const error = new Error(`Error en wcc.config.js: input debe ser un string no vacío`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  if (typeof config.output !== 'string' || !config.output.trim()) {
    const error = new Error(`Error en wcc.config.js: output debe ser un string no vacío`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  if (typeof config.minify !== 'boolean') {
    const error = new Error(`Error en wcc.config.js: minify debe ser un booleano`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  if (typeof config.comments !== 'boolean') {
    const error = new Error(`Error en wcc.config.js: comments debe ser un booleano`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  if (typeof config.runtime !== 'boolean') {
    const error = new Error(`Error en wcc.config.js: runtime debe ser un booleano`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  if (typeof config.htmlData !== 'boolean') {
    const error = new Error(`Error en wcc.config.js: htmlData debe ser un booleano`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }

  const validIntegrations = ['vue', 'react', 'angular'];
  if (!Array.isArray(config.integrations)) {
    const error = new Error(`Error en wcc.config.js: integrations debe ser un array (ej: ['vue', 'react'])`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }
  for (const i of config.integrations) {
    if (!validIntegrations.includes(i)) {
      const error = new Error(`Error en wcc.config.js: integration '${i}' no es válida. Usar: vue, react, angular`);
      error.code = 'INVALID_CONFIG';
      throw error;
    }
  }

  return config;
}
