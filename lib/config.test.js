import { describe, it, expect, afterAll } from 'vitest';
import { loadConfig } from './config.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

let testCounter = 0;
function makeTmpDir() {
  const dir = resolve(__dirname, `__tmp_config_${Date.now()}_${testCounter++}__`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const dirsToClean = [];

afterAll(() => {
  for (const dir of dirsToClean) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }
});

describe('loadConfig', () => {
  it('returns defaults when wcc.config.js does not exist', async () => {
    const tmpDir = makeTmpDir();
    dirsToClean.push(tmpDir);

    const config = await loadConfig(tmpDir);
    expect(config).toEqual({ port: 4100, input: 'src', output: 'dist', standalone: false });
  });

  it('loads custom port, input, and output from wcc.config.js', async () => {
    const tmpDir = makeTmpDir();
    dirsToClean.push(tmpDir);

    writeFileSync(join(tmpDir, 'wcc.config.js'), `export default { port: 3000, input: 'components', output: 'build' };\n`);

    const config = await loadConfig(tmpDir);
    expect(config.port).toBe(3000);
    expect(config.input).toBe('components');
    expect(config.output).toBe('build');
  });

  it('merges partial config with defaults', async () => {
    const tmpDir = makeTmpDir();
    dirsToClean.push(tmpDir);

    writeFileSync(join(tmpDir, 'wcc.config.js'), `export default { port: 5000 };\n`);

    const config = await loadConfig(tmpDir);
    expect(config.port).toBe(5000);
    expect(config.input).toBe('src');
    expect(config.output).toBe('dist');
  });

  it('throws INVALID_CONFIG for non-number port', async () => {
    const tmpDir = makeTmpDir();
    dirsToClean.push(tmpDir);

    writeFileSync(join(tmpDir, 'wcc.config.js'), `export default { port: 'abc' };\n`);

    await expect(loadConfig(tmpDir)).rejects.toThrow(/port/);
    try {
      await loadConfig(tmpDir);
    } catch (err) {
      expect(err.code).toBe('INVALID_CONFIG');
    }
  });

  it('throws INVALID_CONFIG for NaN port', async () => {
    const tmpDir = makeTmpDir();
    dirsToClean.push(tmpDir);

    writeFileSync(join(tmpDir, 'wcc.config.js'), `export default { port: NaN };\n`);

    await expect(loadConfig(tmpDir)).rejects.toThrow(/port/);
  });

  it('throws INVALID_CONFIG for empty input string', async () => {
    const tmpDir = makeTmpDir();
    dirsToClean.push(tmpDir);

    writeFileSync(join(tmpDir, 'wcc.config.js'), `export default { input: '  ' };\n`);

    await expect(loadConfig(tmpDir)).rejects.toThrow(/input/);
    try {
      await loadConfig(tmpDir);
    } catch (err) {
      expect(err.code).toBe('INVALID_CONFIG');
    }
  });

  it('throws INVALID_CONFIG for non-string output', async () => {
    const tmpDir = makeTmpDir();
    dirsToClean.push(tmpDir);

    writeFileSync(join(tmpDir, 'wcc.config.js'), `export default { output: 123 };\n`);

    await expect(loadConfig(tmpDir)).rejects.toThrow(/output/);
    try {
      await loadConfig(tmpDir);
    } catch (err) {
      expect(err.code).toBe('INVALID_CONFIG');
    }
  });
});
