import { HoregPlayerOptions, HoregTheme, Track, LoopMode, PersistenceOptions, VisualizerMode, EqPreset } from './types';
import { generateStyles, THEME_PRESETS } from './styles';
import { AudioEngine, AudioEnergy } from './AudioEngine';
import { UI } from './UI';
import { Visualizer } from './visualizer';

interface ResolvedPersistence {
  key: string;
  volume: boolean;
  bass: boolean;
  loop: boolean;
  shuffle: boolean;
  lastTrack: boolean;
}

export class HoregAudio {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private styleEl: HTMLStyleElement;
  private audioEngine: AudioEngine;
  private ui: UI;
  private visualizer: Visualizer;
  private theme: HoregTheme;
  private boundKeyHandler: (e: KeyboardEvent) => void;
  private onBassChangeCallback?: (bassLevel: number) => void;
  private onEqChangeCallback?: (preset: EqPreset) => void;
  private persistOpts: ResolvedPersistence | null = null;
  private isMediaSessionEnabled: boolean = true;

  constructor(options: HoregPlayerOptions) {
    this.onBassChangeCallback = options.onBassChange;
    this.onEqChangeCallback = options.onEqChange;
    this.isMediaSessionEnabled = options.mediaSession !== false;

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

    const initialVariant = options.theme?.variant || 'horeg-classic';
    const initialPreset = THEME_PRESETS[initialVariant] || THEME_PRESETS['horeg-classic'];
    this.theme = {
      ...initialPreset,
      ...(options.theme || {})
    };

    // State persistence setup & restoration
    if (options.persistState) {
      const isObj = typeof options.persistState === 'object';
      const userOpts = isObj ? (options.persistState as PersistenceOptions) : {};
      this.persistOpts = {
        key: userOpts.key || 'horeg_audio_state',
        volume: userOpts.volume !== undefined ? userOpts.volume : true,
        bass: userOpts.bass !== undefined ? userOpts.bass : true,
        loop: userOpts.loop !== undefined ? userOpts.loop : true,
        shuffle: userOpts.shuffle !== undefined ? userOpts.shuffle : true,
        lastTrack: userOpts.lastTrack !== undefined ? userOpts.lastTrack : true
      };
    }

    let initialVolume = options.volume !== undefined ? options.volume : 0.8;
    let initialBass = options.bassBoost !== undefined ? options.bassBoost : 0;
    let initialLoop: LoopMode = options.loop || 'all';
    let initialShuffle: boolean = !!options.shuffle;
    let initialIndex = options.initialIndex !== undefined ? options.initialIndex : 0;

    if (this.persistOpts && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(this.persistOpts.key);
        if (raw) {
          const saved = JSON.parse(raw);
          if (this.persistOpts.volume && typeof saved.volume === 'number') initialVolume = saved.volume;
          if (this.persistOpts.bass && typeof saved.bass === 'number') initialBass = saved.bass;
          if (this.persistOpts.loop && typeof saved.loop === 'string') initialLoop = saved.loop as LoopMode;
          if (this.persistOpts.shuffle && typeof saved.shuffle === 'boolean') initialShuffle = saved.shuffle;
          if (this.persistOpts.lastTrack && typeof saved.lastTrack === 'number') initialIndex = saved.lastTrack;
        }
      } catch (_) {}
    }

    const effectiveOptions: HoregPlayerOptions = {
      ...options,
      volume: initialVolume,
      bassBoost: initialBass,
      loop: initialLoop,
      shuffle: initialShuffle,
      initialIndex
    };

    // 1. Shadow DOM attachment
    this.shadow = this.container.attachShadow({ mode: 'open' });

    // 2. Inject encapsulated styles
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = generateStyles(this.theme, effectiveOptions.maxWidth);
    this.shadow.appendChild(this.styleEl);

    // 3. Instantiate UI
    this.ui = new UI({
      onPlayPauseClick: () => this.toggle(),
      onPrevClick: () => this.prev(),
      onNextClick: () => this.next(),
      onSeek: (seconds) => this.seek(seconds),
      onVolumeChange: (vol) => this.setVolume(vol, false),
      onBassChange: (db) => this.setBass(db),
      onMuteToggle: () => {
        const isMuted = this.audioEngine.toggleMute();
        this.ui.updateVolume(this.audioEngine.getVolume(), isMuted);
        this.savePersistedState();
      },
      onShuffleToggle: () => {
        const nextShuffle = !this.audioEngine.isShuffle();
        this.audioEngine.setShuffle(nextShuffle);
        this.ui.updateShuffleState(nextShuffle);
        this.savePersistedState();
      },
      onLoopToggle: () => {
        const currentLoop = this.audioEngine.getLoop();
        const nextLoop: LoopMode = currentLoop === 'all' ? 'one' : currentLoop === 'one' ? 'none' : 'all';
        this.audioEngine.setLoop(nextLoop);
        this.ui.updateLoopState(nextLoop);
        this.savePersistedState();
      },
      onTrackSelect: (index) => {
        this.loadTrack(index, true);
      },
      onAddTrackFiles: (files) => {
        this.addTrackFromFiles(files, false);
      },
      onAddTrackUrl: (url, title, artist) => {
        this.addTrackFromUrl(url, { title, artist }, false);
      },
      onRemoveTrack: (index) => {
        this.removeTrack(index);
      }
    }, {
      enableBassControl: effectiveOptions.enableBassControl !== false,
      initialBass: effectiveOptions.bassBoost !== undefined ? effectiveOptions.bassBoost : 0
    });

    this.shadow.appendChild(this.ui.root);

    // 4. Initialize Visualizer
    this.visualizer = new Visualizer({
      stageContainer: this.ui.stageContainer,
      coverContainer: this.ui.coverContainer,
      mode: effectiveOptions.visualizerMode || 'dom',
      enableAnimation: this.theme.enableEqAnimation !== false
    });

    // 5. Initialize AudioEngine
    this.audioEngine = new AudioEngine(effectiveOptions, {
      onPlay: (track) => {
        this.ui.updatePlayState(true);
        this.visualizer.start();
        this.updateMediaSessionPlaybackState('playing');
        if (options.onPlay) options.onPlay(track);
      },
      onPause: () => {
        this.ui.updatePlayState(false);
        this.visualizer.stop();
        this.updateMediaSessionPlaybackState('paused');
        if (options.onPause) options.onPause();
      },
      onTrackChange: (track, index) => {
        this.ui.updateTrackInfo(track);
        const playlist = this.audioEngine ? this.audioEngine.getPlaylist() : (options.playlist || []);
        this.ui.renderPlaylist(playlist, index);
        this.ui.updateProgress(0, track.duration || 0);
        this.updateMediaSession(track);
        this.savePersistedState();
        if (options.onTrackChange) options.onTrackChange(track, index);
      },
      onPlaylistChange: (playlist, index) => {
        this.ui.renderPlaylist(playlist, index);
        if (options.onPlaylistChange) options.onPlaylistChange(playlist, index);
      },
      onTimeUpdate: (currentTime, duration) => {
        this.ui.updateProgress(currentTime, duration);
        if (this.isMediaSessionEnabled && 'mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
          try {
            if (duration > 0 && currentTime <= duration) {
              navigator.mediaSession.setPositionState({
                duration,
                playbackRate: 1,
                position: Math.min(currentTime, duration)
              });
            }
          } catch (_) {}
        }
        if (options.onTimeUpdate) options.onTimeUpdate(currentTime, duration);
      },
      onBufferUpdate: (percent) => {
        this.ui.updateBuffer(percent);
      },
      onEnded: (track) => {
        this.visualizer.stop();
        this.updateMediaSessionPlaybackState('paused');
        if (options.onEnded) options.onEnded(track);
      },
      onError: (err) => {
        this.ui.updatePlayState(false);
        this.visualizer.stop();
        this.updateMediaSessionPlaybackState('none');
        if (options.onError) options.onError(err);
      }
    });

    this.visualizer.setAudioEnergyGetter(() => this.audioEngine.getAudioEnergy());

    // Initial states
    this.ui.updateVolume(this.audioEngine.getVolume(), this.audioEngine.isMuted());
    this.ui.updateBass(this.audioEngine.getBassGain());
    this.ui.updateLoopState(this.audioEngine.getLoop());
    this.ui.updateShuffleState(this.audioEngine.isShuffle());
    this.ui.renderPlaylist(this.audioEngine.getPlaylist(), this.audioEngine.getCurrentIndex());

    const currentTrack = this.audioEngine.getCurrentTrack();
    if (currentTrack) {
      this.ui.updateTrackInfo(currentTrack);
      this.ui.renderPlaylist(this.audioEngine.getPlaylist(), this.audioEngine.getCurrentIndex());
      this.updateMediaSession(currentTrack);
    }

    // Initialize Media Session OS action handlers
    this.setupMediaSession();

    // Keyboard controls when container is active
    this.boundKeyHandler = this.handleKeyDown.bind(this);
    this.container.tabIndex = this.container.tabIndex >= 0 ? this.container.tabIndex : 0;
    this.container.addEventListener('keydown', this.boundKeyHandler);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const path = e.composedPath ? e.composedPath() : [];
    const target = (path.length > 0 ? path[0] : e.target) as HTMLElement | null;
    const activeEl = (this.shadow?.activeElement || document.activeElement) as HTMLElement | null;

    const isInputElement = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    // Do not intercept if user is typing or interacting with form controls
    if (isInputElement(target) || isInputElement(activeEl)) {
      return;
    }

    if (e.code === 'Space') {
      // If a button is focused, let space trigger native button click
      if (target?.tagName === 'BUTTON' || activeEl?.tagName === 'BUTTON') {
        return;
      }
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

  public setVolume(level: number, updateSlider: boolean = true): void {
    this.audioEngine.setVolume(level);
    this.ui.updateVolume(this.audioEngine.getVolume(), this.audioEngine.isMuted(), updateSlider);
    this.savePersistedState();
  }

  public setBass(gainDb: number): void {
    const clamped = Math.max(-10, Math.min(15, gainDb));
    this.audioEngine.setBassGain(clamped);
    this.ui.updateBass(clamped);
    if (this.onBassChangeCallback) {
      this.onBassChangeCallback(clamped);
    }
    this.savePersistedState();
  }

  public getBass(): number {
    return this.audioEngine.getBassGain();
  }

  public loadTrack(indexOrTrack: number | Track, autoPlay: boolean = false): void {
    this.audioEngine.loadTrack(indexOrTrack, autoPlay);
  }

  public addTrack(track: Track, autoPlay: boolean = false): number {
    const index = this.audioEngine.addTrack(track, autoPlay);
    this.ui.renderPlaylist(this.audioEngine.getPlaylist(), this.audioEngine.getCurrentIndex());
    return index;
  }

  public addTracks(tracks: Track[], autoPlay: boolean = false): void {
    this.audioEngine.addTracks(tracks, autoPlay);
    this.ui.renderPlaylist(this.audioEngine.getPlaylist(), this.audioEngine.getCurrentIndex());
  }

  public async addTrackFromFile(file: File, autoPlay: boolean = false): Promise<Track> {
    const src = URL.createObjectURL(file);
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    const track: Track = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: nameWithoutExt,
      artist: 'Local Audio File',
      src
    };

    try {
      const dur = await this.probeAudioDuration(src);
      if (dur > 0) {
        track.duration = dur;
      }
    } catch {
      // AudioEngine will pick up duration on loadedmetadata
    }

    this.addTrack(track, autoPlay);
    return track;
  }

  public async addTrackFromFiles(files: FileList | File[], autoPlay: boolean = false): Promise<Track[]> {
    const fileArray = Array.from(files);
    const addedTracks: Track[] = [];
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const shouldAutoPlay = autoPlay && i === 0;
      const track = await this.addTrackFromFile(file, shouldAutoPlay);
      addedTracks.push(track);
    }
    return addedTracks;
  }

  public async addTrackFromUrl(url: string, meta: Partial<Track> = {}, autoPlay: boolean = false): Promise<Track> {
    let fallbackTitle = 'Online Track';
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (lastPart) {
        fallbackTitle = decodeURIComponent(lastPart).replace(/\.[^/.]+$/, '');
      }
    } catch {
      // In case of non-standard URL or data URI
    }

    const track: Track = {
      id: meta.id || `url-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: meta.title?.trim() || fallbackTitle,
      artist: meta.artist?.trim() || 'Audio Stream',
      album: meta.album,
      coverArt: meta.coverArt,
      src: url,
      duration: meta.duration
    };

    if (!track.duration) {
      try {
        const dur = await this.probeAudioDuration(url);
        if (dur > 0) {
          track.duration = dur;
        }
      } catch {
        // Fallback to loadedmetadata
      }
    }

    this.addTrack(track, autoPlay);
    return track;
  }

  public removeTrack(index: number): void {
    this.audioEngine.removeTrack(index);
    this.ui.renderPlaylist(this.audioEngine.getPlaylist(), this.audioEngine.getCurrentIndex());
    const current = this.audioEngine.getCurrentTrack();
    if (current) {
      this.ui.updateTrackInfo(current);
    } else {
      this.ui.updateTrackInfo({ title: 'No Track Loaded', src: '' });
    }
  }

  public getPlaylist(): Track[] {
    return this.audioEngine.getPlaylist();
  }

  private probeAudioDuration(src: string): Promise<number> {
    return new Promise((resolve) => {
      const tempAudio = new Audio();
      let isResolved = false;

      const finish = (dur: number) => {
        if (!isResolved) {
          isResolved = true;
          tempAudio.removeEventListener('loadedmetadata', onLoaded);
          tempAudio.removeEventListener('error', onError);
          tempAudio.src = '';
          resolve(dur);
        }
      };

      const onLoaded = () => {
        const d = tempAudio.duration;
        finish(d && !isNaN(d) && isFinite(d) ? d : 0);
      };

      const onError = () => finish(0);

      tempAudio.addEventListener('loadedmetadata', onLoaded);
      tempAudio.addEventListener('error', onError);
      tempAudio.src = src;

      setTimeout(() => finish(0), 3000);
    });
  }

  public setTheme(themeConfig: Partial<HoregTheme>): void {
    if (themeConfig.variant) {
      const preset = THEME_PRESETS[themeConfig.variant] || THEME_PRESETS['horeg-classic'];
      this.theme = {
        ...preset,
        ...themeConfig
      };
    } else {
      this.theme = {
        ...this.theme,
        ...themeConfig
      };
    }
    this.styleEl.textContent = generateStyles(this.theme);
    if (this.theme.enableEqAnimation !== undefined) {
      this.visualizer.setEnabled(this.theme.enableEqAnimation);
    }
  }

  public getTheme(): HoregTheme {
    return { ...this.theme };
  }

  public getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  public getAudioEnergy(): AudioEnergy {
    return this.audioEngine.getAudioEnergy();
  }

  private savePersistedState(): void {
    if (!this.persistOpts || typeof window === 'undefined' || !window.localStorage) return;
    try {
      const stateToSave: Record<string, unknown> = {};
      if (this.persistOpts.volume) stateToSave.volume = this.audioEngine.getVolume();
      if (this.persistOpts.bass) stateToSave.bass = this.audioEngine.getBassGain();
      if (this.persistOpts.loop) stateToSave.loop = this.audioEngine.getLoop();
      if (this.persistOpts.shuffle) stateToSave.shuffle = this.audioEngine.isShuffle();
      if (this.persistOpts.lastTrack) stateToSave.lastTrack = this.audioEngine.getCurrentIndex();
      localStorage.setItem(this.persistOpts.key, JSON.stringify(stateToSave));
    } catch (_) {}
  }

  private setupMediaSession(): void {
    if (!this.isMediaSessionEnabled || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.seek(details.seekTime);
        }
      });
    } catch (_) {}
  }

  private updateMediaSession(track: Track): void {
    if (!this.isMediaSessionEnabled || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const artwork: MediaImage[] = [];
      if (track.coverArt) {
        artwork.push({
          src: track.coverArt,
          sizes: '512x512',
          type: 'image/jpeg'
        });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Horeg Audio',
        artist: track.artist || 'Horeg Sound System',
        album: track.album || 'Sound Horeg Audio Player',
        artwork
      });
    } catch (_) {}
  }

  public setEqPreset(preset: EqPreset): void {
    this.audioEngine.setEqPreset(preset);
    if (this.onEqChangeCallback) {
      this.onEqChangeCallback(preset);
    }
  }

  public getEqPreset(): EqPreset {
    return this.audioEngine.getEqPreset();
  }

  public setVisualizerMode(mode: VisualizerMode): void {
    this.visualizer.setMode(mode);
  }

  public getVisualizerMode(): VisualizerMode {
    return this.visualizer.getMode();
  }

  private updateMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (this.isMediaSessionEnabled && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = state;
      } catch (_) {}
    }
  }

  public destroy(): void {
    this.container.removeEventListener('keydown', this.boundKeyHandler);
    if (this.isMediaSessionEnabled && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.playbackState = 'none';
      } catch (_) {}
    }
    this.audioEngine.destroy();
    this.visualizer.destroy();
    this.ui.destroy();
    this.shadow.innerHTML = '';
  }
}

