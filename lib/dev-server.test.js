import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startDevServer } from './dev-server.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: () => data,
          json: () => JSON.parse(data),
        });
      });
    }).on('error', reject);
  });
}

describe('dev-server', () => {
  const tmpDir = resolve(__dirname, '__tmp_devserver_test__');
  let handle;

  beforeEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (handle) {
      handle.close();
      handle = null;
    }
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  function startServer(port) {
    return new Promise((resolve) => {
      handle = startDevServer({ port, root: tmpDir, outputDir: tmpDir });
      // Wait for server to be listening
      handle.server.on('listening', () => resolve(handle));
    });
  }

  it('injects polling script into HTML responses', async () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body><h1>Hello</h1></body></html>');
    await startServer(0);
    const addr = handle.server.address();
    const res = await fetch(`http://localhost:${addr.port}/index.html`);
    const text = res.text();
    expect(text).toContain('<script>');
    expect(text).toContain('__poll');
    expect(text).toContain('</body>');
  });

  it('returns JSON with timestamp from /__poll endpoint', async () => {
    await startServer(0);
    const addr = handle.server.address();
    const res = await fetch(`http://localhost:${addr.port}/__poll`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json');
    const json = res.json();
    expect(json).toHaveProperty('t');
    expect(typeof json.t).toBe('number');
  });

  it('returns 404 for missing files', async () => {
    await startServer(0);
    const addr = handle.server.address();
    const res = await fetch(`http://localhost:${addr.port}/nonexistent.html`);
    expect(res.status).toBe(404);
  });

  it('serves .js files with correct MIME type', async () => {
    writeFileSync(join(tmpDir, 'app.js'), 'console.log("hello");');
    await startServer(0);
    const addr = handle.server.address();
    const res = await fetch(`http://localhost:${addr.port}/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/javascript; charset=utf-8');
  });

  it('serves .css files with correct MIME type', async () => {
    writeFileSync(join(tmpDir, 'style.css'), 'body { color: red; }');
    await startServer(0);
    const addr = handle.server.address();
    const res = await fetch(`http://localhost:${addr.port}/style.css`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/css; charset=utf-8');
  });

  it('serves .html files with correct MIME type', async () => {
    writeFileSync(join(tmpDir, 'page.html'), '<html><body>Test</body></html>');
    await startServer(0);
    const addr = handle.server.address();
    const res = await fetch(`http://localhost:${addr.port}/page.html`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
  });
});
