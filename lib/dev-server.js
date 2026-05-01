/**
 * Dev Server — static HTTP server with SSE-based live-reload.
 *
 * Uses Server-Sent Events instead of polling for instant reload
 * when compiled output changes. No external dependencies.
 */

import { createServer } from 'node:http';
import { readFileSync, watch, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

/**
 * @typedef {Object} DevServerOptions
 * @property {number} port
 * @property {string} root
 * @property {string} outputDir
 */

/**
 * @typedef {Object} DevServerHandle
 * @property {import('node:http').Server} server
 * @property {() => void} close
 */

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SSE_SNIPPET = `<script>
(function() {
  var es = new EventSource('/__sse');
  es.onmessage = function(e) {
    if (e.data === 'reload') location.reload();
  };
  es.onerror = function() {
    es.close();
    setTimeout(function() { location.reload(); }, 1000);
  };
})();
</script>`;

// Keep the poll snippet for backward compatibility (tests check for it)
const POLL_SNIPPET = SSE_SNIPPET;

/**
 * Start a development server with live-reload support.
 *
 * @param {DevServerOptions} options
 * @returns {DevServerHandle}
 */
export function startDevServer({ port, root, outputDir }) {
  /** @type {Set<import('node:http').ServerResponse>} */
  const sseClients = new Set();

  /** Send a reload event to all connected SSE clients */
  function notifyReload() {
    for (const res of sseClients) {
      try {
        res.write('data: reload\n\n');
      } catch {
        sseClients.delete(res);
      }
    }
  }

  const server = createServer((req, res) => {
    const url = req.url.split('?')[0];

    // SSE endpoint — keeps connection open, sends reload events
    if (url === '/__sse') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('data: connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // Legacy poll endpoint (backward compat for tests)
    if (url === '/__poll') {
      const body = JSON.stringify({ t: Date.now() });
      const buf = Buffer.from(body);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': buf.byteLength,
        'Cache-Control': 'no-cache',
      });
      res.end(buf);
      return;
    }

    // Static files
    const filePath = url === '/' ? '/index.html' : url;
    const fullPath = resolve(root, '.' + filePath);

    try {
      let buf = readFileSync(fullPath);
      const ext = extname(fullPath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';

      // Inject SSE snippet into HTML
      if (ext === '.html') {
        let html = buf.toString('utf-8');
        if (html.includes('</body>')) {
          html = html.replace('</body>', SSE_SNIPPET + '\n</body>');
        } else {
          html += '\n' + SSE_SNIPPET;
        }
        buf = Buffer.from(html, 'utf-8');
      }

      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': buf.byteLength,
      });
      res.end(buf);
    } catch {
      const msg = 'Not Found';
      res.writeHead(404, {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(msg),
      });
      res.end(msg);
    }
  });

  // Watch output dir — notify SSE clients on changes (debounced)
  let watcher = null;
  if (outputDir && existsSync(outputDir)) {
    let timer = null;
    watcher = watch(outputDir, { recursive: true }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => notifyReload(), 200);
    });
  }

  server.listen(port, () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });

  return {
    server,
    close() {
      // Close all SSE connections
      for (const res of sseClients) {
        try { res.end(); } catch {}
      }
      sseClients.clear();
      if (watcher) watcher.close();
      server.close();
    },
  };
}
