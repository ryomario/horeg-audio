import { AudioEngine, AudioEngineCallbacks, AudioEnergy } from '../../../src/AudioEngine';
import { Track, LoopMode, EqPreset, EqBand, HoregPlayerOptions } from '../../../src/types';

export interface HoregCoreState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTrack: Track | null;
  currentIndex: number;
  playlist: Track[];
  currentTime: number;
  duration: number;
  bufferedPercent: number;
  volume: number;
  isMuted: boolean;
  bass: number;
  loopMode: LoopMode;
  isShuffle: boolean;
  eqPreset: EqPreset;
  bandGains: Record<EqBand, number>;
  error: Error | null;
}

export type HoregCoreEvent =
  | 'play'
  | 'pause'
  | 'trackChange'
  | 'playlistChange'
  | 'timeUpdate'
  | 'bufferUpdate'
  | 'ended'
  | 'error'
  | 'loadingChange'
  | 'stateChange'
  | 'eqChange'
  | 'bandGainChange'
  | 'volumeChange'
  | 'bassChange';

export type HoregCoreEventListener<T = any> = (data: T) => void;
export type HoregCoreStateSubscriber = (state: HoregCoreState) => void;

export interface HoregCoreOptions extends Partial<Omit<HoregPlayerOptions, 'container' | 'theme'>> {
  playlist?: Track[];
}

export class HoregCore {
  private engine: AudioEngine;
  private listeners: Map<HoregCoreEvent, Set<HoregCoreEventListener>> = new Map();
  private subscribers: Set<HoregCoreStateSubscriber> = new Set();
  private state: HoregCoreState;

  constructor(options: HoregCoreOptions = {}) {
    const initialPlaylist = [...(options.playlist || [])];
    const initialIdx = options.initialIndex !== undefined ? Math.max(0, Math.min(options.initialIndex, initialPlaylist.length - 1)) : 0;
    const initialTrack = initialPlaylist.length > 0 ? initialPlaylist[initialIdx] : null;

    const initialBands: Record<EqBand, number> = {
      sub: options.eqBandGains?.sub ?? 0,
      low: options.eqBandGains?.low ?? 0,
      mid: options.eqBandGains?.mid ?? 0,
      'upper-mid': options.eqBandGains?.['upper-mid'] ?? 0,
      high: options.eqBandGains?.high ?? 0
    };

    this.state = {
      isPlaying: false,
      isLoading: false,
      currentTrack: initialTrack,
      currentIndex: initialIdx,
      playlist: initialPlaylist,
      currentTime: 0,
      duration: 0,
      bufferedPercent: 0,
      volume: options.volume !== undefined ? options.volume : 0.8,
      isMuted: false,
      bass: options.bassBoost !== undefined ? options.bassBoost : 0,
      loopMode: options.loop || 'all',
      isShuffle: !!options.shuffle,
      eqPreset: options.eqPreset || 'flat',
      bandGains: initialBands,
      error: null
    };

    const callbacks: AudioEngineCallbacks = {
      onPlay: (track) => {
        this.patchState({ isPlaying: true, currentTrack: track, error: null });
        this.emit('play', track);
      },
      onPause: () => {
        this.patchState({ isPlaying: false });
        this.emit('pause', null);
      },
      onTrackChange: (track, index) => {
        this.patchState({ currentTrack: track, currentIndex: index, currentTime: 0, error: null });
        this.emit('trackChange', { track, index });
      },
      onPlaylistChange: (playlist, currentIndex) => {
        this.patchState({
          playlist: [...playlist],
          currentIndex,
          currentTrack: playlist[currentIndex] || null
        });
        this.emit('playlistChange', { playlist, currentIndex });
      },
      onTimeUpdate: (currentTime, duration) => {
        this.patchState({ currentTime, duration });
        this.emit('timeUpdate', { currentTime, duration });
      },
      onBufferUpdate: (bufferedPercent) => {
        this.patchState({ bufferedPercent });
        this.emit('bufferUpdate', bufferedPercent);
      },
      onEnded: (track) => {
        this.patchState({ isPlaying: false });
        this.emit('ended', track);
      },
      onError: (err) => {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        this.patchState({ error: errorObj, isLoading: false });
        this.emit('error', errorObj);
      },
      onLoadingChange: (isLoading) => {
        this.patchState({ isLoading });
        this.emit('loadingChange', isLoading);
      },
      onEqChange: (preset) => {
        this.patchState({ eqPreset: preset, bandGains: { ...this.engine.getBandGains() } });
        this.emit('eqChange', preset);
      },
      onBandGainChange: (band, gainDb) => {
        const newGains = { ...this.state.bandGains, [band]: gainDb };
        this.patchState({ bandGains: newGains });
        this.emit('bandGainChange', { band, gainDb });
      }
    };

    this.engine = new AudioEngine(options as HoregPlayerOptions, callbacks);
  }

  // --- State & Subscription API ---

  public getState(): HoregCoreState {
    return { ...this.state };
  }

  public subscribe(subscriber: HoregCoreStateSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getState());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public on<T = any>(event: HoregCoreEvent, listener: HoregCoreEventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.off(event, listener);
    };
  }

  public off<T = any>(event: HoregCoreEvent, listener: HoregCoreEventListener<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<T = any>(event: HoregCoreEvent, data: T): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error(`[HoregCore] Error in listener for event "${event}":`, err);
        }
      });
    }
  }

  private patchState(partial: Partial<HoregCoreState>): void {
    this.state = {
      ...this.state,
      ...partial
    };
    const snapshot = this.getState();
    this.emit('stateChange', snapshot);
    this.subscribers.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('[HoregCore] Error in state subscriber:', err);
      }
    });
  }

  // --- Audio Control Methods ---

  public async play(): Promise<void> {
    return this.engine.play();
  }

  public pause(): void {
    this.engine.pause();
  }

  public async togglePlay(): Promise<void> {
    this.engine.toggle();
  }

  public stop(): void {
    this.engine.pause();
    this.engine.seek(0);
    this.patchState({ isPlaying: false, currentTime: 0 });
  }

  public seek(seconds: number): void {
    this.engine.seek(seconds);
  }

  public next(): void {
    this.engine.next();
  }

  public prev(): void {
    this.engine.prev();
  }

  public setTrack(index: number, autoPlay: boolean = true): void {
    this.engine.loadTrack(index, autoPlay);
  }

  public addTrack(track: Track, playImmediately: boolean = false): void {
    this.engine.addTrack(track, playImmediately);
  }

  public removeTrack(index: number): void {
    this.engine.removeTrack(index);
  }

  public setVolume(level: number): void {
    this.engine.setVolume(level);
    this.patchState({ volume: this.engine.getVolume(), isMuted: false });
    this.emit('volumeChange', this.engine.getVolume());
  }

  public mute(): void {
    if (!this.engine.isMuted()) {
      this.engine.toggleMute();
    }
    this.patchState({ isMuted: true });
  }

  public unmute(): void {
    if (this.engine.isMuted()) {
      this.engine.toggleMute();
    }
    this.patchState({ isMuted: false });
  }

  public toggleMute(): void {
    const isMuted = this.engine.toggleMute();
    this.patchState({ isMuted });
  }

  public setBass(gain: number): void {
    this.engine.setBassGain(gain);
    this.patchState({ bass: this.engine.getBassGain() });
    this.emit('bassChange', this.engine.getBassGain());
  }

  public getBass(): number {
    return this.engine.getBassGain();
  }

  public setLoop(mode: LoopMode): void {
    this.engine.setLoop(mode);
    this.patchState({ loopMode: mode });
  }

  public toggleLoop(): LoopMode {
    const modes: LoopMode[] = ['all', 'one', 'none'];
    const currentIdx = modes.indexOf(this.state.loopMode);
    const nextIdx = (currentIdx + 1) % modes.length;
    const newMode = modes[nextIdx];
    this.setLoop(newMode);
    return newMode;
  }

  public setShuffle(enabled: boolean): void {
    this.engine.setShuffle(enabled);
    this.patchState({ isShuffle: enabled });
  }

  public toggleShuffle(): boolean {
    const nextState = !this.state.isShuffle;
    this.setShuffle(nextState);
    return nextState;
  }

  public setEqPreset(preset: EqPreset): void {
    this.engine.setEqualizerPreset(preset);
  }

  public setBandGain(band: EqBand, gainDb: number): void {
    this.engine.setBandGain(band, gainDb);
  }

  public getAudioEnergy(): AudioEnergy {
    return this.engine.getAudioEnergy();
  }

  public getAudioEngine(): AudioEngine {
    return this.engine;
  }

  public destroy(): void {
    this.listeners.clear();
    this.subscribers.clear();
    this.engine.destroy();
  }
}
