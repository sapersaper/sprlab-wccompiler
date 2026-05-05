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
  var overlay = null;
  function showError(msg) {
    hideError();
    overlay = document.createElement('div');
    overlay.id = '__wcc_error_overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);color:#fff;font-family:monospace;font-size:14px;padding:32px;overflow:auto;display:flex;align-items:flex-start;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#1e1e1e;border:2px solid #f44;border-radius:8px;padding:24px;max-width:700px;width:100%;white-space:pre-wrap;word-break:break-word;';
    box.innerHTML = '<div style="color:#f44;font-size:16px;font-weight:bold;margin-bottom:12px;">\\u274C Compilation Error</div>' + msg.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    overlay.appendChild(box);
    overlay.addEventListener('click', hideError);
    document.body.appendChild(overlay);
  }
  function hideError() {
    if (overlay) { overlay.remove(); overlay = null; }
  }
  es.onmessage = function(e) {
    if (e.data === 'reload') { hideError(); location.reload(); }
    else if (e.data.startsWith('error:')) { showError(e.data.slice(6).replace(/\\\\n/g,'\\n')); }
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

  /** Send an error event to all connected SSE clients */
  function notifyError(message) {
    for (const res of sseClients) {
      try {
        res.write(`data: error:${message.replace(/\n/g, '\\n')}\n\n`);
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
    notifyError,
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
