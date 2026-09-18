import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupDomMocks } from './mocks/dom';
import { setupAudioMocks } from './mocks/audio';

// Setup DOM, Web Audio, and MediaSession mocks
setupDomMocks();
setupAudioMocks();

import { HoregAudio } from '../src/Player';
import { detectStreamType, isLiveStream, StreamAdapter } from '../src/stream/StreamAdapter';
import { encodePcmToWav, audioBufferToWav } from '../src/utils/wav';
import { Track } from '../src/types';

describe('Modern Web Platform Integrations (Issue #5)', () => {
  let container: HTMLDivElement;

  const mockTracks: Track[] = [
    {
      title: 'Horeg Anthem',
      artist: 'DJ Karnaval',
      album: 'Sound Balap Volume 1',
      src: 'https://example.com/audio1.mp3',
      coverArt: 'https://example.com/cover1.jpg',
      duration: 210
    },
    {
      title: 'Subwoofer Earthquake',
      artist: 'Bass Master',
      album: 'Horeg Glerr',
      src: 'https://example.com/audio2.mp3',
      duration: 180
    }
  ];

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    localStorage.clear();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // =========================================================================
  // 1. Media Session API
  // =========================================================================
  describe('Media Session API Integration', () => {
    it('should register media session action handlers including seekbackward, seekforward, and stop', () => {
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        mediaSession: true
      });

      const mediaSession = (navigator as any).mediaSession;
      expect(mediaSession).toBeDefined();

      const handlers = mediaSession.handlers;
      expect(handlers.has('play')).toBe(true);
      expect(handlers.has('pause')).toBe(true);
      expect(handlers.has('previoustrack')).toBe(true);
      expect(handlers.has('nexttrack')).toBe(true);
      expect(handlers.has('seekto')).toBe(true);
      expect(handlers.has('seekbackward')).toBe(true);
      expect(handlers.has('seekforward')).toBe(true);
      expect(handlers.has('stop')).toBe(true);

      player.destroy();
    });

    it('should update MediaMetadata with track title, artist, album, and artwork', () => {
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        mediaSession: true
      });

      const mediaSession = (navigator as any).mediaSession;
      expect(mediaSession.metadata).toBeDefined();
      expect(mediaSession.metadata.title).toBe('Horeg Anthem');
      expect(mediaSession.metadata.artist).toBe('DJ Karnaval');
      expect(mediaSession.metadata.album).toBe('Sound Balap Volume 1');
      expect(mediaSession.metadata.artwork.length).toBeGreaterThan(0);
      expect(mediaSession.metadata.artwork[0].src).toBe('https://example.com/cover1.jpg');

      player.destroy();
    });

    it('should handle seekbackward and seekforward actions correctly', () => {
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        mediaSession: true
      });

      // Advance player position to 50s
      player.seek(50);
      expect(player.getCurrentTime()).toBe(50);

      const mediaSession = (navigator as any).mediaSession;

      // Trigger seekbackward with default offset (10s) -> should be 40s
      const seekBackwardHandler = mediaSession.handlers.get('seekbackward');
      expect(typeof seekBackwardHandler).toBe('function');
      seekBackwardHandler({});
      expect(player.getCurrentTime()).toBe(40);

      // Trigger seekforward with custom offset (15s) -> should be 55s
      const seekForwardHandler = mediaSession.handlers.get('seekforward');
      expect(typeof seekForwardHandler).toBe('function');
      seekForwardHandler({ seekOffset: 15 });
      expect(player.getCurrentTime()).toBe(55);

      // Trigger stop -> pauses and resets to 0s
      const stopHandler = mediaSession.handlers.get('stop');
      expect(typeof stopHandler).toBe('function');
      stopHandler({});
      expect(player.getCurrentTime()).toBe(0);
      expect(player.isPlaying()).toBe(false);

      player.destroy();
    });

    it('should support dynamically toggling media session via setMediaSessionEnabled()', () => {
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        mediaSession: true
      });

      const mediaSession = (navigator as any).mediaSession;
      expect(mediaSession.handlers.get('play')).not.toBeNull();

      // Disable
      player.setMediaSessionEnabled(false);
      expect(mediaSession.handlers.get('play')).toBeNull();
      expect(mediaSession.playbackState).toBe('none');

      // Re-enable
      player.setMediaSessionEnabled(true);
      expect(mediaSession.handlers.get('play')).not.toBeNull();

      player.destroy();
    });
  });

  // =========================================================================
  // 2. LocalStorage Persistence
  // =========================================================================
  describe('LocalStorage Persistence', () => {
    it('should persist player state to localStorage when values change', () => {
      const storageKey = 'horeg_custom_test_state';
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        persistState: {
          key: storageKey,
          volume: true,
          bass: true,
          loop: true,
          shuffle: true,
          eqPreset: true,
          visualizerMode: true
        }
      });

      player.setVolume(0.65);
      player.setBass(8);
      player.setEqualizerPreset('horeg-sub-punch');
      player.setVisualizerMode('canvas');

      const savedJson = localStorage.getItem(storageKey);
      expect(savedJson).not.toBeNull();

      const saved = JSON.parse(savedJson!);
      expect(saved.volume).toBeCloseTo(0.65, 2);
      expect(saved.bass).toBe(8);
      expect(saved.eqPreset).toBe('horeg-sub-punch');
      expect(saved.visualizerMode).toBe('canvas');

      player.destroy();
    });

    it('should restore persisted state on subsequent player initialization', () => {
      const storageKey = 'horeg_restore_test';
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          volume: 0.42,
          bass: 11,
          loop: 'one',
          shuffle: true,
          lastTrack: 1,
          eqPreset: 'bass-extreme',
          visualizerMode: 'canvas'
        })
      );

      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        persistState: { key: storageKey }
      });

      expect(player.getAudioEngine().getVolume()).toBeCloseTo(0.42, 2);
      expect(player.getAudioEngine().getBassGain()).toBe(11);
      expect(player.getAudioEngine().getLoop()).toBe('one');
      expect(player.getAudioEngine().isShuffle()).toBe(true);
      expect(player.getCurrentIndex()).toBe(1);
      expect(player.getEqualizerPreset()).toBe('bass-extreme');
      expect(player.getVisualizerMode()).toBe('canvas');

      player.destroy();
    });

    it('should allow clearing and toggling persistence dynamically', () => {
      const storageKey = 'horeg_toggle_test';
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        persistState: { key: storageKey }
      });

      player.setVolume(0.9);
      expect(player.getPersistedState()).not.toBeNull();

      // Clear persisted state
      player.clearPersistedState();
      expect(player.getPersistedState()).toBeNull();

      // Disable persistence
      player.setPersistence(false);
      player.setVolume(0.5);
      expect(localStorage.getItem(storageKey)).toBeNull();

      // Re-enable persistence
      player.setPersistence(true, { key: storageKey });
      player.setVolume(0.7);
      expect(player.getPersistedState()).not.toBeNull();

      player.destroy();
    });
  });

  // =========================================================================
  // 3. Audio Stream Recording (MediaRecorder & WAV Export)
  // =========================================================================
  describe('Audio Stream Recording', () => {
    it('should start and track recording state and duration', async () => {
      const onStart = vi.fn();
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        onRecordingStart: onStart
      });

      expect(player.isRecording()).toBe(false);
      expect(player.getRecordingDuration()).toBe(0);

      player.startRecording();
      expect(player.isRecording()).toBe(true);
      expect(onStart).toHaveBeenCalledTimes(1);

      // Wait 25ms to verify duration increases
      await new Promise((r) => setTimeout(r, 25));
      expect(player.getRecordingDuration()).toBeGreaterThan(0);

      const blob = await player.stopRecording('webm');
      expect(player.isRecording()).toBe(false);
      expect(blob).toBeInstanceOf(Blob);

      player.destroy();
    });

    it('should export recording in WAV format with valid RIFF header', async () => {
      const onStop = vi.fn();
      const player = new HoregAudio({
        container,
        playlist: mockTracks,
        onRecordingStop: onStop
      });

      player.startRecording();
      const result = await player.exportRecording('wav', 'test-recording.wav');

      expect(result).toBeDefined();
      expect(result.format).toBe('wav');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('audio/wav');
      expect(typeof result.download).toBe('function');
      expect(onStop).toHaveBeenCalledTimes(1);

      player.destroy();
    });

    it('should convert Float32 PCM channels to valid 16-bit PCM RIFF WAV', async () => {
      const sampleRate = 44100;
      const length = 1000;
      const left = new Float32Array(length);
      const right = new Float32Array(length);

      // Populate simple sine wave
      for (let i = 0; i < length; i++) {
        left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
        right[i] = Math.sin((2 * Math.PI * 880 * i) / sampleRate);
      }

      const wavBlob = encodePcmToWav([left, right], sampleRate);
      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');

      // Verify RIFF WAV binary header
      const arrayBuffer = await wavBlob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // 0..3: "RIFF"
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      expect(riff).toBe('RIFF');

      // 8..11: "WAVE"
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      expect(wave).toBe('WAVE');

      // 12..15: "fmt "
      const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
      expect(fmt).toBe('fmt ');

      // 20..21: AudioFormat == 1 (PCM)
      expect(view.getUint16(20, true)).toBe(1);

      // 22..23: NumChannels == 2
      expect(view.getUint16(22, true)).toBe(2);

      // 24..27: SampleRate == 44100
      expect(view.getUint32(24, true)).toBe(44100);

      // 34..35: BitsPerSample == 16
      expect(view.getUint16(34, true)).toBe(16);

      // 36..39: "data"
      const data = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
      expect(data).toBe('data');
    });

    it('should encode AudioBufferLike object to WAV', () => {
      const mockAudioBuffer = {
        numberOfChannels: 1,
        sampleRate: 48000,
        length: 500,
        getChannelData: () => new Float32Array(500)
      };

      const wavBlob = audioBufferToWav(mockAudioBuffer);
      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');
    });
  });

  // =========================================================================
  // 4. Streaming Protocol Adapter (HLS & Online Radio)
  // =========================================================================
  describe('Streaming Protocol Adapter', () => {
    it('should accurately detect stream protocols from media URLs', () => {
      // HLS streams
      expect(detectStreamType('https://stream.example.com/live/index.m3u8')).toBe('hls');
      expect(detectStreamType('https://stream.example.com/audio.m3u8?token=123')).toBe('hls');
      expect(detectStreamType('https://edge.cdn.com/hls/master.m3u8')).toBe('hls');

      // Online radio streams (Icecast / Shoutcast / Playlists)
      expect(detectStreamType('http://radio.example.com:8000/stream')).toBe('radio');
      expect(detectStreamType('http://live.icecast.org/listen')).toBe('radio');
      expect(detectStreamType('https://radio.station.com/stream;')).toBe('radio');
      expect(detectStreamType('https://station.com/playlist.pls')).toBe('radio');
      expect(detectStreamType('https://station.com/playlist.m3u')).toBe('radio');

      // Direct audio files
      expect(detectStreamType('https://cdn.example.com/audio/song.mp3')).toBe('direct');
      expect(detectStreamType('https://cdn.example.com/audio/track.flac')).toBe('direct');
      expect(detectStreamType('')).toBe('direct');
    });

    it('should identify whether a URL or stream is live', () => {
      expect(isLiveStream('https://radio.station.com:8000/stream')).toBe(true);
      expect(isLiveStream('https://cdn.example.com/audio/song.mp3', Infinity)).toBe(true);
      expect(isLiveStream('https://cdn.example.com/audio/song.mp3', 240)).toBe(false);
    });

    it('should attach stream via StreamAdapter and report stream info', () => {
      const audio = new Audio();
      const onDetected = vi.fn();
      const adapter = new StreamAdapter(audio, { onStreamTypeDetected: onDetected });

      const info = adapter.load('https://edge.live.com/broadcast.m3u8');
      expect(info.type).toBe('hls');
      expect(info.isLive).toBe(true);
      expect(info.url).toBe('https://edge.live.com/broadcast.m3u8');
      expect(onDetected).toHaveBeenCalledWith(info);

      adapter.destroy();
    });

    it('should report isLiveStream on player and display LIVE status', () => {
      const liveTrack: Track = {
        title: 'Horeg FM Live Radio',
        artist: 'Broadcaster',
        src: 'https://live.horeg.com:8080/stream'
      };

      const player = new HoregAudio({
        container,
        playlist: [liveTrack]
      });

      expect(player.isLiveStream()).toBe(true);
      expect(player.getStreamInfo().type).toBe('radio');
      expect(player.getDuration()).toBe(Infinity);

      player.destroy();
    });
  });
});
