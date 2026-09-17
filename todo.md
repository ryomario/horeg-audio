### TODO List Pengembangan Selanjutnya

**Phase 1: Audio Engine & Core Processing**

* [x] **CORS Auto-handling**: Tambahkan atribut `crossOrigin = "anonymous"` pada instance audio native disertai penanganan *fallback graceful* jika audio CDN luar memblokir header CORS.


* [x] **Bass Booster Filter**: Implementasikan `BiquadFilterNode` (tipe `lowshelf`, rentang -10 dB hingga +15 dB) di rantai Web Audio API sebelum sinyal masuk ke `AnalyserNode`.


* [x] **Smooth Audio Ramping**: Ganti perubahan nilai instan pada volume dan filter gain dengan `linearRampToValueAtTime()` atau `setTargetAtTime()` untuk mencegah letupan audio (*digital pop/click*).


* [x] **Gapless Playback & Preloading**: Tambahkan opsi *preload* audio untuk trek selanjutnya pada playlist agar pergantian antrean lagu berjalan mulus tanpa jeda buffer.

**Phase 2: Visualizer & Horeg Aesthetic Engine**

* [ ] **Canvas-based Rendering Option**: Sediakan opsi render visualizer menggunakan HTML5 Canvas internal di samping DOM-bar saat ini untuk efisiensi CPU/GPU.
* [ ] **Dynamic Peak & Bass Sensitivity**: Terapkan *peak threshold detection* dinamis pada frekuensi 20 Hz – 150 Hz agar denyut box speaker sinkron presisi dengan *kick drum* lagu.


* [ ] **Equalizer Presets**: Tambahkan preset filter suara (misal: *Horeg Sub-Punch*, *Vocal Carnival*, *Flat Monitor*).
* [ ] **Custom SVG Icons Set**: Enkapsulasi seluruh aset tombol (play, pause, next, prev, repeat, volume, knob) ke bentuk inline SVG murni yang responsif terhadap token warna `--horeg-glow`.



**Phase 3: DX, a11y & Fitur Integrasi Modern**

* [x] **Media Session API Integration**: Hubungkan status lagu aktif ke notifikasi native OS (`navigator.mediaSession.metadata`), sehingga judul, artis, artwork, tombol play/next dapat dikendalikan dari lockscreen ponsel atau keyboard media keys.
* [x] **State Persistence**: Tambahkan opsi konfigurasi untuk menyimpan memori setelan volume, bass level, mode repeat/shuffle, serta trek terakhir di `localStorage`.


* [ ] **Framework Wrappers (Opsional)**: Buat wrapper ringan untuk React (`horeg-audio-react`) dan Vue (`horeg-audio-vue`) yang membungkus Web Component Shadow DOM.


* [ ] **CLI Runner Implementation**: Implementasikan binary `bin/cli.js` menggunakan `sirv` dan `open` agar pengguna bisa langsung menjalankan web demo lokal lewat perintah `npx horeg-audio`.



**Phase 4: Testing, Dokumentasi & CI/CD**

* [ ] **Unit & Audio Mock Testing**: Siapkan setup testing menggunakan **Vitest** dan mock Web Audio API untuk memverifikasi logika playlist, navigasi, dan public API methods.


* [ ] **Automated Changelog**: Pasang alur otomatisasi rilis changelog (misal: Changesets atau Conventional Commits) di alur kerja GitHub Actions `.github/workflows/release.yml`.


* [ ] **Interactive Playground**: Lengkapi halaman demo di GitHub Pages dengan fitur customizer CSS theme builder interaktif yang langsung menghasilkan kode konfigurasi JavaScript.