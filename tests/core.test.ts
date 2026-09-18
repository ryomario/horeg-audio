import { describe, it, expect, beforeEach } from 'vitest';
import { setupDomMocks } from './mocks/dom';
import { setupAudioMocks } from './mocks/audio';

setupDomMocks();
setupAudioMocks();

import { HoregCore, HoregCoreState } from '../packages/core/src/index';

describe('HoregCore Headless Engine Unit Tests', () => {
  let core: HoregCore;

  const sampleTracks = [
    { title: 'Track 1', artist: 'Artist 1', src: 'https://example.com/1.mp3' },
    { title: 'Track 2', artist: 'Artist 2', src: 'https://example.com/2.mp3' }
  ];

  beforeEach(() => {
    core = new HoregCore({
      playlist: sampleTracks,
      volume: 0.7,
      bassBoost: 5,
      eqPreset: 'horeg-sub-punch'
    });
  });

  it('should initialize headless state without requiring DOM container', () => {
    const state = core.getState();
    expect(state).toBeDefined();
    expect(state.playlist.length).toBe(2);
    expect(state.currentTrack?.title).toBe('Track 1');
    expect(state.currentIndex).toBe(0);
    expect(state.volume).toBe(0.7);
    expect(state.bass).toBe(5);
    expect(state.eqPreset).toBe('horeg-sub-punch');
    expect(state.isPlaying).toBe(false);
  });

  it('should notify subscribers on state change', () => {
    let capturedState: HoregCoreState | null = null;
    const unsub = core.subscribe((s) => {
      capturedState = s;
    });

    // Initial call
    expect(capturedState).not.toBeNull();
    expect(capturedState!.volume).toBe(0.7);

    // Update volume
    core.setVolume(0.9);
    expect(capturedState!.volume).toBe(0.9);

    // Update bass
    core.setBass(8);
    expect(capturedState!.bass).toBe(8);

    unsub();
  });

  it('should support event listeners for on/off/emit', () => {
    let fired = false;
    let payload: any = null;

    const unsub = core.on('volumeChange', (val) => {
      fired = true;
      payload = val;
    });

    core.setVolume(0.5);
    expect(fired).toBe(true);
    expect(payload).toBe(0.5);

    fired = false;
    unsub();

    core.setVolume(0.3);
    expect(fired).toBe(false);
  });

  it('should navigate tracks and manage playlist', () => {
    core.next();
    expect(core.getState().currentIndex).toBe(1);
    expect(core.getState().currentTrack?.title).toBe('Track 2');

    core.prev();
    expect(core.getState().currentIndex).toBe(0);
    expect(core.getState().currentTrack?.title).toBe('Track 1');

    // Add track
    core.addTrack({ title: 'Track 3', artist: 'Artist 3', src: 'https://example.com/3.mp3' });
    expect(core.getState().playlist.length).toBe(3);

    // Remove track
    core.removeTrack(0);
    expect(core.getState().playlist.length).toBe(2);
  });

  it('should support volume, mute, loop, and shuffle controls', () => {
    core.mute();
    expect(core.getState().isMuted).toBe(true);

    core.unmute();
    expect(core.getState().isMuted).toBe(false);

    core.setLoop('one');
    expect(core.getState().loopMode).toBe('one');

    core.setShuffle(true);
    expect(core.getState().isShuffle).toBe(true);
  });

  it('should support parametric EQ presets and band gains', () => {
    core.setEqPreset('vocal-carnival');
    expect(core.getState().eqPreset).toBe('vocal-carnival');

    core.setBandGain('sub', 6);
    expect(core.getState().bandGains.sub).toBe(6);
  });

  it('should return audio energy and clean up on destroy', () => {
    const energy = core.getAudioEnergy();
    expect(energy).toBeDefined();
    expect(typeof energy.bass).toBe('number');

    expect(() => core.destroy()).not.toThrow();
  });
});
