import { Track, LoopMode, HoregPlayerOptions } from './types';
import { clamp } from './utils/time';

export interface AudioEngineCallbacks {
  onPlay?: (track: Track) => void;
  onPause?: () => void;
  onTrackChange?: (track: Track, index: number) => void;
  onPlaylistChange?: (playlist: Track[], currentIndex: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onBufferUpdate?: (bufferedPercent: number) => void;
  onEnded?: (track: Track) => void;
  onError?: (error: MediaError | Error) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export interface AudioEnergy {
  bass: number;
  midHigh: number;
  left: number;
  right: number;
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

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private freqData: Uint8Array | null = null;
  private webAudioInitialized: boolean = false;
  private bassRollingAvg: number = 0.2;
  private bassPulseEnvelope: number = 0;

  constructor(options: HoregPlayerOptions, callbacks: AudioEngineCallbacks = {}) {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.playlist = [...(options.playlist || [])];
    this.currentIndex = options.initialIndex !== undefined ? clamp(options.initialIndex, 0, Math.max(0, this.playlist.length - 1)) : 0;
    this.loopMode = options.loop || 'all';
    this.shuffleMode = !!options.shuffle;
    this.volumeLevel = options.volume !== undefined ? clamp(options.volume, 0, 1) : 0.8;
    this.callbacks = callbacks || {
      onPlay: options.onPlay,
      onPause: options.onPause,
      onTrackChange: options.onTrackChange,
      onPlaylistChange: options.onPlaylistChange,
      onTimeUpdate: options.onTimeUpdate,
      onEnded: options.onEnded,
      onError: options.onError
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
    this.audio.addEventListener('seeked', this.handleSeeked);
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
    this.audio.removeEventListener('seeked', this.handleSeeked);
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
    if (this.audio.seeking) return;
    const current = this.audio.currentTime || 0;
    const duration = this.getDuration();
    if (this.callbacks.onTimeUpdate) {
      this.callbacks.onTimeUpdate(current, duration);
    }
  };

  private handleSeeked = (): void => {
    const current = this.audio.currentTime || 0;
    const duration = this.getDuration();
    if (this.callbacks.onTimeUpdate) {
      this.callbacks.onTimeUpdate(current, duration);
    }
  };

  private handleProgress = (): void => {
    if (this.audio.buffered.length > 0 && this.audio.duration > 0) {
      const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
      const duration = this.audio.duration;
      const percent = clamp((bufferedEnd / duration) * 100, 0, 100);
      if (this.callbacks.onBufferUpdate) {
        this.callbacks.onBufferUpdate(percent);
      }
    }
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

  private handleLoadedMetadata = (): void => {
    const duration = this.getDuration();
    if (this.callbacks.onTimeUpdate) {
      this.callbacks.onTimeUpdate(this.audio.currentTime || 0, duration);
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
    if (this.callbacks.onPlaylistChange) {
      this.callbacks.onPlaylistChange([...this.playlist], this.currentIndex);
    }
    if (this.playlist.length > 0) {
      this.loadTrack(this.currentIndex, false);
    } else {
      this.audio.pause();
      this.audio.src = '';
      if (this.callbacks.onTrackChange) {
        this.callbacks.onTrackChange({ title: 'No Track Loaded', src: '' }, 0);
      }
    }
  }

  public addTrack(track: Track, autoPlay: boolean = false): number {
    const wasEmpty = this.playlist.length === 0;
    this.playlist.push(track);
    const newIndex = this.playlist.length - 1;

    if (this.callbacks.onPlaylistChange) {
      this.callbacks.onPlaylistChange([...this.playlist], this.currentIndex);
    }

    if (wasEmpty) {
      this.loadTrack(0, autoPlay);
    } else if (autoPlay) {
      this.loadTrack(newIndex, true);
    }

    return newIndex;
  }

  public addTracks(tracks: Track[], autoPlay: boolean = false): void {
    if (!tracks || tracks.length === 0) return;
    const wasEmpty = this.playlist.length === 0;
    const firstAddedIndex = this.playlist.length;
    this.playlist.push(...tracks);

    if (this.callbacks.onPlaylistChange) {
      this.callbacks.onPlaylistChange([...this.playlist], this.currentIndex);
    }

    if (wasEmpty) {
      this.loadTrack(0, autoPlay);
    } else if (autoPlay) {
      this.loadTrack(firstAddedIndex, true);
    }
  }

  public removeTrack(index: number): void {
    if (index < 0 || index >= this.playlist.length) return;
    const isCurrentTrack = index === this.currentIndex;
    this.playlist.splice(index, 1);

    if (this.playlist.length === 0) {
      this.currentIndex = 0;
      this.audio.pause();
      this.audio.src = '';
      if (this.callbacks.onTrackChange) {
        this.callbacks.onTrackChange({ title: 'No Track Loaded', src: '' }, 0);
      }
    } else if (isCurrentTrack) {
      const nextIndex = clamp(index, 0, this.playlist.length - 1);
      this.loadTrack(nextIndex, false);
    } else if (index < this.currentIndex) {
      this.currentIndex--;
    }

    if (this.callbacks.onPlaylistChange) {
      this.callbacks.onPlaylistChange([...this.playlist], this.currentIndex);
    }
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
    return !this.audio.paused && !this.audio.ended;
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

    if (this.callbacks.onTrackChange) {
      this.callbacks.onTrackChange(track, this.currentIndex);
    }

    if (autoPlay) {
      this.play();
    }
  }

  public async play(): Promise<void> {
    this.initWebAudio();
    try {
      await this.audio.play();
    } catch (err) {
      console.warn('[HoregAudio] Autoplay / Audio play was prevented by browser policy:', err);
    }
  }

  public initWebAudio(): void {
    if (this.webAudioInitialized) {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.65;
      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.webAudioInitialized = true;
    } catch (e) {
      this.webAudioInitialized = true;
    }
  }

  public getAudioEnergy(): AudioEnergy {
    if (!this.isPlaying()) {
      return { bass: 0, midHigh: 0, left: 0, right: 0 };
    }

    const volumeFactor = this.isMuted() ? 0 : Math.max(0.35, Math.sqrt(this.volumeLevel));

    // 1. Try reading from AnalyserNode
    if (this.analyser && this.freqData && this.audioContext && this.audioContext.state === 'running') {
      try {
        (this.analyser as any).getByteFrequencyData(this.freqData);
        let sumBass = 0;
        const bassBins = Math.min(4, this.freqData.length);
        for (let i = 0; i < bassBins; i++) {
          sumBass += this.freqData[i];
        }
        let sumMid = 0;
        const midBins = Math.min(16, this.freqData.length);
        for (let i = bassBins; i < midBins; i++) {
          sumMid += this.freqData[i];
        }

        const rawBass = sumBass / (bassBins * 255);
        const rawMid = sumMid / ((midBins - bassBins) * 255);

        // If audio is silent or below noise floor, energy MUST be 0
        if (rawBass < 0.025 && rawMid < 0.025) {
          this.bassPulseEnvelope *= 0.5;
          if (this.bassPulseEnvelope < 0.01) this.bassPulseEnvelope = 0;
          return {
            bass: 0,
            midHigh: 0,
            left: 0,
            right: 0
          };
        }

        const soundEnergy = Math.max(rawBass, rawMid * 0.7);

        // 1. Direct sustained bass presence (so rolling basslines/continuous notes don't vanish)
        const sustainedBass = rawBass * 0.75;

        // 2. Adaptive transient beat detection for kick punch
        this.bassRollingAvg = this.bassRollingAvg * 0.92 + rawBass * 0.08;
        const delta = Math.max(0, rawBass - this.bassRollingAvg);
        const transientKick = delta > 0.006 ? Math.min(1, delta * 4.5 + 0.30 + rawBass * 0.35) : 0;

        // 3. Dynamic minimal pulse (keeps subwoofer breathing/pulsing while music is sounding)
        const t = this.audio.currentTime > 0 ? this.audio.currentTime : Date.now() / 1000;
        const microPulse = (Math.sin(t * 13) * 0.5 + 0.5) * 0.08 * Math.min(1, soundEnergy * 2.5);
        const minPulse = 0.09 * Math.min(1, soundEnergy * 3.0) + microPulse;

        // Target bass combines transient kick, sustained bass, and guaranteed minimal pulse
        const instantTarget = Math.max(transientKick, sustainedBass, minPulse);

        // Fast attack, smooth decay that never drops below active minimal pulse
        this.bassPulseEnvelope = Math.max(instantTarget, this.bassPulseEnvelope * 0.82);

        const bassVal = Math.min(1, this.bassPulseEnvelope) * volumeFactor;
        const midVal = Math.min(1, rawMid * 1.3) * volumeFactor;
        return {
          bass: bassVal,
          midHigh: midVal,
          left: midVal * 0.9,
          right: midVal * 0.95
        };
      } catch (_) {
        // Fall through to fallback ONLY if analyser threw an error
      }
    }

    // 2. Intelligent Rhythmic Fallback (ONLY used if Analyser is not available or blocked)
    if (!this.analyser || !this.audioContext || this.audioContext.state !== 'running') {
      const t = this.audio.currentTime > 0 ? this.audio.currentTime : Date.now() / 1000;
      const tempo = 130;
      const beatInterval = 60 / tempo;
      const beatPhase = (t % beatInterval) / beatInterval;
      const kickEnvelope = Math.pow(Math.max(0, 1 - beatPhase * 2.2), 3.2);

      const bass = clamp(Math.max(0.12, kickEnvelope), 0, 1) * volumeFactor;
      const midHigh = clamp(Math.sin(t * 8) * 0.25 + 0.35 + kickEnvelope * 0.25, 0, 1) * volumeFactor;

      return {
        bass,
        midHigh,
        left: midHigh * 0.85,
        right: midHigh * 0.9
      };
    }

    return { bass: 0, midHigh: 0, left: 0, right: 0 };
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
    const dur = this.getDuration();
    this.audio.currentTime = clamp(seconds, 0, dur || 0);
  }

  public setVolume(level: number): void {
    this.volumeLevel = clamp(level, 0, 1);
    this.audio.volume = this.volumeLevel;
    if (this.volumeLevel > 0) {
      this.audio.muted = false;
    }
  }

  public toggleMute(): boolean {
    if (this.isMuted()) {
      this.audio.muted = false;
      this.audio.volume = this.previousVolume || 0.8;
      this.volumeLevel = this.previousVolume || 0.8;
      return false;
    } else {
      this.previousVolume = this.volumeLevel;
      this.audio.muted = true;
      return true;
    }
  }

  public next(isFromEnded: boolean = false): void {
    if (this.playlist.length === 0) return;

    if (this.loopMode === 'one') {
      this.seek(0);
      this.play();
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

    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (this.loopMode === 'one') {
      this.seek(0);
      this.play();
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
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }
}
