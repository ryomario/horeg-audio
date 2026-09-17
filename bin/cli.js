#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

// Determine directory to serve
const args = process.argv.slice(2);
let port = 3000;
let customDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p' || args[i] === '--port') {
    const p = parseInt(args[i + 1], 10);
    if (!isNaN(p)) port = p;
    i++;
  } else if (args[i] === '-h' || args[i] === '--help') {
    console.log(`
🔊 HOREG AUDIO CLI RUNNER
=========================
Usage:
  npx horeg-audio [options] [directory]

Options:
  -p, --port <port>   Port to run static server (default: 3000)
  -h, --help          Show help

Examples:
  npx horeg-audio
  npx horeg-audio --port 8080
  npx horeg-audio ./my-audio-folder
`);
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    customDir = path.resolve(process.cwd(), args[i]);
  }
}

// Target folder to serve: customDir -> dist-demo -> demo -> packageRoot
let serveDir = customDir;
if (!serveDir) {
  const distDemo = path.join(packageRoot, 'dist-demo');
  const demo = path.join(packageRoot, 'demo');
  if (fs.existsSync(distDemo)) {
    serveDir = distDemo;
  } else if (fs.existsSync(demo)) {
    serveDir = demo;
  } else {
    serveDir = packageRoot;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Normalize and parse URL
  const parsedUrl = new URL(req.url, `http://localhost:${port}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Default to index.html for root or directories
  let filePath = path.join(serveDir, pathname);

  // Security: prevent path traversal out of root
  if (!filePath.startsWith(serveDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Fallback for SPA routing if index.html exists
      const indexPath = path.join(serveDir, 'index.html');
      if (fs.existsSync(indexPath) && !path.extname(pathname)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support audio Range requests for seeking
    const range = req.headers.range;
    if (range && (ext === '.mp3' || ext === '.wav' || ext === '.ogg')) {
      const totalSize = fs.statSync(filePath).size;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} in use, trying ${port + 1}...`);
    port++;
    server.listen(port);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔊  HOREG AUDIO PLAYER - Sound System Glerr             ║
║                                                           ║
║   Demo Server running at:                                 ║
║   ➜  ${url.padEnd(45, ' ')}║
║                                                           ║
║   Serving:                                                ║
║   ➜  ${serveDir.slice(0, 45).padEnd(45, ' ')}║
║                                                           ║
║   Press Ctrl+C to stop                                    ║
╚═══════════════════════════════════════════════════════════╝
`);

  // Auto-open browser
  const startCmd = process.platform === 'win32' ? `start ${url}` :
                   process.platform === 'darwin' ? `open ${url}` :
                   `xdg-open ${url}`;
  exec(startCmd, () => {});
});
