export interface Track {
  id?: string | number;
  title: string;
  artist?: string;
  album?: string;
  src: string;
  coverArt?: string;
  duration?: number;
}

export type ThemeVariant =
  | 'horeg-classic'
  | 'horeg-nightclub'
  | 'horeg-stealth'
  | 'horeg-light'
  | 'horeg-light-clean'
  | 'horeg-light-minimal';
export type LoopMode = 'none' | 'all' | 'one';

export interface HoregTheme {
  variant?: ThemeVariant;
  primaryGlowColor?: string;     // Default: #f59e0b (Amber Horeg)
  accentColor?: string;          // Default: #ef4444 (Red Alert)
  cardBackground?: string;       // Default: #121214 (Speaker Cabinet)
  surfaceColor?: string;         // Drawer, forms, and container surfaces
  surfaceHoverColor?: string;    // Hover states for playlist items and buttons
  borderColor?: string;          // Outer borders and divider lines
  textColor?: string;            // Default: #f4f4f5 (Main typography)
  mutedTextColor?: string;       // Subtitles, metadata, and placeholder text
  sliderProgressColor?: string;  // Default: #f59e0b
  enableEqAnimation?: boolean;   // Default: true
  borderRadius?: string;         // Default: 12px
  isLight?: boolean;             // Explicitly declare light mode styling
}

export interface PersistenceOptions {
  key?: string;
  volume?: boolean;
  bass?: boolean;
  loop?: boolean;
  shuffle?: boolean;
  lastTrack?: boolean;
  eqPreset?: boolean;
  eqBandGains?: boolean;
  visualizerMode?: boolean;
  playlist?: boolean;
}

export type RecordingFormat = 'webm' | 'wav';

export interface RecordingOptions {
  format?: RecordingFormat;
  mimeType?: string;
  audioBitsPerSecond?: number;
  timeslice?: number;
}

export interface RecordingResult {
  blob: Blob;
  url: string;
  format: RecordingFormat;
  duration: number;
  download: (filename?: string) => void;
}

export type StreamType = 'direct' | 'hls' | 'radio' | 'live';

export interface StreamInfo {
  type: StreamType;
  isLive: boolean;
  url: string;
}

export type VisualizerMode = 'dom' | 'canvas';
export type EqPreset = 'flat' | 'horeg-sub-punch' | 'vocal-carnival' | 'bass-extreme';
export type EqBand = 'sub' | 'low' | 'mid' | 'upper-mid' | 'high';

export interface EqPresetConfig {
  name: string;
  sub: number;
  low: number;
  mid: number;
  upperMid: number;
  high: number;
  /** Backward compatibility alias for bass boost offset */
  bass?: number;
}

export interface HoregPlayerOptions {
  container: string | HTMLElement;
  playlist: Track[];
  initialIndex?: number;
  autoplay?: boolean;
  loop?: LoopMode;
  shuffle?: boolean;
  volume?: number; // 0.0 to 1.0
  bassBoost?: number; // Initial dB value (default: 0, range: -10 to 15)
  enableBassControl?: boolean; // Show/hide UI bass control (default: true)
  maxWidth?: number | string; // Optional container max-width (number in px or CSS string). If not set, container is fluid.
  theme?: HoregTheme;
  visualizerMode?: VisualizerMode; // 'dom' (default) or 'canvas'
  eqPreset?: EqPreset; // Equalizer sound preset (default: 'flat')
  eqBandGains?: Partial<Record<EqBand, number>>; // Initial manual band gains
  preloadNext?: boolean; // Preload next track in playlist for gapless playback (default: true)
  mediaSession?: boolean; // Integrate with OS Media Session API (default: true)
  persistState?: boolean | PersistenceOptions; // Persist user settings to localStorage (default: false)
  enableRecordingControl?: boolean; // Show record button in UI (default: false)
  hlsConfig?: any; // Custom options passed to Hls.js instance if used
  onPlay?: (track: Track) => void;
  onPause?: () => void;
  onTrackChange?: (track: Track, index: number) => void;
  onPlaylistChange?: (playlist: Track[], currentIndex: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onBassChange?: (bassLevel: number) => void;
  onEqChange?: (preset: EqPreset) => void;
  onBandGainChange?: (band: EqBand, gainDb: number) => void;
  onEnded?: (track: Track) => void;
  onError?: (error: MediaError | Error) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: (result: RecordingResult) => void;
  onRecordingData?: (chunk: Blob) => void;
  onStreamTypeDetected?: (info: StreamInfo) => void;
}

export interface HoregPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  bassBoost: number;
  isMuted: boolean;
  loop: LoopMode;
  shuffle: boolean;
}


