/**
 * Dev Server — static HTTP server with polling-based live-reload.
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

const POLL_SNIPPET = `<script>
(function() {
  var t = 0, ready = false;
  setInterval(function() {
    fetch('/__poll').then(function(r) { return r.json(); }).then(function(d) {
      if (!ready) { t = d.t; ready = true; return; }
      if (d.t > t) { t = d.t; location.reload(); }
    }).catch(function() {});
  }, 500);
})();
</script>`;

/**
 * Start a development server with live-reload support.
 *
 * @param {DevServerOptions} options
 * @returns {DevServerHandle}
 */
export function startDevServer({ port, root, outputDir }) {
  let changeTs = Date.now();

  const server = createServer((req, res) => {
    const url = req.url.split('?')[0];

    // Poll endpoint
    if (url === '/__poll') {
      const body = JSON.stringify({ t: changeTs });
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

      // Inject poll snippet into HTML
      if (ext === '.html') {
        let html = buf.toString('utf-8');
        if (html.includes('</body>')) {
          html = html.replace('</body>', POLL_SNIPPET + '\n</body>');
        } else {
          html += '\n' + POLL_SNIPPET;
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

  // Watch output dir — update timestamp on changes (debounced)
  let watcher = null;
  if (outputDir && existsSync(outputDir)) {
    let timer = null;
    watcher = watch(outputDir, { recursive: true }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { changeTs = Date.now(); }, 200);
    });
  }

  server.listen(port, () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });

  return {
    server,
    close() {
      if (watcher) watcher.close();
      server.close();
    },
  };
}
