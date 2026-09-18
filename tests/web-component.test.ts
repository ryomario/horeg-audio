import { describe, it, expect, beforeEach } from 'vitest';
import { setupDomMocks } from './mocks/dom';
import { setupAudioMocks } from './mocks/audio';

setupDomMocks();
setupAudioMocks();

import { HoregAudioElement, registerHoregAudioElement } from '../packages/ui/src/index';

describe('Web Component <horeg-audio> Unit Tests', () => {
  beforeEach(() => {
    registerHoregAudioElement('horeg-audio');
  });

  it('should register custom element tag properly', () => {
    expect(customElements.get('horeg-audio')).toBeDefined();
  });

  it('should instantiate and mount HoregAudioElement with attributes', () => {
    const el = new HoregAudioElement();
    el.setAttribute('src', 'https://example.com/audio.mp3');
    el.setAttribute('title', 'Bass Carnival');
    el.setAttribute('artist', 'DJ Horeg');
    el.setAttribute('bass', '9');
    el.setAttribute('volume', '0.85');
    el.setAttribute('theme', 'horeg-classic');

    el.connectedCallback();

    expect(el.player).toBeDefined();
    expect(el.bass).toBe(9);
    expect(el.volume).toBe(0.85);
    expect(el.paused).toBe(true);

    // Update bass via element property setter
    el.bass = 12;
    expect(el.player?.getBass()).toBe(12);

    // Update attribute dynamically
    el.setAttribute('bass', '4');
    expect(el.player?.getBass()).toBe(4);

    el.disconnectedCallback();
    expect(el.player).toBeNull();
  });

  it('should dispatch custom events on playback actions', () => {
    const el = new HoregAudioElement();
    el.setAttribute('src', 'https://example.com/audio.mp3');
    el.connectedCallback();

    let playDispatched = false;
    el.addEventListener('play', () => {
      playDispatched = true;
    });

    el.play();
    expect(playDispatched).toBe(true);

    el.disconnectedCallback();
  });
});
