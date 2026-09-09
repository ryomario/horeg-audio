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
  bassDb?: number;
  bassPunch?: number;
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
  private bassFilter: BiquadFilterNode | null = null;
  private headroomGain: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private floatFreqData: Float32Array | null = null;
  private webAudioInitialized: boolean = false;
  private currentBassGain: number = 0;
  private bassPulseEnvelope: number = 0;
  private bassDbFloor: number = -60;

  constructor(options: HoregPlayerOptions, callbacks: AudioEngineCallbacks = {}) {
    this.audio = new Audio();
    this.playlist = [...(options.playlist || [])];
    this.currentIndex = options.initialIndex !== undefined ? clamp(options.initialIndex, 0, Math.max(0, this.playlist.length - 1)) : 0;
    this.loopMode = options.loop || 'all';
    this.shuffleMode = !!options.shuffle;
    this.volumeLevel = options.volume !== undefined ? clamp(options.volume, 0, 1) : 0.8;
    this.currentBassGain = options.bassBoost !== undefined ? clamp(options.bassBoost, -10, 15) : 0;
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

    // Set crossOrigin appropriately:
    // blob: and data: URLs should NOT have crossOrigin attribute set, as doing so can trigger
    // CORS errors and cause Web Audio createMediaElementSource to produce 0s (silenced).
    const isBlobOrData = track.src.startsWith('blob:') || track.src.startsWith('data:');
    let isCrossDomain = false;
    try {
      if (typeof window !== 'undefined' && window.location && !isBlobOrData) {
        const url = new URL(track.src, window.location.href);
        isCrossDomain = url.origin !== window.location.origin;
      }
    } catch (_) {}

    if (isCrossDomain) {
      this.audio.crossOrigin = 'anonymous';
    } else {
      this.audio.removeAttribute('crossorigin');
    }

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
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (_) {}
    }
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

      // Analyser with 512 FFT size (256 frequency bins, ~86 Hz per bin at 44.1kHz)
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.20;

      // Lowshelf filter at 110 Hz for authentic horeg sub-bass punch
      this.bassFilter = this.audioContext.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 110;
      this.bassFilter.gain.value = this.currentBassGain;

      // Headroom gain staging node: protects against digital clipping during heavy bass boost
      this.headroomGain = this.audioContext.createGain();
      this.applyHeadroom(0);

      // Studio Brickwall Limiter (DynamicsCompressorNode):
      // Provides an impenetrable ceiling right before output to guarantee 0% hard digital clipping/crackling
      this.limiterNode = this.audioContext.createDynamicsCompressor();
      this.limiterNode.threshold.value = -0.5; // catch peaks approaching 0 dBFS
      this.limiterNode.knee.value = 3.0;       // smooth analog-style transition
      this.limiterNode.ratio.value = 20.0;     // brickwall limiting
      this.limiterNode.attack.value = 0.002;   // 2 ms instant clamp
      this.limiterNode.release.value = 0.080;  // 80 ms fast transparent recovery

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      // Graph: sourceNode -> bassFilter -> headroomGain -> analyser -> limiterNode -> destination
      this.sourceNode.connect(this.bassFilter);
      this.bassFilter.connect(this.headroomGain);
      this.headroomGain.connect(this.analyser);
      this.analyser.connect(this.limiterNode);
      this.limiterNode.connect(this.audioContext.destination);

      this.floatFreqData = new Float32Array(this.analyser.frequencyBinCount);
      this.webAudioInitialized = true;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('[HoregAudio] Web Audio initialization notice:', e);
      this.webAudioInitialized = true;
    }
  }

  public getAudioEnergy(): AudioEnergy {
    if (!this.isPlaying()) {
      return { bass: 0, midHigh: 0, left: 0, right: 0, bassDb: -100, bassPunch: 0 };
    }

    const volumeFactor = this.isMuted() ? 0 : Math.max(0.35, Math.sqrt(this.volumeLevel));

    // 1. Try reading from AnalyserNode
    if (this.analyser && this.floatFreqData && this.audioContext && this.audioContext.state === 'running') {
      try {
        // Read uncompressed, real-time decibel (dBFS) levels for each frequency bin
        this.analyser.getFloatFrequencyData(this.floatFreqData as any);

        // 1. Sub-Bass & Kick Drum Decibels:
        // Bin 0 covers ~0 to 86 Hz (deep sub-bass, 808s, and kick fundamental)
        // Bin 1 covers ~86 to 172 Hz (punch & attack body)
        const b0 = Number.isFinite(this.floatFreqData[0]) ? this.floatFreqData[0] : -100;
        const b1 = Number.isFinite(this.floatFreqData[1]) ? this.floatFreqData[1] : -100;
        const currentBassDb = Math.max(b0, b1 - 2.5);

        // 2. Mid and vocal frequencies in dBFS: bins 4 to 45 (~350 to 3870 Hz)
        let maxMidDb = -100;
        for (let i = 4; i < 45 && i < this.floatFreqData.length; i++) {
          const val = this.floatFreqData[i];
          if (Number.isFinite(val) && val > maxMidDb) {
            maxMidDb = val;
          }
        }

        // Complete silence or below noise floor (< -75 dBFS)
        if (currentBassDb < -75 && maxMidDb < -75) {
          this.bassPulseEnvelope *= 0.5;
          if (this.bassPulseEnvelope < 0.005) this.bassPulseEnvelope = 0;
          return {
            bass: 0,
            midHigh: 0,
            left: 0,
            right: 0,
            bassDb: -100,
            bassPunch: 0
          };
        }

        // TRANSIENT ONSET DETECTION (BEAT ONSET SPIKES):
        if (currentBassDb < this.bassDbFloor) {
          this.bassDbFloor = currentBassDb;
        } else {
          this.bassDbFloor = this.bassDbFloor * 0.82 + currentBassDb * 0.18;
        }
        const dbOnset = Math.max(0, currentBassDb - this.bassDbFloor);

        // DECIBEL-BASED BASS DETECTION & EXCURSION:
        const BASS_CUTOFF_DB = -42;
        const BASS_MAX_DB = -10;
        const isBassActive = currentBassDb > BASS_CUTOFF_DB;
        let instantBass = 0;
        let bassPunch = 0;

        if (isBassActive) {
          // Linear capacity of emitted dB between -42 dBFS (inaudible) and -10 dBFS (max drop)
          const dbCapacity = clamp((currentBassDb - BASS_CUTOFF_DB) / (BASS_MAX_DB - BASS_CUTOFF_DB), 0, 1);
          const onsetRatio = clamp(dbOnset / 14, 0, 1);

          // Kinetic kick punch impulse: only non-zero on sharp transient kicks (dbOnset > 2.0 dB)
          bassPunch = dbOnset > 2.0 ? clamp((dbOnset - 2.0) / 10, 0, 1) * dbCapacity : 0;

          // Excursion radius strictly bounded by emitted dB capacity
          instantBass = dbCapacity * (0.60 + 0.40 * onsetRatio);
        } else {
          // Subtle rhythmic breathing during non-bass playback
          const t = this.audio.currentTime > 0 ? this.audio.currentTime : Date.now() / 1000;
          const cadence = Math.sin(t * 9) * 0.5 + 0.5;
          const musicPresence = clamp((maxMidDb - (-60)) / ((-18) - (-60)), 0, 1);
          instantBass = (0.012 + cadence * 0.028) * musicPresence;
        }

        // Fast attack, snappy release
        if (instantBass > this.bassPulseEnvelope) {
          this.bassPulseEnvelope = instantBass;
        } else {
          this.bassPulseEnvelope = Math.max(instantBass, this.bassPulseEnvelope * 0.76);
        }

        const bassVal = Math.min(1, this.bassPulseEnvelope) * volumeFactor;
        const midRatio = clamp((maxMidDb - (-55)) / ((-18) - (-55)), 0, 1);
        const midVal = midRatio * volumeFactor;
        return {
          bass: bassVal,
          midHigh: midVal,
          left: midVal * 0.85,
          right: midVal * 0.90,
          bassDb: Math.round(currentBassDb * 10) / 10,
          bassPunch: bassPunch * volumeFactor
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
      const kickEnvelope = Math.pow(Math.max(0, 1 - beatPhase * 2.4), 3.2);
      const bassGainMultiplier = Math.pow(10, this.currentBassGain / 20);
      const scaledEnvelope = kickEnvelope * Math.min(2.5, Math.max(0.4, bassGainMultiplier));
      const minBassFloor = 0.03;
      const bass = clamp(Math.max(minBassFloor, scaledEnvelope), 0, 1) * volumeFactor;
      const midHigh = clamp(Math.sin(t * 8) * 0.25 + 0.35 + kickEnvelope * 0.25, 0, 1) * volumeFactor;

      return {
        bass,
        midHigh,
        left: midHigh * 0.85,
        right: midHigh * 0.9,
        bassDb: -20,
        bassPunch: kickEnvelope > 0.4 ? (kickEnvelope - 0.4) / 0.6 * volumeFactor : 0
      };
    }

    return { bass: 0, midHigh: 0, left: 0, right: 0, bassDb: -100, bassPunch: 0 };
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

  private applyHeadroom(transitionDuration: number = 0.05): void {
    if (!this.headroomGain || !this.audioContext || this.audioContext.state === 'closed') return;
    try {
      const currentTime = this.audioContext.currentTime;
      // Headroom attenuation: when bass is boosted (> 0 dB), attenuate the master bus slightly (-0.28 dB per dB boost)
      // This maintains the boosted bass prominence while completely preventing DAC/OS digital clipping!
      const headroomDb = this.currentBassGain > 0 ? -this.currentBassGain * 0.28 : 0;
      const targetGain = Math.pow(10, headroomDb / 20);
      if (typeof this.headroomGain.gain.setTargetAtTime === 'function') {
        this.headroomGain.gain.setTargetAtTime(targetGain, currentTime, transitionDuration);
      } else {
        this.headroomGain.gain.value = targetGain;
      }
    } catch {}
  }

  public setBassGain(gainDb: number, transitionDuration: number = 0.05): void {
    this.currentBassGain = clamp(gainDb, -10, 15);
    if (this.bassFilter && this.audioContext && this.audioContext.state !== 'closed') {
      try {
        const currentTime = this.audioContext.currentTime;
        if (typeof this.bassFilter.gain.setTargetAtTime === 'function') {
          this.bassFilter.gain.setTargetAtTime(this.currentBassGain, currentTime, transitionDuration);
        } else {
          this.bassFilter.gain.value = this.currentBassGain;
        }
      } catch {
        this.bassFilter.gain.value = this.currentBassGain;
      }
    }
    this.applyHeadroom(transitionDuration);
  }

  public getBassGain(): number {
    return this.currentBassGain;
  }

  public destroy(): void {
    this.detachEvents();
    this.audio.pause();
    this.audio.src = '';
    this.audio.load();
    if (this.bassFilter) {
      try {
        this.bassFilter.disconnect();
      } catch {}
      this.bassFilter = null;
    }
    if (this.headroomGain) {
      try {
        this.headroomGain.disconnect();
      } catch {}
      this.headroomGain = null;
    }
    if (this.limiterNode) {
      try {
        this.limiterNode.disconnect();
      } catch {}
      this.limiterNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }
}
