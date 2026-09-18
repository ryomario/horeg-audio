import { Track, LoopMode, HoregPlayerOptions, EqPreset, EqBand, EqPresetConfig, RecordingOptions, RecordingResult, RecordingFormat, StreamInfo } from './types';
import { clamp } from './utils/time';
import { StreamAdapter } from './stream/StreamAdapter';
import { encodePcmToWav } from './utils/wav';

export const EQ_PRESETS: Record<EqPreset, EqPresetConfig> = {
  flat: {
    name: 'Flat Monitor',
    sub: 0,
    low: 0,
    mid: 0,
    upperMid: 0,
    high: 0,
    bass: 0
  },
  'horeg-sub-punch': {
    name: 'Horeg Sub-Punch',
    sub: 8,
    low: 5,
    mid: -2,
    upperMid: 1,
    high: 3,
    bass: 7
  },
  'vocal-carnival': {
    name: 'Vocal Carnival',
    sub: -2,
    low: 0,
    mid: 4,
    upperMid: 6,
    high: 3,
    bass: -2
  },
  'bass-extreme': {
    name: 'Bass Extreme',
    sub: 12,
    low: 7,
    mid: -3,
    upperMid: 0,
    high: 2,
    bass: 11
  }
};

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
  onEqChange?: (preset: EqPreset) => void;
  onBandGainChange?: (band: EqBand, gainDb: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: (result: RecordingResult) => void;
  onRecordingData?: (chunk: Blob) => void;
  onStreamTypeDetected?: (info: StreamInfo) => void;
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
  private preloadAudio: HTMLAudioElement | null = null;
  private playlist: Track[] = [];
  private currentIndex: number = 0;
  private loopMode: LoopMode = 'all';
  private shuffleMode: boolean = false;
  private volumeLevel: number = 0.8;
  private previousVolume: number = 0.8;
  private callbacks: AudioEngineCallbacks = {};
  private preloadEnabled: boolean = true;
  private isCorsRetrying: boolean = false;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  // 5-Band Parametric Equalizer Filters
  private eqFilters: Record<EqBand, BiquadFilterNode | null> = {
    sub: null,
    low: null,
    mid: null,
    'upper-mid': null,
    high: null
  };
  private bandGains: Record<EqBand, number> = {
    sub: 0,
    low: 0,
    mid: 0,
    'upper-mid': 0,
    high: 0
  };
  private currentEqPreset: EqPreset = 'flat';
  private headroomGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private floatFreqData: Float32Array | null = null;
  private webAudioInitialized: boolean = false;
  private currentBassGain: number = 0;
  private bassPulseEnvelope: number = 0;
  private bassDbFloor: number = -60;

  // Modern Platform Integrations: Recording & Streaming Adapter
  private streamAdapter: StreamAdapter;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isCurrentlyRecording: boolean = false;
  private recordingStartTime: number = 0;
  private recordedChunks: Blob[] = [];
  private pcmNode: ScriptProcessorNode | null = null;
  private pcmLeftChunks: Float32Array[] = [];
  private pcmRightChunks: Float32Array[] = [];
  private currentStreamInfo: StreamInfo = { type: 'direct', isLive: false, url: '' };

  constructor(options: HoregPlayerOptions, callbacks: AudioEngineCallbacks = {}) {
    this.audio = new Audio();
    this.streamAdapter = new StreamAdapter(this.audio, {
      hlsConfig: options.hlsConfig,
      onStreamTypeDetected: (info) => {
        this.currentStreamInfo = info;
        if (this.callbacks.onStreamTypeDetected) {
          this.callbacks.onStreamTypeDetected(info);
        }
      },
      onError: (err) => {
        if (this.callbacks.onError) {
          this.callbacks.onError(err);
        }
      }
    });
    this.playlist = [...(options.playlist || [])];
    this.currentIndex = options.initialIndex !== undefined ? clamp(options.initialIndex, 0, Math.max(0, this.playlist.length - 1)) : 0;
    this.loopMode = options.loop || 'all';
    this.shuffleMode = !!options.shuffle;
    this.volumeLevel = options.volume !== undefined ? clamp(options.volume, 0, 1) : 0.8;
    this.currentBassGain = options.bassBoost !== undefined ? clamp(options.bassBoost, -10, 15) : 0;
    this.currentEqPreset = options.eqPreset || 'flat';
    this.preloadEnabled = options.preloadNext !== false;
    if (options.eqBandGains) {
      for (const b of ['sub', 'low', 'mid', 'upper-mid', 'high'] as EqBand[]) {
        if (typeof options.eqBandGains[b] === 'number') {
          this.bandGains[b] = clamp(options.eqBandGains[b]!, -15, 15);
        }
      }
    }
    this.callbacks = callbacks || {
      onPlay: options.onPlay,
      onPause: options.onPause,
      onTrackChange: options.onTrackChange,
      onPlaylistChange: options.onPlaylistChange,
      onTimeUpdate: options.onTimeUpdate,
      onEnded: options.onEnded,
      onError: options.onError,
      onEqChange: options.onEqChange,
      onBandGainChange: options.onBandGainChange,
      onRecordingStart: options.onRecordingStart,
      onRecordingStop: options.onRecordingStop,
      onRecordingData: options.onRecordingData,
      onStreamTypeDetected: options.onStreamTypeDetected
    };

    if (this.preloadEnabled && typeof Audio !== 'undefined') {
      try {
        this.preloadAudio = new Audio();
        this.preloadAudio.preload = 'auto';
      } catch (_) {}
    }

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
    // Graceful CORS Fallback:
    // If the browser encountered a media error when crossOrigin was set (e.g. remote CDN blocked CORS),
    // remove the crossOrigin attribute and reload the audio directly so native playback continues smoothly.
    if (this.audio.crossOrigin && !this.isCorsRetrying) {
      this.isCorsRetrying = true;
      console.warn('[HoregAudio] Remote audio source blocked CORS headers. Retrying in graceful fallback mode without crossOrigin.');
      this.audio.removeAttribute('crossorigin');
      const curTrack = this.getCurrentTrack();
      if (curTrack) {
        this.audio.src = curTrack.src;
        this.audio.load();
        this.play().catch(() => {});
      }
      return;
    }

    this.isCorsRetrying = false;
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
      this.preloadNextTrack();
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
    } else {
      this.preloadNextTrack();
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
    } else {
      this.preloadNextTrack();
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

    this.preloadNextTrack();
  }

  public getDuration(): number {
    if (this.isLiveStream()) {
      return Infinity;
    }
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
    return this.audio.muted || this.volumeLevel === 0;
  }

  public getVolume(): number {
    return this.volumeLevel;
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

    this.isCorsRetrying = false;
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

    this.currentStreamInfo = this.streamAdapter.load(track.src);

    if (this.callbacks.onTrackChange) {
      this.callbacks.onTrackChange(track, this.currentIndex);
    }

    this.preloadNextTrack();

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
      const AudioCtx = typeof window !== 'undefined'
        ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
        : (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();

      // Analyser with 512 FFT size (256 frequency bins, ~86 Hz per bin at 44.1kHz)
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.20;

      const initialPreset = EQ_PRESETS[this.currentEqPreset] || EQ_PRESETS.flat;

      // 5-Band Parametric Equalizer Filter Chain
      // 1. Sub (lowshelf, 60 Hz) - handles deep sub-rumble and bass boost
      const subFilter = this.audioContext.createBiquadFilter();
      subFilter.type = 'lowshelf';
      subFilter.frequency.value = 60;
      subFilter.gain.value = clamp(this.bandGains.sub + initialPreset.sub + this.currentBassGain, -15, 18);
      this.eqFilters.sub = subFilter;

      // 2. Low (peaking, 250 Hz, Q 1.0) - punch & lower harmonics
      const lowFilter = this.audioContext.createBiquadFilter();
      lowFilter.type = 'peaking';
      lowFilter.frequency.value = 250;
      lowFilter.Q.value = 1.0;
      lowFilter.gain.value = clamp(this.bandGains.low + initialPreset.low, -15, 15);
      this.eqFilters.low = lowFilter;

      // 3. Mid (peaking, 1000 Hz, Q 1.0) - vocal body & instrumentation
      const midFilter = this.audioContext.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1.0;
      midFilter.gain.value = clamp(this.bandGains.mid + initialPreset.mid, -15, 15);
      this.eqFilters.mid = midFilter;

      // 4. Upper-Mid (peaking, 3500 Hz, Q 1.0) - vocal clarity & presence
      const upperMidFilter = this.audioContext.createBiquadFilter();
      upperMidFilter.type = 'peaking';
      upperMidFilter.frequency.value = 3500;
      upperMidFilter.Q.value = 1.0;
      upperMidFilter.gain.value = clamp(this.bandGains['upper-mid'] + initialPreset.upperMid, -15, 15);
      this.eqFilters['upper-mid'] = upperMidFilter;

      // 5. High (highshelf, 10000 Hz) - treble shimmer & air
      const highFilter = this.audioContext.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = 10000;
      highFilter.gain.value = clamp(this.bandGains.high + initialPreset.high, -15, 15);
      this.eqFilters.high = highFilter;

      // Headroom gain staging node: protects against digital clipping during heavy bass boost
      this.headroomGain = this.audioContext.createGain();
      this.applyHeadroom(0);

      // Master gain staging node: provides smooth, click-free audio ramping for volume and mute
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(this.audio.muted ? 0 : this.volumeLevel, this.audioContext.currentTime);
      this.audio.volume = 1.0;

      // Studio Brickwall Limiter (DynamicsCompressorNode):
      // Provides an impenetrable ceiling right before output to guarantee 0% hard digital clipping/crackling
      this.limiterNode = this.audioContext.createDynamicsCompressor();
      this.limiterNode.threshold.value = -0.5; // catch peaks approaching 0 dBFS
      this.limiterNode.knee.value = 3.0;       // smooth analog-style transition
      this.limiterNode.ratio.value = 20.0;     // brickwall limiting
      this.limiterNode.attack.value = 0.002;   // 2 ms instant clamp
      this.limiterNode.release.value = 0.080;  // 80 ms fast transparent recovery

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      // Graph: sourceNode -> sub -> low -> mid -> upperMid -> high -> headroomGain -> masterGain -> analyser -> limiterNode -> destination
      this.sourceNode.connect(subFilter);
      subFilter.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(upperMidFilter);
      upperMidFilter.connect(highFilter);
      highFilter.connect(this.headroomGain);
      this.headroomGain.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.limiterNode);
      this.limiterNode.connect(this.audioContext.destination);

      if (typeof this.audioContext.createMediaStreamDestination === 'function') {
        this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
        this.limiterNode.connect(this.mediaStreamDestination);
      }

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

        // 1. Dynamic Peak & Sub-Bass Sensitivity (20 Hz - 150 Hz sub-band):
        // Bin 0 covers ~0 to 86 Hz (fundamental kick & 808 sub-rumble)
        // Bin 1 covers ~86 to 172 Hz (transient punch attack body)
        const b0 = Number.isFinite(this.floatFreqData[0]) ? this.floatFreqData[0] : -100;
        const b1 = Number.isFinite(this.floatFreqData[1]) ? this.floatFreqData[1] : -100;
        const currentBassDb = Math.max(b0, b1 - 1.8);

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

        // DYNAMIC PEAK & TRANSIENT ONSET DETECTION (20 Hz - 150 Hz):
        // Adaptive sliding noise floor tracking:
        if (currentBassDb < this.bassDbFloor) {
          this.bassDbFloor = currentBassDb;
        } else {
          this.bassDbFloor = this.bassDbFloor * 0.82 + currentBassDb * 0.18;
        }
        const dbOnset = Math.max(0, currentBassDb - this.bassDbFloor);
        const isKickHit = dbOnset > 2.0;

        // DECIBEL-BASED BASS DETECTION & EXCURSION:
        const BASS_CUTOFF_DB = -42;
        const BASS_MAX_DB = -10;
        const isBassActive = currentBassDb > BASS_CUTOFF_DB;
        let instantBass = 0;
        let bassPunch = 0;

        if (isBassActive) {
          // Linear capacity of emitted dB between -42 dBFS (inaudible) and -10 dBFS (max drop)
          const dbCapacity = clamp((currentBassDb - BASS_CUTOFF_DB) / (BASS_MAX_DB - BASS_CUTOFF_DB), 0, 1);
          const onsetRatio = clamp(dbOnset / 12, 0, 1);

          // Kinetic kick punch impulse: synchronized strictly with kick drum transients in 20-150 Hz
          bassPunch = isKickHit ? clamp((dbOnset - 2.0) / 9.0, 0, 1) * dbCapacity : 0;

          // Excursion radius strictly bounded by emitted dB capacity + dynamic transient surge
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

  public setVolume(level: number, transitionDuration: number = 0.025): void {
    this.volumeLevel = clamp(level, 0, 1);
    if (this.masterGain && this.audioContext && this.audioContext.state !== 'closed') {
      try {
        const currentTime = this.audioContext.currentTime;
        if (typeof this.masterGain.gain.setTargetAtTime === 'function') {
          this.masterGain.gain.setTargetAtTime(this.volumeLevel, currentTime, transitionDuration);
        } else {
          this.masterGain.gain.value = this.volumeLevel;
        }
      } catch {
        this.masterGain.gain.value = this.volumeLevel;
      }
      this.audio.volume = 1.0;
    } else {
      this.audio.volume = this.volumeLevel;
    }
    if (this.volumeLevel > 0) {
      this.audio.muted = false;
    }
  }

  public toggleMute(): boolean {
    if (this.isMuted()) {
      this.audio.muted = false;
      const restoreVol = this.previousVolume || 0.8;
      this.setVolume(restoreVol, 0.03);
      return false;
    } else {
      this.previousVolume = this.volumeLevel;
      if (this.masterGain && this.audioContext && this.audioContext.state !== 'closed') {
        try {
          const currentTime = this.audioContext.currentTime;
          this.masterGain.gain.setTargetAtTime(0, currentTime, 0.025);
        } catch {}
      }
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
    this.preloadNextTrack();
  }

  public setShuffle(shuffle: boolean): void {
    this.shuffleMode = shuffle;
    this.preloadNextTrack();
  }

  public getNextTrackIndex(): number | null {
    if (this.playlist.length <= 1) return null;
    if (this.loopMode === 'one') return this.currentIndex;
    if (this.shuffleMode) return null;
    const nextIdx = this.currentIndex + 1;
    if (nextIdx < this.playlist.length) return nextIdx;
    if (this.loopMode === 'all') return 0;
    return null;
  }

  public preloadNextTrack(): void {
    if (!this.preloadEnabled || !this.preloadAudio || this.playlist.length <= 1) return;
    const nextIdx = this.getNextTrackIndex();
    if (nextIdx === null) {
      return;
    }
    const nextTrack = this.playlist[nextIdx];
    if (nextTrack && nextTrack.src && !nextTrack.src.startsWith('blob:') && !nextTrack.src.startsWith('data:')) {
      if (this.preloadAudio.src !== nextTrack.src) {
        this.preloadAudio.src = nextTrack.src;
        this.preloadAudio.load();
      }
    }
  }

  public setCallbacks(callbacks: AudioEngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private rampAudioParam(param: AudioParam, targetValue: number, transitionDuration: number = 0.05): void {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      param.value = targetValue;
      return;
    }
    try {
      const currentTime = this.audioContext.currentTime;
      if (typeof param.setTargetAtTime === 'function') {
        param.setTargetAtTime(targetValue, currentTime, transitionDuration);
      } else if (typeof param.linearRampToValueAtTime === 'function') {
        param.linearRampToValueAtTime(targetValue, currentTime + transitionDuration);
      } else {
        param.value = targetValue;
      }
    } catch {
      param.value = targetValue;
    }
  }

  private applyHeadroom(transitionDuration: number = 0.05): void {
    if (!this.headroomGain || !this.audioContext || this.audioContext.state === 'closed') return;
    try {
      // Headroom attenuation: when bass or sub is boosted (> 0 dB), attenuate the master bus slightly
      // This maintains the boosted bass prominence while completely preventing DAC/OS digital clipping!
      const totalLowBoost = Math.max(0, this.currentBassGain) + Math.max(0, this.bandGains.sub) + Math.max(0, this.bandGains.low);
      const headroomDb = totalLowBoost > 0 ? -totalLowBoost * 0.25 : 0;
      const targetGain = Math.pow(10, headroomDb / 20);
      this.rampAudioParam(this.headroomGain.gain, targetGain, transitionDuration);
    } catch {}
  }

  public setBassGain(gainDb: number, transitionDuration: number = 0.05): void {
    this.currentBassGain = clamp(gainDb, -10, 15);
    if (this.eqFilters.sub && this.audioContext && this.audioContext.state !== 'closed') {
      const preset = EQ_PRESETS[this.currentEqPreset] || EQ_PRESETS.flat;
      const subTarget = clamp(this.bandGains.sub + preset.sub + this.currentBassGain, -15, 18);
      this.rampAudioParam(this.eqFilters.sub.gain, subTarget, transitionDuration);
    }
    this.applyHeadroom(transitionDuration);
  }

  public getBassGain(): number {
    return this.currentBassGain;
  }

  public setBandGain(band: EqBand, db: number, transitionDuration: number = 0.05): void {
    const validBands: EqBand[] = ['sub', 'low', 'mid', 'upper-mid', 'high'];
    if (!validBands.includes(band)) {
      console.warn(`[HoregAudio] Invalid EQ band: "${band}". Valid bands are: ${validBands.join(', ')}`);
      return;
    }
    const clampedGain = clamp(db, -15, 15);
    this.bandGains[band] = clampedGain;

    if (this.audioContext && this.audioContext.state !== 'closed') {
      const preset = EQ_PRESETS[this.currentEqPreset] || EQ_PRESETS.flat;
      const filter = this.eqFilters[band];
      if (filter) {
        let target = 0;
        if (band === 'sub') {
          target = clamp(clampedGain + preset.sub + this.currentBassGain, -15, 18);
        } else if (band === 'low') {
          target = clamp(clampedGain + preset.low, -15, 15);
        } else if (band === 'mid') {
          target = clamp(clampedGain + preset.mid, -15, 15);
        } else if (band === 'upper-mid') {
          target = clamp(clampedGain + preset.upperMid, -15, 15);
        } else if (band === 'high') {
          target = clamp(clampedGain + preset.high, -15, 15);
        }
        this.rampAudioParam(filter.gain, target, transitionDuration);
      }
    }

    this.applyHeadroom(transitionDuration);
    if (this.callbacks.onBandGainChange) {
      this.callbacks.onBandGainChange(band, clampedGain);
    }
  }

  public getBandGain(band: EqBand): number {
    return this.bandGains[band] ?? 0;
  }

  public getBandGains(): Record<EqBand, number> {
    return { ...this.bandGains };
  }

  public setEqualizerPreset(preset: EqPreset, transitionDuration: number = 0.05): void {
    this.currentEqPreset = preset;
    const cfg = EQ_PRESETS[preset] || EQ_PRESETS.flat;

    if (this.audioContext && this.audioContext.state !== 'closed') {
      if (this.eqFilters.sub) {
        const subTarget = clamp(this.bandGains.sub + cfg.sub + this.currentBassGain, -15, 18);
        this.rampAudioParam(this.eqFilters.sub.gain, subTarget, transitionDuration);
      }
      if (this.eqFilters.low) {
        const lowTarget = clamp(this.bandGains.low + cfg.low, -15, 15);
        this.rampAudioParam(this.eqFilters.low.gain, lowTarget, transitionDuration);
      }
      if (this.eqFilters.mid) {
        const midTarget = clamp(this.bandGains.mid + cfg.mid, -15, 15);
        this.rampAudioParam(this.eqFilters.mid.gain, midTarget, transitionDuration);
      }
      if (this.eqFilters['upper-mid']) {
        const upperMidTarget = clamp(this.bandGains['upper-mid'] + cfg.upperMid, -15, 15);
        this.rampAudioParam(this.eqFilters['upper-mid'].gain, upperMidTarget, transitionDuration);
      }
      if (this.eqFilters.high) {
        const highTarget = clamp(this.bandGains.high + cfg.high, -15, 15);
        this.rampAudioParam(this.eqFilters.high.gain, highTarget, transitionDuration);
      }
    }

    this.applyHeadroom(transitionDuration);
    if (this.callbacks.onEqChange) {
      this.callbacks.onEqChange(preset);
    }
  }

  public getEqualizerPreset(): EqPreset {
    return this.currentEqPreset;
  }

  public setEqPreset(preset: EqPreset, transitionDuration: number = 0.05): void {
    this.setEqualizerPreset(preset, transitionDuration);
  }

  public getEqPreset(): EqPreset {
    return this.getEqualizerPreset();
  }

  public getLimiter(): DynamicsCompressorNode | null {
    return this.limiterNode;
  }

  public getEqualizerFilters(): Record<EqBand, BiquadFilterNode | null> {
    return { ...this.eqFilters };
  }

  // Streaming Adapter Methods
  public isLiveStream(): boolean {
    return this.streamAdapter ? this.streamAdapter.isLive() : false;
  }

  public getStreamInfo(): StreamInfo {
    return this.streamAdapter ? this.streamAdapter.getStreamInfo() : this.currentStreamInfo;
  }

  // Modern Audio Stream Recording Methods
  public isRecording(): boolean {
    return this.isCurrentlyRecording;
  }

  public getRecordingDuration(): number {
    if (!this.isCurrentlyRecording || this.recordingStartTime === 0) return 0;
    return (Date.now() - this.recordingStartTime) / 1000;
  }

  public startRecording(options: RecordingOptions = {}): void {
    if (this.isCurrentlyRecording) {
      console.warn('[HoregAudio] Recording is already in progress.');
      return;
    }

    this.initWebAudio();

    this.isCurrentlyRecording = true;
    this.recordingStartTime = Date.now();
    this.recordedChunks = [];
    this.pcmLeftChunks = [];
    this.pcmRightChunks = [];

    // 1. Capture raw PCM samples from post-limiter node for lossless 16-bit WAV export
    if (this.audioContext && typeof this.audioContext.createScriptProcessor === 'function' && this.limiterNode) {
      try {
        this.pcmNode = this.audioContext.createScriptProcessor(4096, 2, 2);
        this.pcmNode.onaudioprocess = (e) => {
          if (!this.isCurrentlyRecording) return;
          const inBuf = e.inputBuffer;
          const left = inBuf.getChannelData(0);
          const right = inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : left;
          this.pcmLeftChunks.push(new Float32Array(left));
          this.pcmRightChunks.push(new Float32Array(right));
        };
        this.limiterNode.connect(this.pcmNode);
        const dummyGain = this.audioContext.createGain();
        dummyGain.gain.value = 0;
        this.pcmNode.connect(dummyGain);
        dummyGain.connect(this.audioContext.destination);
      } catch (_) {}
    }

    // 2. MediaRecorder API capture on post-limiter MediaStream
    const RecorderClass = typeof MediaRecorder !== 'undefined'
      ? MediaRecorder
      : (typeof window !== 'undefined' ? (window as any).MediaRecorder : null);

    if (RecorderClass && this.mediaStreamDestination && this.mediaStreamDestination.stream) {
      try {
        let mimeType = options.mimeType;
        if (!mimeType) {
          if (typeof RecorderClass.isTypeSupported === 'function' && RecorderClass.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (typeof RecorderClass.isTypeSupported === 'function' && RecorderClass.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else {
            mimeType = 'audio/webm';
          }
        }

        const recOptions: any = {
          audioBitsPerSecond: options.audioBitsPerSecond || 192000
        };
        if (typeof RecorderClass.isTypeSupported === 'function' && RecorderClass.isTypeSupported(mimeType)) {
          recOptions.mimeType = mimeType;
        }

        const recorder = new RecorderClass(this.mediaStreamDestination.stream, recOptions);
        recorder.ondataavailable = (event: any) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
            if (this.callbacks.onRecordingData) {
              this.callbacks.onRecordingData(event.data);
            }
          }
        };
        recorder.start(options.timeslice || 100);
        this.mediaRecorder = recorder;
      } catch (err) {
        console.warn('[HoregAudio] MediaRecorder initiation notice:', err);
      }
    }

    if (this.callbacks.onRecordingStart) {
      this.callbacks.onRecordingStart();
    }
  }

  public async stopRecording(format: RecordingFormat = 'webm'): Promise<Blob> {
    if (!this.isCurrentlyRecording) {
      return new Blob([], { type: format === 'wav' ? 'audio/wav' : 'audio/webm' });
    }

    this.isCurrentlyRecording = false;
    const duration = this.getRecordingDuration();

    // Clean up PCM processor node
    if (this.pcmNode) {
      try {
        this.pcmNode.disconnect();
      } catch (_) {}
      this.pcmNode.onaudioprocess = null;
      this.pcmNode = null;
    }

    let finalBlob: Blob;

    if (format === 'wav') {
      // Encode captured PCM channels to 16-bit PCM RIFF WAV
      const totalSamples = this.pcmLeftChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      if (totalSamples > 0) {
        const mergedLeft = new Float32Array(totalSamples);
        const mergedRight = new Float32Array(totalSamples);
        let offset = 0;
        for (let i = 0; i < this.pcmLeftChunks.length; i++) {
          mergedLeft.set(this.pcmLeftChunks[i], offset);
          mergedRight.set(this.pcmRightChunks[i], offset);
          offset += this.pcmLeftChunks[i].length;
        }
        const sampleRate = this.audioContext?.sampleRate || 44100;
        finalBlob = encodePcmToWav([mergedLeft, mergedRight], sampleRate);
      } else {
        finalBlob = new Blob([], { type: 'audio/wav' });
      }

      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        try {
          this.mediaRecorder.stop();
        } catch (_) {}
      }
    } else {
      // Default / WebM format
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        finalBlob = await new Promise<Blob>((resolve) => {
          this.mediaRecorder!.onstop = () => {
            const mime = (this.mediaRecorder && (this.mediaRecorder as any).mimeType) || 'audio/webm';
            resolve(new Blob(this.recordedChunks, { type: mime }));
          };
          try {
            this.mediaRecorder!.stop();
          } catch (_) {
            resolve(new Blob(this.recordedChunks, { type: 'audio/webm' }));
          }
        });
      } else if (this.recordedChunks.length > 0) {
        finalBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      } else {
        // Fallback to PCM wav if webm is empty
        const totalSamples = this.pcmLeftChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        if (totalSamples > 0) {
          const mergedLeft = new Float32Array(totalSamples);
          const mergedRight = new Float32Array(totalSamples);
          let offset = 0;
          for (let i = 0; i < this.pcmLeftChunks.length; i++) {
            mergedLeft.set(this.pcmLeftChunks[i], offset);
            mergedRight.set(this.pcmRightChunks[i], offset);
            offset += this.pcmLeftChunks[i].length;
          }
          finalBlob = encodePcmToWav([mergedLeft, mergedRight], this.audioContext?.sampleRate || 44100);
        } else {
          finalBlob = new Blob([], { type: 'audio/webm' });
        }
      }
    }

    const blobUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(finalBlob)
      : '';

    const result: RecordingResult = {
      blob: finalBlob,
      url: blobUrl,
      format,
      duration,
      download: (filename?: string) => {
        const name = filename || `horeg-recording-${Date.now()}.${format}`;
        if (typeof document !== 'undefined') {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    };

    if (this.callbacks.onRecordingStop) {
      this.callbacks.onRecordingStop(result);
    }

    return finalBlob;
  }

  public async exportRecording(format: RecordingFormat = 'webm', filename?: string): Promise<RecordingResult> {
    const blob = await this.stopRecording(format);
    const duration = this.getRecordingDuration();
    const blobUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(blob)
      : '';

    return {
      blob,
      url: blobUrl,
      format,
      duration,
      download: (customName?: string) => {
        const name = customName || filename || `horeg-recording-${Date.now()}.${format}`;
        if (typeof document !== 'undefined') {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    };
  }

  public destroy(): void {
    if (this.isCurrentlyRecording) {
      this.stopRecording().catch(() => {});
    }
    if (this.streamAdapter) {
      this.streamAdapter.destroy();
    }
    this.detachEvents();
    this.audio.pause();
    this.audio.src = '';
    this.audio.load();
    if (this.preloadAudio) {
      this.preloadAudio.src = '';
      this.preloadAudio.load();
      this.preloadAudio = null;
    }
    for (const b of ['sub', 'low', 'mid', 'upper-mid', 'high'] as EqBand[]) {
      if (this.eqFilters[b]) {
        try {
          this.eqFilters[b]!.disconnect();
        } catch {}
        this.eqFilters[b] = null;
      }
    }
    if (this.headroomGain) {
      try {
        this.headroomGain.disconnect();
      } catch {}
      this.headroomGain = null;
    }
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {}
      this.masterGain = null;
    }
    if (this.limiterNode) {
      try {
        this.limiterNode.disconnect();
      } catch {}
      this.limiterNode = null;
    }
    if (this.mediaStreamDestination) {
      try {
        this.mediaStreamDestination.disconnect();
      } catch {}
      this.mediaStreamDestination = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }
}
