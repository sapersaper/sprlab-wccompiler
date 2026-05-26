/**
 * Helper: compile .wcc files from example/src and start a local HTTP server.
 *
 * The .wcc source files live in example/src/{fixtureName}/ (single source of truth).
 * The index.html for each test lives in e2e/fixtures/{fixtureName}/.
 * No duplication of .wcc files needed.
 *
 * Usage:
 *   const { url, cleanup } = await compileAndServe('01-basics')
 *   // ... run tests against url ...
 *   await cleanup()
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { compile } from '../../lib/compiler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../fixtures');
const EXAMPLE_SRC_DIR = resolve(__dirname, '../../example/src');
const TMP_DIR = resolve(__dirname, '../.tmp');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
};

/**
 * Compile all .wcc files for a fixture and start a static HTTP server.
 *
 * Looks for .wcc files in: example/src/{fixtureName}/
 * Looks for index.html in: e2e/fixtures/{fixtureName}/
 *
 * @param {string} fixtureName - name of the folder (e.g. '01-basics', 'dynamic-component')
 * @returns {Promise<{ url: string, cleanup: () => Promise<void> }>}
 */
export async function compileAndServe(fixtureName) {
  const fixtureDir = join(FIXTURES_DIR, fixtureName);
  const sourceDir = join(EXAMPLE_SRC_DIR, fixtureName);
  const outDir = join(TMP_DIR, fixtureName, String(Date.now()));

  mkdirSync(outDir, { recursive: true });

  // 1. Discover .wcc files — prefer example/src, fall back to fixtures dir
  const wccDir = existsSync(sourceDir) ? sourceDir : fixtureDir;
  const wccFiles = discoverWcc(wccDir);

  // 2. Compile each one — standalone mode so no shared runtime import needed
  for (const file of wccFiles) {
    const rel = relative(wccDir, file);
    const outPath = join(outDir, rel.replace(/\.wcc$/, '.js'));
    mkdirSync(dirname(outPath), { recursive: true });

    const { code } = await compile(file, { standalone: true });
    writeFileSync(outPath, code);
  }

  // 3. Read index.html from fixtures and inject <script> tags
  const htmlSrc = join(fixtureDir, 'index.html');
  let html = readFileSync(htmlSrc, 'utf-8');

  const jsFiles = discoverJs(outDir);
  const scriptTags = jsFiles
    .map(f => `  <script type="module" src="${relative(outDir, f).replace(/\\/g, '/')}"></script>`)
    .join('\n');

  html = html.replace('<!-- compiled scripts injected by test setup -->', scriptTags);
  writeFileSync(join(outDir, 'index.html'), html);

  // 4. Start HTTP server
  const { server, port } = await startServer(outDir);
  const url = `http://localhost:${port}`;

  return {
    url,
    async cleanup() {
      await new Promise(resolve => server.close(resolve));
      rmSync(outDir, { recursive: true, force: true });
    },
  };
}

function discoverWcc(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.wcc')) {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

function discoverJs(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(join(dir, entry.name));
    }
  }
  return results.sort();
}

function startServer(root) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      const filePath = urlPath === '/' ? '/index.html' : urlPath;
      const fullPath = join(root, filePath);

      try {
        const buf = readFileSync(fullPath);
        const mime = MIME[extname(fullPath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': buf.byteLength });
        res.end(buf);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}
