import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {Object} WccConfig
 * @property {number} port — Dev server port (default: 4100)
 * @property {string} input — Source directory (default: 'src')
 * @property {string} output — Output directory (default: 'dist')
 */

/**
 * Load wcc.config.js from the project root.
 * Returns defaults if the file doesn't exist.
 * Validates port (finite number), input (non-empty string), output (non-empty string).
 *
 * @param {string} projectRoot
 * @returns {Promise<WccConfig>}
 */
export async function loadConfig(projectRoot) {
  const defaults = { port: 4100, input: 'src', output: 'dist' };
  const configPath = resolve(projectRoot, 'wcc.config.js');

  if (!existsSync(configPath)) return defaults;

  const configUrl = pathToFileURL(configPath).href;
  // Add cache-busting query to avoid ESM module cache issues
  const mod = await import(`${configUrl}?t=${Date.now()}`);
  const userConfig = mod.default || mod;

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

  return config;
}
