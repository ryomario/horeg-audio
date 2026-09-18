# 🔊 horeg-audio

> Standalone Vanilla TypeScript Audio Player Library with encapsulated Shadow DOM and Sound Horeg aesthetics.

[![npm version](https://img.shields.io/npm/v/horeg-audio.svg?color=amber)](https://www.npmjs.com/package/horeg-audio)
[![bundle size](https://img.shields.io/bundlephobia/minzip/horeg-audio?color=green)](https://bundlephobia.com/package/horeg-audio)
[![demo](https://img.shields.io/badge/demo-online-orange.svg)](https://ryomario.github.io/horeg-audio/)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`horeg-audio` adalah library pemutar audio mandiri berbasis TypeScript murni (*zero runtime dependencies*) yang mengusung tema visual panggung **Sound System Horeg** (speaker subwoofer cabinet, neon glow, industrial mesh grill, dan dynamic EQ/VU-meter visualizer).

---

## ✨ Fitur Utama

- **Zero CSS Leakage**: Menggunakan native **Shadow DOM** (`mode: 'open'`) sehingga style pemutar musik 100% terisolasi dari stylesheet proyek induk tanpa perlu file CSS terpisah (aman dipadukan dengan Tailwind, Bootstrap, Bulma, atau CSS global apa pun).
- **Sound Horeg Aesthetics**: Desain box speaker subwoofer panggung, grill tekstur radial, baut sudut industrial, dan tombol play dengan animasi neon glow pulse.
- **Real-time Scrubbing & Cursor Grab**: Geser timeline lagu secara instan dan *real-time* tanpa jeda animasi (`transition: none !important`), dengan respon kursor `cursor: grab` saat diarahkan dan `cursor: grabbing` saat menggeser track.
- **6 Presets Tema (Dark & Light Mode)**: Pilihan tema gelap dan terang siap pakai yang otomatis menyesuaikan seluruh palet komponen internal (cabinet, surface, drawer, fader, dan soft elevation shadows).
- **Dual Visualizer Engine (Canvas 2D & 3D DOM)**: Pilihan visualisasi HTML5 2D Canvas berkinerja tinggi 60 FPS (animasi fisik subwoofer cone excursion, surround stretch, & shockwave rings) atau 3D DOM bar.
- **Graphic Equalizer & Sound Presets**: Lowshelf bass booster hingga +15 dB dengan limiter brickwall anti-clipping, serta preset audio (`Horeg Sub-Punch`, `Bass Extreme`, `Vocal Carnival`, `Flat`).
- **Media Session API & State Persistence**: Metadata lagu, artwork, dan tombol kontrol terintegrasi ke lockscreen/media keys native OS, serta setelan tersimpan di `localStorage`.
- **Framework Adapters (React & Vue)**: Helper komponen `createReactPlayer` dan `createVuePlayer` bawaan untuk integrasi kilat tanpa overhead.
- **Zero Third-Party Dependencies**: Berbasis TypeScript murni tanpa dependensi eksternal.
- **Full Keyboard & ARIA a11y**: Navigasi ramah aksesibilitas keyboard (`Space`, panah kiri/kanan untuk seek, panah atas/bawah untuk volume).
- **Universal Distribution**: Siap pakai via NPM (ESM, CJS, TypeScript `.d.ts`), CDN browser tag `<script src="...">`, maupun CLI instant runner `npx horeg-audio`.

---

## 📦 Instalasi

Gunakan **pnpm** (atau package manager pilihan Anda):

```bash
pnpm add horeg-audio
```

Atau menggunakan npm / yarn:

```bash
npm install horeg-audio
# atau
yarn add horeg-audio
```

---

## ⚡ Instant CLI Runner (`npx horeg-audio`)

Ingin mencoba pemutar musik Sound Horeg di komputer Anda sendiri tanpa instalasi atau setup proyek? Cukup jalankan satu perintah:

```bash
# 1. Menjalankan Demo Player bawaan secara instan:
npx horeg-audio

# 2. Memutar seluruh koleksi musik dari folder lokal Anda:
npx horeg-audio ./my-audio-folder

# 3. Menentukan port khusus:
npx horeg-audio "D:\Koleksi Musik" --port 8080
```

### Keunggulan Mode CLI:
- **Zero Config**: Langsung membuka browser lokal dengan antarmuka Sound Horeg lengkap.
- **Auto-Scan Audio Folder**: Mendeteksi seluruh file audio di folder (`.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`, `.aac`, `.opus`, dll.) secara otomatis.
- **Automatic Metadata & CoverArt Extraction**: Mengekstrak cover art langsung dari metadata file musik (`ID3v2 APIC` pada MP3 atau `METADATA_BLOCK_PICTURE` pada FLAC), file gambar cover di folder (`cover.jpg`, `album.png`), atau men-generate *128px sound horeg vinyl badge* secara dinamis.
- **Calculated Duration**: Menghitung durasi lagu otomatis dari header audio.
- **Smooth Audio Streaming**: Mendukung *HTTP 206 Partial Content / Range Requests* untuk scrubbing / seeking lagu tanpa jeda.

---

## 🚀 Cara Penggunaan Library

### 1. Modern Frameworks & Bundlers (ESM / TypeScript / Vite / Next.js)

```typescript
import { HoregAudio } from 'horeg-audio';

const player = new HoregAudio({
  container: '#music-player', // Selektor string atau HTMLElement
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
    variant: 'horeg-classic'
  },
  autoplay: false,
  volume: 0.8,
  loop: 'all',
  onPlay: (track) => console.log('Playing:', track.title),
  onPause: () => console.log('Paused'),
  onTrackChange: (track, index) => console.log(`Track #${index + 1}: ${track.title}`)
});
```

---

### 2. Browser Langsung via CDN (IIFE / Global Script)

Anda dapat langsung menggunakan `horeg-audio` pada file HTML biasa **tanpa bundler atau build step** (*zero-config*). 

> [!NOTE]
> **Tidak membutuhkan link stylesheet/CSS terpisah!** Seluruh style visual, ikon SVG, dan animasi dirangkum mandiri di dalam Shadow DOM internal pemutar.

#### Opsi A: Tag `<script>` Tradisional (Global `window.HoregAudio`)

Saat file script dimuat, class `HoregAudio` otomatis didaftarkan ke objek `window`:

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Horeg Audio Player</title>
  <style>
    body {
      background-color: #0b0c10;
      color: #f4f4f5;
      font-family: sans-serif;
      padding: 40px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  </style>
</head>
<body>

  <!-- 1. Elemen mount player -->
  <div id="player-mount" style="max-width: 520px; width: 100%;"></div>

  <!-- 2. Muat Script Bundle IIFE (Pilih salah satu CDN atau file lokal) -->
  <!-- Via jsDelivr CDN: -->
  <script src="https://cdn.jsdelivr.net/npm/horeg-audio/dist/horeg-audio.global.js"></script>
  <!-- Atau via unpkg CDN: -->
  <!-- <script src="https://unpkg.com/horeg-audio/dist/horeg-audio.global.js"></script> -->
  <!-- Atau dari folder lokal repository: -->
  <!-- <script src="./dist/horeg-audio.global.js"></script> -->

  <!-- 3. Inisialisasi Player -->
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      // Inisialisasi HoregAudio global
      const player = new HoregAudio({
        container: '#player-mount', // Selektor CSS string atau elemen DOM langsung
        playlist: [
          {
            id: 1,
            title: 'Bass Horeg Jedag-Jedug Extreme',
            artist: 'DJ Riswanda Karnaval',
            album: 'Festival Sound Jatim 2026',
            src: 'https://cdn.example.com/audio/horeg-bass.mp3',
            coverArt: 'https://cdn.example.com/images/cover.jpg',
            duration: 215
          },
          {
            id: 2,
            title: 'Karnaval Audio Rig Battle',
            artist: 'Brewog Audio Master',
            src: 'https://cdn.example.com/audio/karnaval.mp3'
          }
        ],
        theme: {
          variant: 'horeg-classic' // 'horeg-classic' | 'horeg-nightclub' | 'horeg-stealth' | 'horeg-light' | 'horeg-light-clean' | 'horeg-light-minimal'
        },
        volume: 0.85,
        autoplay: false,
        loop: 'all',
        onPlay: function (track) {
          console.log('Sedang memutar:', track.title);
        },
        onTimeUpdate: function (currentTime, duration) {
          // Detik realtime
        }
      });

      // Kontrol pemutar secara dinamis via JavaScript:
      // player.play();
      // player.pause();
      // player.setTheme({ variant: 'horeg-light' });

      // Mengakses daftar preset tema bawaan dari properti statis:
      console.log('Preset yang tersedia:', HoregAudio.THEME_PRESETS);
    });
  </script>
</body>
</html>
```

#### Opsi B: Menggunakan Native Browser ES Module (`<script type="module">`)

Untuk browser modern, Anda juga dapat mengimpor langsung versi ESM via CDN tanpa proses bundling:

```html
<div id="player-mount"></div>

<script type="module">
  import HoregAudio, { THEME_PRESETS } from 'https://cdn.jsdelivr.net/npm/horeg-audio/dist/horeg-audio.js';

  const player = new HoregAudio({
    container: '#player-mount',
    playlist: [
      {
        title: 'Karnaval Sound Horeg',
        artist: 'Audio Crew',
        src: 'https://example.com/audio.mp3'
      }
    ],
    theme: {
      variant: 'horeg-light'
    }
  });
</script>
```

---

## 🎨 Tema Preset (Dark & Light Edition)

Tersedia 6 varian tema siap pakai yang secara otomatis mengonfigurasi seluruh aspek visual player:

| Preset Variant | Mode | Deskripsi | Warna Glow / Aksen | Background / Teks |
|---|---|---|---|---|
| `horeg-classic` | Dark | Hitam matte box subwoofer + aksen amber neon karnaval | `#f59e0b` & `#ef4444` | `#121214` / `#f4f4f5` |
| `horeg-nightclub` | Dark | Cyberpunk club vibe dengan aksen neon cyan & strobe pink | `#06b6d4` & `#ec4899` | `#0b0c10` / `#f8fafc` |
| `horeg-stealth` | Dark | Monokrom taktis metalik dan aksen perak industrial | `#94a3b8` & `#e2e8f0` | `#0f1115` / `#e2e8f0` |
| `horeg-light` | Light | Horeg Daylight Rig putih bersih dengan aksen amber & red punch | `#d97706` & `#dc2626` | `#ffffff` / `#0f172a` |
| `horeg-light-clean` | Light | Studio white modern dengan aksen neon sky blue & pink | `#0284c7` & `#db2777` | `#ffffff` / `#0f172a` |
| `horeg-light-minimal` | Light | Minimalist industrial slate dengan aksen royal cobalt | `#475569` & `#2563eb` | `#f8fafc` / `#1e293b` |

### Mengubah Tema Secara Dinamis (`player.setTheme`)

Saat `setTheme({ variant })` dipanggil, seluruh atribut warna preset baru langsung diterapkan secara utuh:

```typescript
// Beralih ke tema Light Mode
player.setTheme({
  variant: 'horeg-light'
});

// Beralih ke tema Nightclub dengan kustomisasi warna aksen khusus
player.setTheme({
  variant: 'horeg-nightclub',
  primaryGlowColor: '#00f2fe',
  borderRadius: '16px'
});

// Melihat konfigurasi tema yang sedang aktif
console.log(player.getTheme());
```

---

## 🛠️ API Reference

### Opsi Konfigurasi (`HoregPlayerOptions`)

```typescript
interface HoregPlayerOptions {
  container: string | HTMLElement;  // Target CSS selektor atau elemen DOM
  playlist: Track[];                // Daftar lagu awal
  initialIndex?: number;            // Indeks lagu awal (default: 0)
  autoplay?: boolean;               // Otomatis memutar saat dimuat (default: false)
  loop?: 'none' | 'all' | 'one';    // Mode perulangan (default: 'all')
  shuffle?: boolean;                // Acak urutan lagu (default: false)
  volume?: number;                  // Level volume 0.0 - 1.0 (default: 0.8)
  theme?: HoregTheme;               // Konfigurasi tema awal
  onPlay?: (track: Track) => void;
  onPause?: () => void;
  onTrackChange?: (track: Track, index: number) => void;
  onPlaylistChange?: (playlist: Track[], currentIndex: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: (track: Track) => void;
  onError?: (error: MediaError | Error) => void;
}
```

### Metode Publik (`player.*`)

- `player.play(): Promise<void>` - Memutar lagu aktif.
- `player.pause(): void` - Menjeda pemutaran.
- `player.toggle(): void` - Toggle play / pause.
- `player.next(): void` - Berpindah ke lagu berikutnya.
- `player.prev(): void` - Kembali ke awal lagu atau lagu sebelumnya.
- `player.seek(seconds: number): void` - Lompat ke detik pemutaran tertentu secara instan.
- `player.setVolume(level: number): void` - Mengatur volume (`0.0` sampai `1.0`).
- `player.loadTrack(indexOrTrack: number | Track, autoPlay?: boolean): void` - Memuat trek tertentu.
- `player.addTrack(track: Track, autoPlay?: boolean): number` - Menambahkan satu lagu ke playlist.
- `player.addTracks(tracks: Track[], autoPlay?: boolean): void` - Menambahkan kumpulan lagu ke playlist.
- `player.addTrackFromFile(file: File, autoPlay?: boolean): Promise<Track>` - Menambahkan lagu dari file lokal komputer (otomatis ekstrak nama file dan durasi).
- `player.addTrackFromFiles(files: FileList | File[], autoPlay?: boolean): Promise<Track[]>` - Menambahkan banyak file audio lokal sekaligus.
- `player.addTrackFromUrl(url: string, meta?: Partial<Track>, autoPlay?: boolean): Promise<Track>` - Menambahkan lagu dari tautan audio streaming URL.
- `player.removeTrack(index: number): void` - Menghapus lagu dari playlist berdasarkan indeks.
- `player.getPlaylist(): Track[]` - Mengambil daftar seluruh lagu di playlist saat ini.
- `player.setTheme(themeConfig: Partial<HoregTheme>): void` - Mengganti tema atau properti warna secara realtime.
- `player.getTheme(): HoregTheme` - Mengambil konfigurasi tema yang sedang diterapkan.
- `player.destroy(): void` - Membersihkan seluruh audio stream, event listener global, dan menghapus DOM Shadow Root.

### Properti & Fungsi Statis (`HoregAudio.*`)

- `HoregAudio.THEME_PRESETS` - Objek kamus preset tema bawaan (`Record<ThemeVariant, Partial<HoregTheme>>`).
- `HoregAudio.generateStyles(theme?)` - Fungsi generator string CSS Shadow DOM terenkapsulasi.

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

Didistribusikan di bawah Lisensi MIT. Lihat berkas [`LICENSE`](LICENSE) untuk informasi lebih lanjut.

Copyright © 2026 Mario ([@ryomario](https://github.com/ryomario)).

