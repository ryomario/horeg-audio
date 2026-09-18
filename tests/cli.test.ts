import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  parseCliArgs,
  formatTime,
  renderProgressBar,
  renderAsciiVisualizer,
  findAudioFiles,
  estimateDuration,
  AUDIO_EXTENSIONS,
  createDemoWavBuffer,
  getOrCreateDemoAudioFiles,
  NodeAudioPlayer
} from '../bin/cli.js';

describe('CLI & TUI Unit Tests', () => {
  describe('Argument Parsing', () => {
    it('should parse default CLI arguments with TUI mode', () => {
      const parsed = parseCliArgs([]);
      expect(parsed.mode).toBe('tui');
      expect(parsed.port).toBe(3000);
      expect(parsed.customAudioDir).toBeNull();
      expect(parsed.noOpen).toBe(false);
      expect(parsed.showHelp).toBe(false);
      expect(parsed.showVersion).toBe(false);
    });

    it('should parse --web flag to activate web server mode', () => {
      const parsed = parseCliArgs(['--web', '--port', '8080', '--no-open']);
      expect(parsed.mode).toBe('web');
      expect(parsed.port).toBe(8080);
      expect(parsed.noOpen).toBe(true);
    });

    it('should parse -w shorthand for web mode', () => {
      const parsed = parseCliArgs(['-w', '-p', '5000']);
      expect(parsed.mode).toBe('web');
      expect(parsed.port).toBe(5000);
    });

    it('should parse help and version flags', () => {
      expect(parseCliArgs(['-h']).showHelp).toBe(true);
      expect(parseCliArgs(['--help']).showHelp).toBe(true);
      expect(parseCliArgs(['-v']).showVersion).toBe(true);
      expect(parseCliArgs(['--version']).showVersion).toBe(true);
    });

    it('should parse custom audio directory positional argument', () => {
      const parsed = parseCliArgs(['./music-folder', '--tui']);
      expect(parsed.mode).toBe('tui');
      expect(parsed.customAudioDir).toBe(path.resolve(process.cwd(), './music-folder'));
    });
  });

  describe('TUI Formatters & Visualizers', () => {
    it('should format seconds into mm:ss strings', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(9)).toBe('00:09');
      expect(formatTime(75)).toBe('01:15');
      expect(formatTime(214)).toBe('03:34');
      expect(formatTime(-5)).toBe('00:00');
    });

    it('should render progress bar with filled and empty block characters', () => {
      const barHalf = renderProgressBar(50, 100, 20);
      expect(barHalf.length).toBe(20);
      expect(barHalf).toBe('██████████░░░░░░░░░░');

      const barFull = renderProgressBar(100, 100, 10);
      expect(barFull).toBe('██████████');

      const barZero = renderProgressBar(0, 100, 10);
      expect(barZero).toBe('░░░░░░░░░░');
    });

    it('should render ASCII spectrum visualizer in idle state', () => {
      const vis = renderAsciiVisualizer(0, 0, false);
      expect(vis.excursionPercent).toBe(0);
      expect(vis.isStrobe).toBe(false);
      expect(vis.meterText).toContain('SUB: [░░░░░░░░]');
    });

    it('should render ASCII spectrum visualizer with dynamic pulse during playback', () => {
      const vis = renderAsciiVisualizer(8, 1.5, true);
      expect(vis.excursionPercent).toBeGreaterThan(0);
      expect(vis.subVal).toBeGreaterThan(0);
      expect(vis.waveLine).toBeDefined();
      expect(vis.meterText).toContain('SUB: [');
    });
  });

  describe('Directory Scanning & Duration Estimation', () => {
    it('should estimate audio duration based on file size', () => {
      const duration = estimateDuration(4 * 1024 * 1024); // 4MB
      expect(duration).toBeGreaterThan(30);
      expect(duration).toBeLessThan(600);
    });

    it('should recognize all supported audio extensions', () => {
      expect(AUDIO_EXTENSIONS.has('.mp3')).toBe(true);
      expect(AUDIO_EXTENSIONS.has('.wav')).toBe(true);
      expect(AUDIO_EXTENSIONS.has('.flac')).toBe(true);
      expect(AUDIO_EXTENSIONS.has('.ogg')).toBe(true);
      expect(AUDIO_EXTENSIONS.has('.txt')).toBe(false);
    });

    it('should scan audio files recursively from a directory', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horeg-test-'));
      const subDir = path.join(tempDir, 'sub');
      fs.mkdirSync(subDir);

      const f1 = path.join(tempDir, 'track1.mp3');
      const f2 = path.join(subDir, 'track2.wav');
      const f3 = path.join(tempDir, 'readme.txt');

      fs.writeFileSync(f1, 'dummy mp3');
      fs.writeFileSync(f2, 'dummy wav');
      fs.writeFileSync(f3, 'dummy txt');

      const files = findAudioFiles(tempDir);
      expect(files.length).toBe(2);
      expect(files.some((f) => f.endsWith('track1.mp3'))).toBe(true);
      expect(files.some((f) => f.endsWith('track2.wav'))).toBe(true);

      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('NodeAudioPlayer & Demo Audio Generator', () => {
    it('should generate valid WAV buffer with RIFF and fmt headers', () => {
      const buf = createDemoWavBuffer(1, 130, 50);
      expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
      expect(buf.toString('ascii', 12, 16)).toBe('fmt ');
      expect(buf.length).toBeGreaterThan(44);
    });

    it('should create and cache demo audio files in temp directory', () => {
      const { track1Path, track2Path } = getOrCreateDemoAudioFiles();
      expect(fs.existsSync(track1Path)).toBe(true);
      expect(fs.existsSync(track2Path)).toBe(true);
      expect(fs.statSync(track1Path).size).toBeGreaterThan(1000);
      expect(fs.statSync(track2Path).size).toBeGreaterThan(1000);
    });

    it('should instantiate NodeAudioPlayer with play, pause, resume, volume, stop, and destroy', () => {
      const player = new NodeAudioPlayer();
      expect(player.isPlaying).toBe(false);
      expect(player.volume).toBe(0.8);

      // Volume control
      player.setVolume(0.5);
      expect(player.volume).toBe(0.5);
      player.setVolume(1.5);
      expect(player.volume).toBe(1);
      player.setVolume(-0.2);
      expect(player.volume).toBe(0);

      // Playback lifecycle with invalid or dummy path does not throw
      expect(() => player.playTrack(null as any)).not.toThrow();
      expect(() => player.pause()).not.toThrow();
      expect(player.isPlaying).toBe(false);

      expect(() => player.resume()).not.toThrow();
      expect(() => player.stop()).not.toThrow();
      expect(() => player.destroy()).not.toThrow();
      expect(player.isPlaying).toBe(false);
    });
  });
});
