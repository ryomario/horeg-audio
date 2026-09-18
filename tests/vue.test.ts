import { describe, it, expect } from 'vitest';
import { setupDomMocks } from './mocks/dom';
import { setupAudioMocks } from './mocks/audio';

setupDomMocks();
setupAudioMocks();

import { useHoregAudio } from '../packages/vue/src/useHoregAudio';
import { HoregAudioPlayer } from '../packages/vue/src/HoregAudioPlayer';
import { HoregCore } from '../packages/core/src/HoregCore';

describe('Vue 3 Wrapper Unit Tests', () => {
  it('should export HoregAudioPlayer component and useHoregAudio composable', () => {
    expect(HoregAudioPlayer).toBeDefined();
    expect(typeof useHoregAudio).toBe('function');
  });

  it('should create reactive refs and action functions in useHoregAudio', () => {
    const core = new HoregCore({
      playlist: [{ title: 'Track V', artist: 'Artist V', src: 'https://example.com/v.mp3' }],
      volume: 0.9,
      bassBoost: 10
    });

    const composable = useHoregAudio({ core });

    expect(composable.volume.value).toBe(0.9);
    expect(composable.bass.value).toBe(10);
    expect(composable.playlist.value.length).toBe(1);
    expect(composable.currentTrack.value?.title).toBe('Track V');
    expect(typeof composable.play).toBe('function');
    expect(typeof composable.pause).toBe('function');
    expect(typeof composable.setBass).toBe('function');
    expect(typeof composable.setVolume).toBe('function');

    // Test calling control function
    composable.setBass(14);
    expect(core.getState().bass).toBe(14);

    core.destroy();
  });

  it('should define HoregAudioPlayer component props and emits properly', () => {
    expect(HoregAudioPlayer.name).toBe('HoregAudioPlayer');
    expect(HoregAudioPlayer.props).toBeDefined();
    expect((HoregAudioPlayer.props as any).playlist).toBeDefined();
    expect((HoregAudioPlayer.props as any).bassBoost).toBeDefined();
    expect(HoregAudioPlayer.emits).toContain('play');
    expect(HoregAudioPlayer.emits).toContain('pause');
  });
});
