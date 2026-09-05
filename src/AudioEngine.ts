import { Track, LoopMode, HoregPlayerOptions } from './types';
import { clamp } from './utils/time';

export interface AudioEngineCallbacks {
  onPlay?: (track: Track) => void;
  onPause?: () => void;
  onTrackChange?: (track: Track, index: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onBufferUpdate?: (bufferedPercent: number) => void;
  onEnded?: (track: Track) => void;
  onError?: (error: MediaError | Error) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export class AudioEngine {
  private audio: HTMLAudioElement;
  private playlist: Track[] = [];
  private currentIndex: number = 0;
  private loopMode: LoopMode = 'all';
  private shuffleMode: boolean = false;
  private volumeLevel: number = 0.8;
  private previousVolume: number = 0.8;
  private callbacks: AudioEngineCallbacks = {};

  constructor(options: HoregPlayerOptions, callbacks: AudioEngineCallbacks = {}) {
    this.audio = new Audio();
    this.playlist = [...(options.playlist || [])];
    this.currentIndex = options.initialIndex !== undefined ? clamp(options.initialIndex, 0, Math.max(0, this.playlist.length - 1)) : 0;
    this.loopMode = options.loop || 'all';
    this.shuffleMode = !!options.shuffle;
    this.volumeLevel = options.volume !== undefined ? clamp(options.volume, 0, 1) : 0.8;
    this.callbacks = {
      onPlay: options.onPlay || callbacks.onPlay,
      onPause: options.onPause || callbacks.onPause,
      onTrackChange: options.onTrackChange || callbacks.onTrackChange,
      onTimeUpdate: options.onTimeUpdate || callbacks.onTimeUpdate,
      onEnded: options.onEnded || callbacks.onEnded,
      onError: options.onError || callbacks.onError,
      onBufferUpdate: callbacks.onBufferUpdate,
      onLoadingChange: callbacks.onLoadingChange
    };

    this.audio.volume = this.volumeLevel;
    this.attachEvents();

    if (this.playlist.length > 0) {
      this.loadTrack(this.currentIndex, !!options.autoplay);
    }
  }

  private attachEvents(): void {
    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('progress', this.handleProgress);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('error', this.handleError);
    this.audio.addEventListener('waiting', this.handleWaiting);
    this.audio.addEventListener('playing', this.handlePlaying);
    this.audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
  }

  private detachEvents(): void {
    this.audio.removeEventListener('play', this.handlePlay);
    this.audio.removeEventListener('pause', this.handlePause);
    this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.removeEventListener('progress', this.handleProgress);
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeEventListener('error', this.handleError);
    this.audio.removeEventListener('waiting', this.handleWaiting);
    this.audio.removeEventListener('playing', this.handlePlaying);
    this.audio.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
  }

  private handlePlay = (): void => {
    const current = this.getCurrentTrack();
    if (current && this.callbacks.onPlay) {
      this.callbacks.onPlay(current);
    }
  };

  private handlePause = (): void => {
    if (this.callbacks.onPause) {
      this.callbacks.onPause();
    }
  };

  private handleTimeUpdate = (): void => {
    const current = this.audio.currentTime || 0;
    const duration = this.getDuration();
    if (this.callbacks.onTimeUpdate) {
      this.callbacks.onTimeUpdate(current, duration);
    }
  };

  private handleProgress = (): void => {
    if (this.audio.buffered.length > 0 && this.audio.duration > 0) {
      const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
      const percent = clamp((bufferedEnd / this.audio.duration) * 100, 0, 100);
      if (this.callbacks.onBufferUpdate) {
        this.callbacks.onBufferUpdate(percent);
      }
    }
  };

  private handleLoadedMetadata = (): void => {
    const current = this.audio.currentTime || 0;
    const duration = this.getDuration();
    if (this.callbacks.onTimeUpdate) {
      this.callbacks.onTimeUpdate(current, duration);
    }
    this.handleProgress();
  };

  private handleWaiting = (): void => {
    if (this.callbacks.onLoadingChange) {
      this.callbacks.onLoadingChange(true);
    }
  };

  private handlePlaying = (): void => {
    if (this.callbacks.onLoadingChange) {
      this.callbacks.onLoadingChange(false);
    }
  };

  private handleEnded = (): void => {
    const current = this.getCurrentTrack();
    if (current && this.callbacks.onEnded) {
      this.callbacks.onEnded(current);
    }

    if (this.loopMode === 'one') {
      this.audio.currentTime = 0;
      this.play();
    } else {
      this.next(true);
    }
  };

  private handleError = (): void => {
    const err = this.audio.error || new Error('Unknown audio playback error');
    if (this.callbacks.onError) {
      this.callbacks.onError(err);
    }
  };

  public getCurrentTrack(): Track | undefined {
    return this.playlist[this.currentIndex];
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getPlaylist(): Track[] {
    return this.playlist;
  }

  public setPlaylist(newPlaylist: Track[], startIndex: number = 0): void {
    this.playlist = [...newPlaylist];
    this.currentIndex = clamp(startIndex, 0, Math.max(0, this.playlist.length - 1));
    this.loadTrack(this.currentIndex, false);
  }

  public getDuration(): number {
    const dur = this.audio.duration;
    if (dur && !isNaN(dur) && isFinite(dur)) {
      return dur;
    }
    const currentTrack = this.getCurrentTrack();
    return currentTrack?.duration || 0;
  }

  public getCurrentTime(): number {
    return this.audio.currentTime || 0;
  }

  public isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended && this.audio.readyState > 2;
  }

  public isMuted(): boolean {
    return this.audio.muted || this.audio.volume === 0;
  }

  public getVolume(): number {
    return this.audio.volume;
  }

  public getLoop(): LoopMode {
    return this.loopMode;
  }

  public isShuffle(): boolean {
    return this.shuffleMode;
  }

  public loadTrack(indexOrTrack: number | Track, autoPlay: boolean = false): void {
    let targetIndex: number;

    if (typeof indexOrTrack === 'number') {
      targetIndex = clamp(indexOrTrack, 0, Math.max(0, this.playlist.length - 1));
    } else {
      targetIndex = this.playlist.findIndex((t) => t.src === indexOrTrack.src);
      if (targetIndex === -1) {
        this.playlist.push(indexOrTrack);
        targetIndex = this.playlist.length - 1;
      }
    }

    this.currentIndex = targetIndex;
    const track = this.playlist[this.currentIndex];

    if (!track) return;

    this.audio.src = track.src;
    this.audio.load();

    if (this.callbacks.onTrackChange) {
      this.callbacks.onTrackChange(track, this.currentIndex);
    }

    if (autoPlay) {
      this.play();
    }
  }

  public async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch (err) {
      // Modern browser autoplay policy rejection handling
      // Prevents unhandled promise rejection error in developer console
      console.warn('[HoregAudio] Autoplay / Audio play was prevented by browser policy:', err);
    }
  }

  public pause(): void {
    this.audio.pause();
  }

  public toggle(): void {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  public seek(seconds: number): void {
    const duration = this.getDuration();
    const clampedTime = clamp(seconds, 0, duration > 0 ? duration : Infinity);
    this.audio.currentTime = clampedTime;
  }

  public setVolume(level: number): void {
    const clamped = clamp(level, 0, 1);
    this.volumeLevel = clamped;
    this.audio.volume = clamped;
    if (clamped > 0) {
      this.audio.muted = false;
      this.previousVolume = clamped;
    }
  }

  public toggleMute(): boolean {
    if (this.isMuted()) {
      this.audio.muted = false;
      this.setVolume(this.previousVolume > 0 ? this.previousVolume : 0.5);
      return false;
    } else {
      this.previousVolume = this.audio.volume;
      this.audio.muted = true;
      return true;
    }
  }

  public next(isFromEnded: boolean = false): void {
    if (this.playlist.length === 0) return;

    if (this.shuffleMode && this.playlist.length > 1) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * this.playlist.length);
      } while (randomIndex === this.currentIndex);
      this.loadTrack(randomIndex, true);
      return;
    }

    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.playlist.length) {
      this.loadTrack(nextIndex, true);
    } else if (this.loopMode === 'all') {
      this.loadTrack(0, true);
    } else if (!isFromEnded) {
      this.loadTrack(0, true);
    } else {
      this.pause();
    }
  }

  public prev(): void {
    if (this.playlist.length === 0) return;

    // If more than 3 seconds in, restart track
    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (this.shuffleMode && this.playlist.length > 1) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * this.playlist.length);
      } while (randomIndex === this.currentIndex);
      this.loadTrack(randomIndex, true);
      return;
    }

    const prevIndex = this.currentIndex - 1;
    if (prevIndex >= 0) {
      this.loadTrack(prevIndex, true);
    } else if (this.loopMode === 'all') {
      this.loadTrack(this.playlist.length - 1, true);
    } else {
      this.seek(0);
    }
  }

  public setLoop(mode: LoopMode): void {
    this.loopMode = mode;
  }

  public setShuffle(shuffle: boolean): void {
    this.shuffleMode = shuffle;
  }

  public setCallbacks(callbacks: AudioEngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public destroy(): void {
    this.detachEvents();
    this.audio.pause();
    this.audio.src = '';
    this.audio.load();
  }
}

