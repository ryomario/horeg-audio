import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupAudioMocks } from './mocks/audio';

// Setup Web Audio mocks before importing AudioEngine
setupAudioMocks();

// Import classes to test
import { AudioEngine } from '../src/AudioEngine';
import { Track } from '../src/types';

describe('AudioEngine Unit Tests', () => {
  const sampleTracks: Track[] = [
    { title: 'Track 1', artist: 'Artist 1', src: 'https://example.com/1.mp3', duration: 120 },
    { title: 'Track 2', artist: 'Artist 2', src: 'https://example.com/2.mp3', duration: 200 },
    { title: 'Track 3', artist: 'Artist 3', src: 'https://example.com/3.mp3', duration: 180 }
  ];

  let engine: AudioEngine;

  beforeEach(() => {
    engine = new AudioEngine({
      playlist: [...sampleTracks],
      volume: 0.8,
      bassBoost: 6
    });
  });

  it('should initialize with provided playlist and volume', () => {
    expect(engine.getPlaylist().length).toBe(3);
    expect(engine.getCurrentIndex()).toBe(0);
    expect(engine.getCurrentTrack()?.title).toBe('Track 1');
    expect(engine.getVolume()).toBe(0.8);
    expect(engine.getBassGain()).toBe(6);
  });

  it('should handle volume changes and clamping', () => {
    engine.setVolume(0.5);
    expect(engine.getVolume()).toBe(0.5);

    engine.setVolume(1.5);
    expect(engine.getVolume()).toBe(1.0);

    engine.setVolume(-0.2);
    expect(engine.getVolume()).toBe(0);
  });

  it('should handle mute and unmute toggle', () => {
    expect(engine.isMuted()).toBe(false);
    const isNowMuted = engine.toggleMute();
    expect(isNowMuted).toBe(true);
    expect(engine.isMuted()).toBe(true);

    const isUnmuted = engine.toggleMute();
    expect(isUnmuted).toBe(false);
    expect(engine.isMuted()).toBe(false);
  });

  it('should handle EQ presets correctly', () => {
    expect(engine.getEqPreset()).toBe('flat');

    engine.setEqPreset('horeg-sub-punch');
    expect(engine.getEqPreset()).toBe('horeg-sub-punch');

    engine.setEqPreset('bass-extreme');
    expect(engine.getEqPreset()).toBe('bass-extreme');

    engine.setEqPreset('vocal-carnival');
    expect(engine.getEqPreset()).toBe('vocal-carnival');

    engine.setEqPreset('flat');
    expect(engine.getEqPreset()).toBe('flat');
  });

  it('should navigate next and previous tracks', () => {
    expect(engine.getCurrentIndex()).toBe(0);

    engine.next();
    expect(engine.getCurrentIndex()).toBe(1);
    expect(engine.getCurrentTrack()?.title).toBe('Track 2');

    engine.next();
    expect(engine.getCurrentIndex()).toBe(2);

    engine.prev();
    expect(engine.getCurrentIndex()).toBe(1);
  });

  it('should support shuffle and loop modes', () => {
    expect(engine.getLoop()).toBe('all');
    engine.setLoop('one');
    expect(engine.getLoop()).toBe('one');
    engine.setLoop('none');
    expect(engine.getLoop()).toBe('none');

    expect(engine.isShuffle()).toBe(false);
    engine.setShuffle(true);
    expect(engine.isShuffle()).toBe(true);
  });

  it('should allow adding and removing tracks dynamically', () => {
    const newTrack: Track = { title: 'Track 4', artist: 'Artist 4', src: 'https://example.com/4.mp3' };
    engine.addTrack(newTrack);
    expect(engine.getPlaylist().length).toBe(4);
    expect(engine.getPlaylist()[3].title).toBe('Track 4');

    engine.removeTrack(3);
    expect(engine.getPlaylist().length).toBe(3);
  });

  it('should calculate audio energy data without crashing', () => {
    const energy = engine.getAudioEnergy();
    expect(energy).toBeDefined();
    expect(typeof energy.bass).toBe('number');
    expect(typeof energy.midHigh).toBe('number');
    expect(typeof energy.bassDb).toBe('number');
  });
});
