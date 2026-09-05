import { HoregPlayerOptions, HoregTheme, Track, LoopMode } from './types';
import { generateStyles } from './styles';
import { AudioEngine } from './AudioEngine';
import { UI } from './UI';
import { Visualizer } from './visualizer';

export class HoregAudio {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private styleEl: HTMLStyleElement;
  private audioEngine: AudioEngine;
  private ui: UI;
  private visualizer: Visualizer;
  private theme: HoregTheme;
  private boundKeyHandler: (e: KeyboardEvent) => void;

  constructor(options: HoregPlayerOptions) {
    if (typeof options.container === 'string') {
      const el = document.querySelector(options.container);
      if (!el) {
        throw new Error(`[HoregAudio] Container "${options.container}" not found in DOM.`);
      }
      this.container = el as HTMLElement;
    } else if (options.container instanceof HTMLElement) {
      this.container = options.container;
    } else {
      throw new Error('[HoregAudio] Invalid container option provided.');
    }

    this.theme = options.theme || { variant: 'horeg-classic' };

    // 1. Shadow DOM attachment
    this.shadow = this.container.attachShadow({ mode: 'open' });

    // 2. Inject encapsulated styles
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = generateStyles(this.theme);
    this.shadow.appendChild(this.styleEl);

    // 3. Instantiate UI
    this.ui = new UI({
      onPlayPauseClick: () => this.toggle(),
      onPrevClick: () => this.prev(),
      onNextClick: () => this.next(),
      onSeek: (seconds) => this.seek(seconds),
      onVolumeChange: (vol) => this.setVolume(vol),
      onMuteToggle: () => {
        const isMuted = this.audioEngine.toggleMute();
        this.ui.updateVolume(this.audioEngine.getVolume(), isMuted);
      },
      onShuffleToggle: () => {
        const nextShuffle = !this.audioEngine.isShuffle();
        this.audioEngine.setShuffle(nextShuffle);
        this.ui.updateShuffleState(nextShuffle);
      },
      onLoopToggle: () => {
        const currentLoop = this.audioEngine.getLoop();
        const nextLoop: LoopMode = currentLoop === 'all' ? 'one' : currentLoop === 'one' ? 'none' : 'all';
        this.audioEngine.setLoop(nextLoop);
        this.ui.updateLoopState(nextLoop);
      },
      onTrackSelect: (index) => {
        this.loadTrack(index);
        this.play();
      }
    });

    this.shadow.appendChild(this.ui.root);

    // 4. Initialize Visualizer
    this.visualizer = new Visualizer({
      container: this.ui.eqContainer,
      enableAnimation: this.theme.enableEqAnimation !== false
    });

    // 5. Initialize AudioEngine
    this.audioEngine = new AudioEngine(options, {
      onPlay: (track) => {
        this.ui.updatePlayState(true);
        this.visualizer.start();
        if (options.onPlay) options.onPlay(track);
      },
      onPause: () => {
        this.ui.updatePlayState(false);
        this.visualizer.stop();
        if (options.onPause) options.onPause();
      },
      onTrackChange: (track, index) => {
        this.ui.updateTrackInfo(track);
        this.ui.renderPlaylist(this.audioEngine.getPlaylist(), index);
        if (options.onTrackChange) options.onTrackChange(track, index);
      },
      onTimeUpdate: (currentTime, duration) => {
        this.ui.updateProgress(currentTime, duration);
        if (options.onTimeUpdate) options.onTimeUpdate(currentTime, duration);
      },
      onBufferUpdate: (percent) => {
        this.ui.updateBuffer(percent);
      },
      onEnded: (track) => {
        this.visualizer.stop();
        if (options.onEnded) options.onEnded(track);
      },
      onError: (err) => {
        this.ui.updatePlayState(false);
        this.visualizer.stop();
        if (options.onError) options.onError(err);
      }
    });

    // Initial states
    this.ui.updateVolume(this.audioEngine.getVolume(), this.audioEngine.isMuted());
    this.ui.updateLoopState(this.audioEngine.getLoop());
    this.ui.updateShuffleState(this.audioEngine.isShuffle());

    const currentTrack = this.audioEngine.getCurrentTrack();
    if (currentTrack) {
      this.ui.updateTrackInfo(currentTrack);
      this.ui.renderPlaylist(this.audioEngine.getPlaylist(), this.audioEngine.getCurrentIndex());
    }

    // Keyboard controls when container is active
    this.boundKeyHandler = this.handleKeyDown.bind(this);
    this.container.tabIndex = this.container.tabIndex >= 0 ? this.container.tabIndex : 0;
    this.container.addEventListener('keydown', this.boundKeyHandler);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Only intercept if active target is within container/shadow
    if (e.code === 'Space') {
      e.preventDefault();
      this.toggle();
    } else if (e.key === 'ArrowRight' && !e.shiftKey) {
      e.preventDefault();
      this.seek(this.audioEngine.getCurrentTime() + 5);
    } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
      e.preventDefault();
      this.seek(this.audioEngine.getCurrentTime() - 5);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.setVolume(this.audioEngine.getVolume() + 0.05);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.setVolume(this.audioEngine.getVolume() - 0.05);
    }
  }

  // --- Public API Methods ---

  public async play(): Promise<void> {
    await this.audioEngine.play();
  }

  public pause(): void {
    this.audioEngine.pause();
  }

  public toggle(): void {
    this.audioEngine.toggle();
  }

  public next(): void {
    this.audioEngine.next();
  }

  public prev(): void {
    this.audioEngine.prev();
  }

  public seek(seconds: number): void {
    this.audioEngine.seek(seconds);
  }

  public setVolume(level: number): void {
    this.audioEngine.setVolume(level);
    this.ui.updateVolume(this.audioEngine.getVolume(), this.audioEngine.isMuted());
  }

  public loadTrack(indexOrTrack: number | Track): void {
    this.audioEngine.loadTrack(indexOrTrack, false);
  }

  public setTheme(themeConfig: Partial<HoregTheme>): void {
    this.theme = { ...this.theme, ...themeConfig };
    this.styleEl.textContent = generateStyles(this.theme);
    if (this.theme.enableEqAnimation !== undefined) {
      this.visualizer.setEnabled(this.theme.enableEqAnimation);
    }
  }

  public getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  public destroy(): void {
    this.container.removeEventListener('keydown', this.boundKeyHandler);
    this.audioEngine.destroy();
    this.visualizer.destroy();
    this.ui.destroy();
    this.shadow.innerHTML = '';
  }
}

