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
export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.weba', '.wma', '.alac'
]);

// 1. Argument Parser
export function parseCliArgs(rawArgs) {
  let port = 3000;
  let customAudioDir = null;
  let mode = 'tui'; // default is interactive TUI mode
  let noOpen = false;
  let showHelp = false;
  let showVersion = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '-p' || arg === '--port') {
      const p = parseInt(rawArgs[i + 1], 10);
      if (!isNaN(p)) port = p;
      i++;
    } else if (arg === '-w' || arg === '--web') {
      mode = 'web';
    } else if (arg === '--tui') {
      mode = 'tui';
    } else if (arg === '--no-open') {
      noOpen = true;
    } else if (arg === '-h' || arg === '--help') {
      showHelp = true;
    } else if (arg === '-v' || arg === '--version') {
      showVersion = true;
    } else if (!arg.startsWith('-')) {
      customAudioDir = path.resolve(process.cwd(), arg);
    }
  }

  return { port, customAudioDir, mode, noOpen, showHelp, showVersion };
}

// 2. Scan audio directory for playlist recursively
export function findAudioFiles(dir, depth = 0) {
  let results = [];
  if (depth > 4) return results;
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
export function estimateDuration(fileSizeBytes) {
  const sec = Math.round((fileSizeBytes * 8) / (160 * 1000));
  return Math.max(10, Math.min(3600, sec));
}

export function getAudioDuration(filePath) {
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
export function extractEmbeddedCoverArt(filePath) {
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

      if (tagSize > 0 && tagSize < 12 * 1024 * 1024) {
        const fullTag = Buffer.alloc(tagSize + 10);
        fs.readSync(fd, fullTag, 0, tagSize + 10, 0);
        fs.closeSync(fd);

        if (majorVersion === 3 || majorVersion === 4) {
          let offset = 10;
          const end = fullTag.length;
          while (offset + 10 < end) {
            const frameId = fullTag.toString('ascii', offset, offset + 4);
            if (frameId.charCodeAt(0) === 0) break;

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

              while (p < contentStart + frameSize && fullTag[p] !== 0) p++;
              let mime = fullTag.toString('ascii', contentStart + 1, p) || 'image/jpeg';
              p++; // skip null
              p++; // skip picture type

              if (encoding === 1 || encoding === 2) {
                while (p + 1 < contentStart + frameSize && !(fullTag[p] === 0 && fullTag[p + 1] === 0)) p += 2;
                p += 2;
              } else {
                while (p < contentStart + frameSize && fullTag[p] !== 0) p++;
                p++;
              }

              if (p < contentStart + frameSize) {
                const imgData = fullTag.subarray(p, contentStart + frameSize);
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
          let p = offset + 4;
          const mimeLen = flacHeader.readUInt32BE(p);
          p += 4;
          const mime = flacHeader.toString('ascii', p, p + mimeLen) || 'image/jpeg';
          p += mimeLen;
          const descLen = flacHeader.readUInt32BE(p);
          p += 4 + descLen + 16;
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
export function generateCoverThumbnail(filePath, title, idx, baseDir) {
  const embedded = extractEmbeddedCoverArt(filePath);
  if (embedded) return embedded;

  const trackDir = path.dirname(filePath);
  const candidateDirs = [trackDir];
  if (trackDir !== baseDir) candidateDirs.push(baseDir);

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

// Helpers for TUI
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function renderProgressBar(current, duration, width = 32) {
  const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function renderAsciiVisualizer(bassLevel = 6, time = 0, isPlaying = true) {
  if (!isPlaying) {
    return {
      subVal: 0,
      lowVal: 0,
      midVal: 0,
      excursionPercent: 0,
      isStrobe: false,
      waveLine: '  _  _  _  _  _  _  _  _  _  _  _  _  _  _  _  _  _  _',
      meterText: '  SUB: [░░░░░░░░]  LOW: [░░░░░░░░]  MID: [░░░░░░░░]  HI: [░░░░░░░░]  TREBLE: [░░░░░░░░]'
    };
  }

  const tempo = 130;
  const beatInterval = 60 / tempo;
  const beatPhase = (time % beatInterval) / beatInterval;
  const kickImpulse = Math.pow(Math.max(0, 1 - beatPhase * 2.4), 3.2);
  const bassMultiplier = Math.pow(10, bassLevel / 20);

  const subVal = Math.min(1, (0.22 + kickImpulse * 0.78) * Math.min(2.0, bassMultiplier));
  const lowVal = Math.min(1, (0.18 + kickImpulse * 0.62) * Math.min(1.8, bassMultiplier * 0.9));
  const midVal = Math.min(1, 0.28 + Math.sin(time * 9) * 0.25 + kickImpulse * 0.2);
  const upMidVal = Math.min(1, 0.22 + Math.cos(time * 12) * 0.2);
  const hiVal = Math.min(1, 0.18 + Math.sin(time * 16) * 0.18);
  const trebleVal = Math.min(1, 0.14 + Math.cos(time * 20) * 0.14);

  const renderMeter = (val, w = 8) => {
    const filled = Math.round(val * w);
    return '█'.repeat(filled) + '░'.repeat(w - filled);
  };

  const excursionPercent = Math.round(Math.min(1, subVal * 1.05) * 100);
  const isStrobe = kickImpulse > 0.65;

  const chars = [' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const wavePoints = [subVal, lowVal, midVal, upMidVal, hiVal, trebleVal, hiVal, upMidVal, midVal, lowVal, subVal];
  const waveLine = '  ' + wavePoints.map((v) => {
    const idx = Math.min(chars.length - 1, Math.floor(v * (chars.length - 1)));
    return chars[idx];
  }).join('  ');

  const meterText = `  SUB: [${renderMeter(subVal)}]  LOW: [${renderMeter(lowVal)}]  MID: [${renderMeter(midVal)}]  HI: [${renderMeter(hiVal)}]  TREBLE: [${renderMeter(trebleVal)}]`;

  return {
    subVal,
    lowVal,
    midVal,
    excursionPercent,
    isStrobe,
    waveLine,
    meterText
  };
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

// 3. Main CLI Controller
export function startCli(argv = process.argv.slice(2)) {
  const parsed = parseCliArgs(argv);

  if (parsed.showVersion) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
      console.log(`v${pkg.version}`);
    } catch {
      console.log('v1.5.0');
    }
    return;
  }

  if (parsed.showHelp) {
    console.log(`
\x1b[1;33m╔═══════════════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[1;33m║   🔊  HOREG AUDIO CLI  -  Terminal Sound System Glerr                 ║\x1b[0m
\x1b[1;33m╚═══════════════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[1mUsage:\x1b[0m
  npx horeg-audio [options] [audio-directory]

\x1b[1mArguments:\x1b[0m
  [audio-directory]    Path to local folder containing audio files

\x1b[1mOptions:\x1b[0m
  --tui               Run in interactive Terminal UI (TUI) mode (default)
  -w, --web           Run web player server and open browser
  -p, --port <port>   Port for local streaming server (default: 3000)
  --no-open           Do not automatically open browser in web mode
  -v, --version       Show package version
  -h, --help          Show this help message

\x1b[1mInteractive TUI Controls:\x1b[0m
  [Space]             Toggle Play / Pause
  [←] / [→]           Seek backward / forward 5 seconds
  [↑] / [↓]           Adjust volume up / down
  [B] / [b]           Cycle Bass Boost level (-10 dB to +15 dB)
  [N] / [P]           Next / Previous track
  [L] / [l]           Toggle Loop mode (ALL / ONE / NONE)
  [S] / [s]           Toggle Shuffle mode
  [W] / [w]           Open Web UI in default browser
  [Q] / [q]           Quit CLI
`);
    return;
  }

  let { port, customAudioDir, mode, noOpen } = parsed;

  // Build playlist from directory or default demo
  let customPlaylist = [];
  if (customAudioDir) {
    try {
      if (fs.existsSync(customAudioDir) && fs.statSync(customAudioDir).isDirectory()) {
        const audioFiles = findAudioFiles(customAudioDir);
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

  if (customPlaylist.length === 0) {
    customPlaylist = [
      {
        id: 1,
        title: 'Karnaval Sound Horeg Glerr (Demo)',
        artist: 'DJ Horeg Sound System',
        album: 'Festival Audio Jawa 2026',
        duration: 214,
        src: 'https://cdn.jsdelivr.net/gh/ryomario/horeg-audio@main/demo/sample-bass.mp3'
      },
      {
        id: 2,
        title: 'Subwoofer Rumble Test 30Hz - 80Hz',
        artist: 'Audio Laboratory',
        album: 'Extreme Excursion Series',
        duration: 180,
        src: 'https://cdn.jsdelivr.net/gh/ryomario/horeg-audio@main/demo/sample-sub.mp3'
      }
    ];
  }

  // Web server directory
  let serveDir = path.join(packageRoot, 'dist-demo');
  if (!fs.existsSync(serveDir)) serveDir = path.join(packageRoot, 'demo');
  if (!fs.existsSync(serveDir)) serveDir = packageRoot;

  // Start HTTP streaming server
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${port}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

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

    if (pathname === '/api/playlist' || pathname === '/api/playlist.json') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(customPlaylist, null, 2));
      return;
    }

    let relativePath = pathname;
    if (relativePath === '/horeg-audio') relativePath = '/';
    else if (relativePath.startsWith('/horeg-audio/')) relativePath = relativePath.slice('/horeg-audio'.length);

    let filePath = path.join(serveDir, relativePath);
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(serveDir);
    if (!resolvedPath.startsWith(resolvedRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

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
      port++;
      server.listen(port);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    const webUrl = `http://localhost:${port}`;

    const openBrowser = () => {
      const startCmd = process.platform === 'win32' ? `start ${webUrl}` :
                       process.platform === 'darwin' ? `open ${webUrl}` :
                       `xdg-open ${webUrl}`;
      exec(startCmd, () => {});
    };

    // MODE 1: Web mode
    if (mode === 'web') {
      const playlistInfo = customAudioDir
        ? `📁 Loaded ${customPlaylist.length} track(s) from: ${path.basename(customAudioDir)}`
        : `🎵 Demo Synth Audio Tracks (${customPlaylist.length} tracks)`;

      console.log(`
\x1b[1;33m╔═══════════════════════════════════════════════════════════╗\x1b[0m
\x1b[1;33m║                                                           ║\x1b[0m
\x1b[1;33m║   🔊  HOREG AUDIO PLAYER - Web Mode Active                ║\x1b[0m
\x1b[1;33m║                                                           ║\x1b[0m
\x1b[1;33m║   Web Player running at:                                  ║\x1b[0m
\x1b[1;33m║   ➜  \x1b[1;36m${webUrl.padEnd(53, ' ')}\x1b[0m\x1b[1;33m║\x1b[0m
\x1b[1;33m║                                                           ║\x1b[0m
\x1b[1;33m║   Playlist:                                               ║\x1b[0m
\x1b[1;33m║   ➜  ${playlistInfo.slice(0, 53).padEnd(53, ' ')}║\x1b[0m
\x1b[1;33m║                                                           ║\x1b[0m
\x1b[1;33m║   Press Ctrl+C to stop server                             ║\x1b[0m
\x1b[1;33m╚═══════════════════════════════════════════════════════════╝\x1b[0m
`);
      if (!noOpen) {
        openBrowser();
      }
      return;
    }

    // MODE 2: Terminal UI (TUI) Mode
    startTuiMode({
      playlist: customPlaylist,
      webUrl,
      openBrowser,
      onClose: () => {
        server.close();
        process.exit(0);
      }
    });
  });
}

function startTuiMode({ playlist, webUrl, openBrowser, onClose }) {
  const state = {
    isPlaying: true,
    currentIndex: 0,
    currentTime: 0,
    volume: 0.8,
    bassBoost: 6,
    loopMode: 'all',
    isShuffle: false
  };

  const bassLevels = [-6, 0, 4, 8, 12, 15];

  // Hide cursor in TTY
  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[?25l');
  }

  const cleanup = () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1B[?25h');
    }
    clearInterval(timer);
    onClose();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1B[?25h');
    }
  });

  const render = () => {
    const curTrack = playlist[state.currentIndex] || { title: 'Unknown', artist: 'Unknown', duration: 180 };
    const dur = curTrack.duration || 180;
    const progressStr = renderProgressBar(state.currentTime, dur, 30);
    const vis = renderAsciiVisualizer(state.bassBoost, state.currentTime, state.isPlaying);

    const playStatus = state.isPlaying
      ? `\x1b[1;32m▶ PLAYING\x1b[0m`
      : `\x1b[1;33m⏸ PAUSED \x1b[0m`;

    const strobeStatus = vis.isStrobe
      ? `\x1b[1;37;41m[ ⚡ STROBE FLASH ACTIVE ⚡ ]\x1b[0m`
      : `\x1b[2;37m[ ⚡ STROBE RIG STANDBY  ⚡ ]\x1b[0m`;

    const punchText = vis.excursionPercent > 65 ? `\x1b[1;31m⚡ GLERR!\x1b[0m` : `\x1b[1;33mKINETIC\x1b[0m`;

    const out = `\x1B[2J\x1B[0;0H
\x1b[1;33m╔═══════════════════════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[1;33m║   🔊  HOREG AUDIO TERMINAL SOUND SYSTEM  -  SOUND GLERR CONCERT               ║\x1b[0m
\x1b[1;33m╚═══════════════════════════════════════════════════════════════════════════════╝\x1b[0m

 \x1b[1;36m▶ NOW PLAYING:\x1b[0m
   \x1b[1mTitle  :\x1b[0m ${curTrack.title}
   \x1b[1mArtist :\x1b[0m ${curTrack.artist || 'Sound Horeg'}
   \x1b[1mTrack  :\x1b[0m [${state.currentIndex + 1}/${playlist.length}]
   \x1b[1mAlbum  :\x1b[0m ${curTrack.album || 'Horeg Rig Series'}

 \x1b[2;37m───────────────────────────────────────────────────────────────────────────────\x1b[0m
 ${playStatus}  [${progressStr}]  ${formatTime(state.currentTime)} / ${formatTime(dur)} (${Math.round((state.currentTime / dur) * 100)}%)
 \x1b[2;37m───────────────────────────────────────────────────────────────────────────────\x1b[0m

 \x1b[1;33m📊 REAL-TIME SPECTRUM WAVE:\x1b[0m
 \x1b[1;33m${vis.waveLine}\x1b[0m

 \x1b[1;33m🎚️ 5-BAND PARAMETRIC SPECTRUM:\x1b[0m
\x1b[36m${vis.meterText}\x1b[0m

 \x1b[1;35m🔊 SUBWOOFER CONE EXCURSION:\x1b[0m
   [${renderProgressBar(vis.excursionPercent, 100, 24)}] \x1b[1m${vis.excursionPercent}%\x1b[0m  PUNCH: ${punchText}

 \x1b[1;37m⚡ LIGHTING RIG:\x1b[0m
   ${strobeStatus}

 \x1b[1m🎛️ CONTROLS STATUS:\x1b[0m
   \x1b[1mVolume:\x1b[0m ${Math.round(state.volume * 100)}%   |   \x1b[1mBass Boost:\x1b[0m \x1b[1;33m${state.bassBoost >= 0 ? '+' : ''}${state.bassBoost} dB\x1b[0m   |   \x1b[1mLoop:\x1b[0m ${state.loopMode.toUpperCase()}   |   \x1b[1mShuffle:\x1b[0m ${state.isShuffle ? 'ON' : 'OFF'}
   \x1b[2mWeb Player: ${webUrl} (Press [W] to open in browser)\x1b[0m

 \x1b[2;37m───────────────────────────────────────────────────────────────────────────────\x1b[0m
 \x1b[1;37m[Space]\x1b[0m Play/Pause  \x1b[1;37m[←/→]\x1b[0m Seek ±5s  \x1b[1;37m[↑/↓]\x1b[0m Vol ±5%  \x1b[1;37m[B]\x1b[0m Bass Boost  \x1b[1;37m[N/P]\x1b[0m Track
 \x1b[1;37m[L]\x1b[0m Loop Mode    \x1b[1;37m[S]\x1b[0m Shuffle   \x1b[1;37m[W]\x1b[0m Open Web  \x1b[1;37m[Q]\x1b[0m Exit
 \x1b[2;37m───────────────────────────────────────────────────────────────────────────────\x1b[0m
`;
    process.stdout.write(out);
  };

  const timer = setInterval(() => {
    if (state.isPlaying) {
      state.currentTime += 0.1;
      const curTrack = playlist[state.currentIndex];
      const dur = curTrack?.duration || 180;
      if (state.currentTime >= dur) {
        if (state.loopMode === 'one') {
          state.currentTime = 0;
        } else {
          // Next track
          if (state.currentIndex + 1 < playlist.length) {
            state.currentIndex++;
            state.currentTime = 0;
          } else if (state.loopMode === 'all') {
            state.currentIndex = 0;
            state.currentTime = 0;
          } else {
            state.isPlaying = false;
            state.currentTime = dur;
          }
        }
      }
    }
    render();
  }, 100);

  // Keyboard input in raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key) => {
      // Ctrl+C or Q
      if (key === '\u0003' || key.toLowerCase() === 'q') {
        cleanup();
        return;
      }

      // Space: play/pause
      if (key === ' ') {
        state.isPlaying = !state.isPlaying;
        render();
        return;
      }

      // Left arrow: seek -5s
      if (key === '\u001b[D') {
        state.currentTime = Math.max(0, state.currentTime - 5);
        render();
        return;
      }

      // Right arrow: seek +5s
      if (key === '\u001b[C') {
        const curTrack = playlist[state.currentIndex];
        const dur = curTrack?.duration || 180;
        state.currentTime = Math.min(dur, state.currentTime + 5);
        render();
        return;
      }

      // Up arrow: vol +0.05
      if (key === '\u001b[A') {
        state.volume = Math.min(1, Math.round((state.volume + 0.05) * 100) / 100);
        render();
        return;
      }

      // Down arrow: vol -0.05
      if (key === '\u001b[B') {
        state.volume = Math.max(0, Math.round((state.volume - 0.05) * 100) / 100);
        render();
        return;
      }

      // B: cycle bass boost
      if (key.toLowerCase() === 'b') {
        const currentIdx = bassLevels.indexOf(state.bassBoost);
        const nextIdx = (currentIdx + 1) % bassLevels.length;
        state.bassBoost = bassLevels[nextIdx];
        render();
        return;
      }

      // N: next track
      if (key.toLowerCase() === 'n') {
        if (state.isShuffle && playlist.length > 1) {
          state.currentIndex = Math.floor(Math.random() * playlist.length);
        } else {
          state.currentIndex = (state.currentIndex + 1) % playlist.length;
        }
        state.currentTime = 0;
        render();
        return;
      }

      // P: prev track
      if (key.toLowerCase() === 'p') {
        state.currentIndex = (state.currentIndex - 1 + playlist.length) % playlist.length;
        state.currentTime = 0;
        render();
        return;
      }

      // L: toggle loop mode
      if (key.toLowerCase() === 'l') {
        const modes = ['all', 'one', 'none'];
        const nextModeIdx = (modes.indexOf(state.loopMode) + 1) % modes.length;
        state.loopMode = modes[nextModeIdx];
        render();
        return;
      }

      // S: toggle shuffle
      if (key.toLowerCase() === 's') {
        state.isShuffle = !state.isShuffle;
        render();
        return;
      }

      // W: open browser
      if (key.toLowerCase() === 'w') {
        openBrowser();
        render();
        return;
      }
    });
  } else {
    // Non-TTY environment
    render();
  }
}

// Auto-run if executed directly as entrypoint
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && (invokedPath === currentFilePath || invokedPath.endsWith('cli.js') || invokedPath.endsWith('horeg-audio'))) {
  startCli();
}
