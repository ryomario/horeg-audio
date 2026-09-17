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

// Duration extractor in pure Node.js
function estimateDuration(fileSizeBytes) {
  const sec = Math.round((fileSizeBytes * 8) / (160 * 1000));
  return Math.max(10, Math.min(3600, sec));
}

function getAudioDuration(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16384);
    const bytesRead = fs.readSync(fd, buffer, 0, 16384, 0);
    fs.closeSync(fd);

    if (bytesRead < 44) return estimateDuration(stat.size);

    // 1. Check WAV format
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
      const byteRate = buffer.readUInt32LE(28);
      let dataSize = stat.size - 44;
      let offset = 12;
      while (offset + 8 <= bytesRead) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        if (chunkId === 'data') {
          dataSize = chunkSize;
          break;
        }
        offset += 8 + chunkSize;
      }
      if (byteRate > 0) {
        return Math.round(dataSize / byteRate);
      }
    }

    // 2. Check MP3 format (skip ID3v2 tag if present)
    let offset = 0;
    if (buffer.toString('ascii', 0, 3) === 'ID3') {
      const synchsafeSize = ((buffer[6] & 0x7F) << 21) |
                            ((buffer[7] & 0x7F) << 14) |
                            ((buffer[8] & 0x7F) << 7) |
                            (buffer[9] & 0x7F);
      offset = 10 + synchsafeSize;
    }

    let frameBuf = buffer;
    let frameOffset = offset;
    if (offset + 512 > bytesRead && offset < stat.size) {
      const fd2 = fs.openSync(filePath, 'r');
      frameBuf = Buffer.alloc(8192);
      fs.readSync(fd2, frameBuf, 0, 8192, offset);
      fs.closeSync(fd2);
      frameOffset = 0;
    }

    for (let i = frameOffset; i < frameBuf.length - 4; i++) {
      if (frameBuf[i] === 0xFF && (frameBuf[i + 1] & 0xE0) === 0xE0) {
        const bitrateIdx = (frameBuf[i + 2] >> 4) & 0x0F;
        const sampleRateIdx = (frameBuf[i + 2] >> 2) & 0x03;
        const sampleRates = [44100, 48000, 32000];
        const sampleRate = sampleRates[sampleRateIdx] || 44100;

        // Xing / Info header check
        for (const checkOffset of [i + 36, i + 21, i + 4]) {
          if (checkOffset + 12 < frameBuf.length) {
            const tag = frameBuf.toString('ascii', checkOffset, checkOffset + 4);
            if (tag === 'Xing' || tag === 'Info') {
              const flags = frameBuf.readUInt32BE(checkOffset + 4);
              if (flags & 0x01) {
                const totalFrames = frameBuf.readUInt32BE(checkOffset + 8);
                const durationSec = (totalFrames * 1152) / sampleRate;
                if (durationSec > 0 && durationSec < 36000) {
                  return Math.round(durationSec);
                }
              }
            }
          }
        }

        const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
        const bitrateKbps = bitrates[bitrateIdx];
        if (bitrateKbps && bitrateKbps > 0) {
          const audioBytes = Math.max(0, stat.size - offset);
          const durationSec = (audioBytes * 8) / (bitrateKbps * 1000);
          if (durationSec > 0 && durationSec < 36000) {
            return Math.round(durationSec);
          }
        }
        break;
      }
    }

    return estimateDuration(stat.size);
  } catch (_) {
    return 180;
  }
}

// Extract embedded artwork directly from audio file metadata (ID3v2 APIC or FLAC Picture)
function extractEmbeddedCoverArt(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 20) return null;

    const fd = fs.openSync(filePath, 'r');
    const headBuf = Buffer.alloc(10);
    fs.readSync(fd, headBuf, 0, 10, 0);

    // Case 1: ID3v2 in MP3 / AAC / WAV
    if (headBuf.toString('ascii', 0, 3) === 'ID3') {
      const majorVersion = headBuf[3];
      const tagSize = ((headBuf[6] & 0x7F) << 21) |
                      ((headBuf[7] & 0x7F) << 14) |
                      ((headBuf[8] & 0x7F) << 7) |
                      (headBuf[9] & 0x7F);

      // Only read tag if within reasonable bounds (< 12 MB)
      if (tagSize > 0 && tagSize < 12 * 1024 * 1024) {
        const fullTag = Buffer.alloc(tagSize + 10);
        fs.readSync(fd, fullTag, 0, tagSize + 10, 0);
        fs.closeSync(fd);

        if (majorVersion === 3 || majorVersion === 4) {
          let offset = 10;
          const end = fullTag.length;
          while (offset + 10 < end) {
            const frameId = fullTag.toString('ascii', offset, offset + 4);
            if (frameId.charCodeAt(0) === 0) break; // ID3 padding

            let frameSize;
            if (majorVersion === 4) {
              frameSize = ((fullTag[offset + 4] & 0x7F) << 21) |
                          ((fullTag[offset + 5] & 0x7F) << 14) |
                          ((fullTag[offset + 6] & 0x7F) << 7) |
                          (fullTag[offset + 7] & 0x7F);
            } else {
              frameSize = fullTag.readUInt32BE(offset + 4);
            }

            if (frameSize <= 0 || offset + 10 + frameSize > end) break;

            if (frameId === 'APIC') {
              const contentStart = offset + 10;
              const encoding = fullTag[contentStart];
              let p = contentStart + 1;

              // Parse MIME type (null-terminated ASCII)
              while (p < contentStart + frameSize && fullTag[p] !== 0) p++;
              let mime = fullTag.toString('ascii', contentStart + 1, p) || 'image/jpeg';
              p++; // skip null terminator

              p++; // skip picture type (1 byte)

              // Skip description
              if (encoding === 1 || encoding === 2) {
                // UTF-16: two null bytes
                while (p + 1 < contentStart + frameSize && !(fullTag[p] === 0 && fullTag[p + 1] === 0)) {
                  p += 2;
                }
                p += 2;
              } else {
                // ISO-8859-1 or UTF-8: single null byte
                while (p < contentStart + frameSize && fullTag[p] !== 0) p++;
                p++;
              }

              if (p < contentStart + frameSize) {
                const imgData = fullTag.subarray(p, contentStart + frameSize);
                // Verify magic bytes
                if (imgData[0] === 0xFF && imgData[1] === 0xD8) mime = 'image/jpeg';
                else if (imgData[0] === 0x89 && imgData[1] === 0x50) mime = 'image/png';
                else if (imgData[0] === 0x52 && imgData[1] === 0x49) mime = 'image/webp';

                return `data:${mime};base64,${imgData.toString('base64')}`;
              }
            }
            offset += 10 + frameSize;
          }
        }
        return null;
      }
    }

    // Case 2: FLAC Picture Block
    if (headBuf.toString('ascii', 0, 4) === 'fLaC') {
      const flacHeader = Buffer.alloc(Math.min(stat.size, 10 * 1024 * 1024));
      fs.readSync(fd, flacHeader, 0, flacHeader.length, 0);
      fs.closeSync(fd);

      let offset = 4;
      while (offset + 4 <= flacHeader.length) {
        const isLast = (flacHeader[offset] & 0x80) !== 0;
        const blockType = flacHeader[offset] & 0x7F;
        const blockLength = (flacHeader[offset + 1] << 16) | (flacHeader[offset + 2] << 8) | flacHeader[offset + 3];
        offset += 4;

        if (blockType === 6) { // PICTURE
          let p = offset + 4; // skip picture type
          const mimeLen = flacHeader.readUInt32BE(p);
          p += 4;
          const mime = flacHeader.toString('ascii', p, p + mimeLen) || 'image/jpeg';
          p += mimeLen;
          const descLen = flacHeader.readUInt32BE(p);
          p += 4 + descLen + 16; // skip description, width, height, etc.
          const dataLen = flacHeader.readUInt32BE(p);
          p += 4;
          const imgData = flacHeader.subarray(p, p + dataLen);
          return `data:${mime};base64,${imgData.toString('base64')}`;
        }

        offset += blockLength;
        if (isLast) break;
      }
      return null;
    }

    fs.closeSync(fd);
  } catch (_) {}
  return null;
}

// 128px Base64 Thumbnail Generator
function generateCoverThumbnail(filePath, title, idx, baseDir) {
  // 1. Prioritize embedded artwork inside audio file metadata (ID3v2 APIC or FLAC Picture)
  const embedded = extractEmbeddedCoverArt(filePath);
  if (embedded) {
    return embedded;
  }

  // 2. Check if directory has existing album art
  const trackDir = path.dirname(filePath);
  const candidateDirs = [trackDir];
  if (trackDir !== baseDir) {
    candidateDirs.push(baseDir);
  }

  const imageNames = [
    'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp',
    'folder.jpg', 'folder.png', 'album.jpg', 'album.png',
    'artwork.jpg', 'artwork.png'
  ];

  for (const dir of candidateDirs) {
    for (const imgName of imageNames) {
      try {
        const fullImgPath = path.join(dir, imgName);
        if (fs.existsSync(fullImgPath)) {
          const stat = fs.statSync(fullImgPath);
          if (stat.isFile() && stat.size < 2 * 1024 * 1024) {
            const ext = path.extname(imgName).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            const b64 = fs.readFileSync(fullImgPath).toString('base64');
            return `data:${mime};base64,${b64}`;
          }
        }
      } catch (_) {}
    }
  }

  // Generate 128px SVG base64 thumbnail
  const hues = [38, 12, 185, 275, 335, 155, 210];
  const hue = hues[idx % hues.length];
  const primaryColor = `hsl(${hue}, 96%, 54%)`;
  const darkColor = `hsl(${hue}, 80%, 14%)`;
  const cleanTitle = (title || 'Track').slice(0, 14).replace(/[<>&"]/g, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="g${idx}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="55%" stop-color="${darkColor}"/>
      <stop offset="100%" stop-color="#090a0f"/>
    </radialGradient>
    <linearGradient id="edge${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="#222430"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="14" fill="#0d0e14"/>
  <circle cx="64" cy="64" r="52" fill="#13141f" stroke="url(#edge${idx})" stroke-width="2"/>
  <circle cx="64" cy="64" r="42" fill="none" stroke="#252736" stroke-width="1.5" stroke-dasharray="3 3"/>
  <circle cx="64" cy="64" r="32" fill="url(#g${idx})"/>
  <circle cx="64" cy="64" r="15" fill="#090a0f" stroke="${primaryColor}" stroke-width="2"/>
  <circle cx="64" cy="64" r="5" fill="${primaryColor}"/>
  <text x="64" y="112" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="9" font-weight="700" fill="#a1a1aa" text-anchor="middle">${cleanTitle}</text>
  <text x="64" y="24" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="8" font-weight="900" fill="${primaryColor}" text-anchor="middle" letter-spacing="1">HOREG RIG</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
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
        const duration = getAudioDuration(fullPath);
        const coverArt = generateCoverThumbnail(fullPath, title, idx, customAudioDir);

        return {
          id: idx + 1,
          title,
          artist,
          album: rootDir || 'Horeg Audio Files',
          duration,
          coverArt,
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
║   ➜  ${url.padEnd(53, ' ')}║
║                                                           ║
║   Playlist:                                               ║
║   ➜  ${playlistInfo.slice(0, 53).padEnd(53, ' ')}║
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
