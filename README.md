# 🔊 horeg-audio

> Standalone Vanilla TypeScript Audio Player Library with encapsulated Shadow DOM and Sound Horeg aesthetics.

[![npm version](https://img.shields.io/npm/v/horeg-audio.svg?color=amber)](https://www.npmjs.com/package/horeg-audio)
[![bundle size](https://img.shields.io/bundlephobia/minzip/horeg-audio?color=green)](https://bundlephobia.com/package/horeg-audio)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`horeg-audio` adalah library pemutar audio mandiri berbasis TypeScript murni (*zero runtime dependencies*) yang mengusung tema visual panggung **Sound System Horeg** (speaker subwoofer cabinet, neon glow, industrial mesh grill, dan dynamic EQ/VU-meter visualizer).

---

## ✨ Fitur Utama

- **Zero CSS Leakage**: Menggunakan native **Shadow DOM** (`mode: 'open'`) sehingga style pemutar musik 100% terisolasi dari stylesheet proyek induk (kompatibel dengan Tailwind, Bootstrap, mau pun framework apa pun).
- **Sound Horeg Aesthetics**: Desain box speaker subwoofer panggung, grill tekstur radial, baut sudut industrial, dan tombol play dengan animasi neon pulse.
- **Dynamic EQ / VU Visualizer**: Bar equalizer mini dinamis yang responsif saat audio diputar.
- **Multi-Track Playlist & Rack Drawer**: Panel drawer geser bertema *rack mount audio* dengan antrean trek dan penanda lagu aktif.
- **Micro Bundle**: Berukuran di bawah **10 KB** (gzip) dengan zero third-party runtime dependencies.
- **Full Keyboard & ARIA a11y**: Navigasi ramah aksesibilitas (Space untuk toggle play, panah untuk seek dan volume).
- **Universal Distribution**: Siap pakai via NPM (ESM, CJS, TypeScript `.d.ts`) maupun CDN tag `<script src="...">`.

---

## 📦 Instalasi

Gunakan **pnpm** (atau package manager pilihan Anda):

```bash
pnpm add horeg-audio
```

---

## 🚀 Cara Penggunaan

### 1. Modern Frameworks & Bundlers (ESM / TypeScript)

```typescript
import { HoregAudio } from 'horeg-audio';

const player = new HoregAudio({
  container: '#music-player',
  playlist: [
    {
      id: 1,
      title: 'Bass Horeg Jedag Jedug Extreme',
      artist: 'Sound Master Karnaval',
      album: 'Festival Horeg 2026',
      src: '/audio/bass-horeg.mp3',
      coverArt: '/images/cover.jpg',
      duration: 215
    },
    {
      id: 2,
      title: 'Karnaval Audio Rig Battle',
      artist: 'Brewog Audio Master',
      src: '/audio/karnaval.mp3'
    }
  ],
  theme: {
    variant: 'horeg-classic',
    primaryGlowColor: '#f59e0b'
  },
  onPlay: (track) => console.log('Playing:', track.title),
  onPause: () => console.log('Paused')
});
```

### 2. Browser Langsung via CDN (IIFE / Global Script)

```html
<!-- Container di HTML -->
<div id="player-container"></div>

<!-- Load Script -->
<script src="https://cdn.jsdelivr.net/npm/horeg-audio/dist/horeg-audio.global.js"></script>
<script>
  const player = new HoregAudio({
    container: '#player-container',
    playlist: [
      {
        title: 'Karnaval Audio Battle',
        artist: 'Horeg Team',
        src: 'https://example.com/audio.mp3'
      }
    ]
  });
</script>
```

---

## 🎨 Tema Preset (Sound Horeg Edition)

| Preset Variant | Deskripsi | Warna Utama |
|---|---|---|
| `horeg-classic` | Hitam matte khas box speaker + aksen amber neon karnaval | `#f59e0b` |
| `horeg-nightclub` | Cyberpunk night vibe dengan aksen neon cyan & strobe magenta | `#06b6d4` & `#ec4899` |
| `horeg-stealth` | Monokrom taktis metalik dan aksen perak | `#94a3b8` |

Contoh kustomisasi tema dinamis:

```typescript
player.setTheme({
  variant: 'horeg-nightclub',
  primaryGlowColor: '#06b6d4',
  accentColor: '#ec4899',
  borderRadius: '16px'
});
```

---

## 🛠️ API Reference

### Opsi Konfigurasi (`HoregPlayerOptions`)

```typescript
interface HoregPlayerOptions {
  container: string | HTMLElement;  // Target selector atau elemen DOM
  playlist: Track[];                // Daftar lagu
  initialIndex?: number;            // Indeks lagu awal (default: 0)
  autoplay?: boolean;               // Otomatis memutar lagu
  loop?: 'none' | 'all' | 'one';    // Mode perulangan (default: 'all')
  shuffle?: boolean;                // Acak urutan lagu (default: false)
  volume?: number;                  // Level volume 0.0 - 1.0 (default: 0.8)
  theme?: HoregTheme;               // Konfigurasi tema
  onPlay?: (track: Track) => void;
  onPause?: () => void;
  onTrackChange?: (track: Track, index: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: (track: Track) => void;
  onError?: (error: MediaError | Error) => void;
}
```

### Metode Publik

- `player.play(): Promise<void>` - Memutar lagu.
- `player.pause(): void` - Menjeda audio.
- `player.toggle(): void` - Toggle play/pause.
- `player.next(): void` - Berpindah ke lagu berikutnya.
- `player.prev(): void` - Kembali ke awal lagu atau lagu sebelumnya.
- `player.seek(seconds: number): void` - Lompat ke detik tertentu.
- `player.setVolume(level: number): void` - Mengatur volume (`0.0` sampai `1.0`).
- `player.loadTrack(indexOrTrack: number | Track): void` - Memuat trek tertentu.
- `player.setTheme(themeConfig: Partial<HoregTheme>): void` - Mengganti tema secara realtime.
- `player.destroy(): void` - Membersihkan event listeners, audio stream, dan DOM Shadow Root.

---

## ⌨️ Pintasan Keyboard (Accessibility)

Ketika elemen pemutar atau tombol di dalamnya difokuskan:
- `Space`: Toggle Play / Pause
- `Arrow Left`: Mundur 5 detik
- `Arrow Right`: Maju 5 detik
- `Arrow Up`: Naikkan volume 5%
- `Arrow Down`: Turunkan volume 5%

---

## 💻 Pengembangan Lokal

```bash
# Clone & install dependensi menggunakan pnpm
pnpm install

# Menjalankan local development server (demo)
pnpm run dev

# Kompilasi TypeScript dan bundle library untuk produksi
pnpm run build
```

---

## 📄 Lisensi

MIT License © 2026.

