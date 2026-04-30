import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cliPath = resolve(__dirname, 'wcc.js');

describe('wcc CLI', () => {
  const tmpDir = resolve(__dirname, '__tmp_cli_test__');

  beforeEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  function writeComponent(name, dir = 'src') {
    const srcDir = join(tmpDir, dir);
    if (!existsSync(srcDir)) mkdirSync(srcDir, { recursive: true });

    // Write a minimal component source
    writeFileSync(join(srcDir, `${name}.js`), `
import { defineComponent, signal } from 'wcc'

export default defineComponent({
  tag: '${name}',
  template: './${name}.html',
})

const count = signal(0)

function increment() {
  count.set(count() + 1)
}
`);
    // Write a minimal template
    writeFileSync(join(srcDir, `${name}.html`), `<div>{{count}}</div>`);
  }

  function writeConfig(config) {
    writeFileSync(join(tmpDir, 'wcc.config.js'), `export default ${JSON.stringify(config)};\n`);
  }

  it('discovers .ts and .js files, excludes *.test.* and *.d.ts', () => {
    // Create various files
    writeComponent('wcc-counter');
    writeFileSync(join(tmpDir, 'src', 'helper.test.js'), 'test file');
    writeFileSync(join(tmpDir, 'src', 'types.d.ts'), 'declare module "x" {}');
    writeFileSync(join(tmpDir, 'src', 'readme.md'), '# readme');

    // Run build — it should only compile wcc-counter.js (not test, d.ts, or md files)
    const result = execFileSync('node', [cliPath, 'build'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 30000,
    });

    // Check that output was created
    expect(existsSync(join(tmpDir, 'dist', 'wcc-counter.js'))).toBe(true);
    // Check that test/d.ts files were NOT compiled
    expect(existsSync(join(tmpDir, 'dist', 'helper.test.js'))).toBe(false);
    expect(existsSync(join(tmpDir, 'dist', 'types.d.ts'))).toBe(false);
    expect(existsSync(join(tmpDir, 'dist', 'readme.md'))).toBe(false);
  });

  it('writes compiled output to the configured output directory', () => {
    writeComponent('wcc-app');
    writeConfig({ output: 'out' });

    execFileSync('node', [cliPath, 'build'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 30000,
    });

    expect(existsSync(join(tmpDir, 'out', 'wcc-app.js'))).toBe(true);
    const content = readFileSync(join(tmpDir, 'out', 'wcc-app.js'), 'utf-8');
    // Should contain the compiled component
    expect(content).toContain('customElements.define');
    expect(content).toContain('wcc-app');
  });

  it('exits with non-zero code on compilation error', () => {
    // Write an invalid component (no defineComponent)
    writeFileSync(join(tmpDir, 'src', 'bad.js'), 'const x = 1;');

    try {
      execFileSync('node', [cliPath, 'build'], {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 30000,
      });
      // Should not reach here
      expect.fail('Expected non-zero exit code');
    } catch (err) {
      expect(err.status).not.toBe(0);
    }
  });

  it('prints usage and exits with non-zero code for unknown command', () => {
    try {
      execFileSync('node', [cliPath, 'unknown'], {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 30000,
      });
      expect.fail('Expected non-zero exit code');
    } catch (err) {
      expect(err.status).not.toBe(0);
      expect(err.stderr).toContain('Usage');
    }
  });
});
