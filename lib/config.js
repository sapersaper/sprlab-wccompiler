import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DEFAULTS = {
  port: 4100,
  input: 'src',
  output: 'dist',
};

/**
 * Load and validate wcc.config.js from the given project root.
 * Returns defaults if the config file doesn't exist.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{port: number, input: string, output: string}>}
 */
export async function loadConfig(projectRoot) {
  const configPath = resolve(projectRoot, 'wcc.config.js');

  if (!existsSync(configPath)) {
    return { ...DEFAULTS };
  }

  const fileUrl = pathToFileURL(configPath).href;
  const mod = await import(fileUrl);
  const raw = mod.default ?? mod;

  const config = { ...DEFAULTS };
  const errors = [];

  if ('port' in raw) {
    if (typeof raw.port !== 'number' || !Number.isFinite(raw.port)) {
      errors.push("la propiedad 'port' debe ser un número válido");
    } else {
      config.port = raw.port;
    }
  }

  if ('input' in raw) {
    if (typeof raw.input !== 'string' || raw.input.trim() === '') {
      errors.push("la propiedad 'input' debe ser un string no vacío");
    } else {
      config.input = raw.input;
    }
  }

  if ('output' in raw) {
    if (typeof raw.output !== 'string' || raw.output.trim() === '') {
      errors.push("la propiedad 'output' debe ser un string no vacío");
    } else {
      config.output = raw.output;
    }
  }

  if (errors.length > 0) {
    throw new Error(`Error en wcc.config.js: ${errors.join('; ')}`);
  }

  return config;
}
