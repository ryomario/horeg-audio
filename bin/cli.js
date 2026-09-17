#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

// Supported audio formats
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.weba', '.wma', '.alac'
]);

// Determine arguments
const args = process.argv.slice(2);
let port = 3000;
let customAudioDir = null;

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
  npx horeg-audio [options] [audio-directory]

Options:
  -p, --port <port>   Port to run static server (default: 3000)
  -h, --help          Show help

Examples:
  npx horeg-audio
  npx horeg-audio --port 8080
  npx horeg-audio ./my-audio-folder
  npx horeg-audio D:\\Music
`);
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    customAudioDir = path.resolve(process.cwd(), args[i]);
  }
}

// 1. Web UI serve directory (always dist-demo or demo)
let serveDir = path.join(packageRoot, 'dist-demo');
if (!fs.existsSync(serveDir)) {
  serveDir = path.join(packageRoot, 'demo');
}
if (!fs.existsSync(serveDir)) {
  serveDir = packageRoot;
}

// 2. Scan audio directory for playlist if provided
let customPlaylist = [];
let scannedCount = 0;

function findAudioFiles(dir, depth = 0) {
  let results = [];
  if (depth > 3) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(findAudioFiles(fullPath, depth + 1));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (_) {}
  return results;
}

if (customAudioDir) {
  try {
    if (fs.existsSync(customAudioDir) && fs.statSync(customAudioDir).isDirectory()) {
      const audioFiles = findAudioFiles(customAudioDir);
      scannedCount = audioFiles.length;
      customPlaylist = audioFiles.map((fullPath, idx) => {
        const relPath = path.relative(customAudioDir, fullPath).replace(/\\/g, '/');
        const ext = path.extname(fullPath);
        const title = path.basename(fullPath, ext);
        const parentDir = path.basename(path.dirname(fullPath));
        const rootDir = path.basename(customAudioDir);
        const artist = parentDir && parentDir !== rootDir ? parentDir : (rootDir || 'Local Audio');
        return {
          id: idx + 1,
          title,
          artist,
          album: rootDir || 'Horeg Audio Files',
          src: `/audio-files/${encodeURI(relPath)}`
        };
      });
    } else {
      console.warn(`[HoregAudio] Warning: Folder "${customAudioDir}" not found or not a directory.`);
      customAudioDir = null;
    }
  } catch (e) {
    console.warn(`[HoregAudio] Warning scanning audio directory:`, e.message);
    customAudioDir = null;
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
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.weba': 'audio/webm',
  '.ico': 'image/x-icon'
};

function streamFileWithRanges(filePath, req, res, contentType) {
  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const range = req.headers.range;

  if (range) {
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
  } else {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${port}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Endpoint 1: Custom audio files serving (/audio-files/...)
  if (pathname.startsWith('/audio-files/') && customAudioDir) {
    const rel = pathname.slice('/audio-files/'.length);
    const filePath = path.join(customAudioDir, rel);
    const resolvedPath = path.resolve(filePath);
    const resolvedAudioDir = path.resolve(customAudioDir);

    if (!resolvedPath.startsWith(resolvedAudioDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'audio/mpeg';
      streamFileWithRanges(filePath, req, res, contentType);
    });
    return;
  }

  // Endpoint 2: Playlist API (/api/playlist or /api/playlist.json)
  if (pathname === '/api/playlist' || pathname === '/api/playlist.json') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(customPlaylist, null, 2));
    return;
  }

  // Strip GitHub Pages base path prefix (/horeg-audio or /horeg-audio/...)
  let relativePath = pathname;
  if (relativePath === '/horeg-audio') {
    relativePath = '/';
  } else if (relativePath.startsWith('/horeg-audio/')) {
    relativePath = relativePath.slice('/horeg-audio'.length);
  }

  let filePath = path.join(serveDir, relativePath);

  // Security: prevent path traversal out of serveDir
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(serveDir);
  if (!resolvedPath.startsWith(resolvedRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Helper to serve index.html with injected custom playlist
  const serveIndexHtml = (indexPath) => {
    fs.readFile(indexPath, 'utf8', (err, htmlContent) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      let finalHtml = htmlContent;
      if (customPlaylist.length > 0) {
        const scriptTag = `<script>window.__HOREG_CUSTOM_PLAYLIST__ = ${JSON.stringify(customPlaylist)};</script>`;
        if (finalHtml.includes('<head>')) {
          finalHtml = finalHtml.replace('<head>', `<head>\n  ${scriptTag}`);
        } else {
          finalHtml = scriptTag + finalHtml;
        }
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(finalHtml);
    });
  };

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Fallback for SPA routing if index.html exists
      const indexPath = path.join(serveDir, 'index.html');
      if (fs.existsSync(indexPath) && !path.extname(relativePath)) {
        serveIndexHtml(indexPath);
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
    if (ext === '.html') {
      serveIndexHtml(filePath);
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    if (ext === '.mp3' || ext === '.wav' || ext === '.ogg' || ext === '.flac') {
      streamFileWithRanges(filePath, req, res, contentType);
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
  const playlistInfo = customAudioDir
    ? `📁 Loaded ${customPlaylist.length} track(s) from: ${path.basename(customAudioDir)}`
    : `🎵 Demo Synth Audio Tracks`;

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔊  HOREG AUDIO PLAYER - Sound System Glerr             ║
║                                                           ║
║   Web Player running at:                                  ║
║   ➜  ${url.padEnd(45, ' ')}║
║                                                           ║
║   Playlist:                                               ║
║   ➜  ${playlistInfo.slice(0, 45).padEnd(45, ' ')}║
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
