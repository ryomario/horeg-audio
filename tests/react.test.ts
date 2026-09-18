import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { setupDomMocks } from './mocks/dom';
import { setupAudioMocks } from './mocks/audio';

setupDomMocks();
setupAudioMocks();

import { useHoregAudio } from '../packages/react/src/useHoregAudio';
import { HoregAudioPlayer } from '../packages/react/src/HoregAudioPlayer';
import { HoregCore } from '../packages/core/src/HoregCore';

describe('React Wrapper Unit Tests', () => {
  it('should export HoregAudioPlayer component and useHoregAudio hook', () => {
    expect(HoregAudioPlayer).toBeDefined();
    expect(typeof useHoregAudio).toBe('function');
  });

  it('should instantiate core and provide player controls via useHoregAudio', () => {
    const core = new HoregCore({
      playlist: [{ title: 'Track 1', artist: 'Artist 1', src: 'https://example.com/1.mp3' }],
      volume: 0.85,
      bassBoost: 6
    });

    // Test with pre-existing core instance
    let hookResult: any;
    function TestComponent() {
      hookResult = useHoregAudio({ core });
      return null;
    }

    // Call TestComponent inside React renderer
    renderToString(React.createElement(TestComponent));

    expect(hookResult).toBeDefined();
    expect(hookResult.volume).toBe(0.85);
    expect(hookResult.bass).toBe(6);
    expect(typeof hookResult.play).toBe('function');
    expect(typeof hookResult.pause).toBe('function');
    expect(typeof hookResult.setBass).toBe('function');
    expect(typeof hookResult.setVolume).toBe('function');

    core.destroy();
  });

  it('should instantiate HoregAudioPlayer element without crashing', () => {
    const element = React.createElement(HoregAudioPlayer, {
      playlist: [{ title: 'Song', artist: 'DJ', src: 'https://example.com/song.mp3' }],
      bassBoost: 8,
      volume: 0.9
    });

    expect(element).toBeDefined();
    expect(element.props.bassBoost).toBe(8);
  });
});
