export interface Track {
  id?: string | number;
  title: string;
  artist?: string;
  album?: string;
  src: string;
  coverArt?: string;
  duration?: number;
}

export type ThemeVariant = 'horeg-classic' | 'horeg-nightclub' | 'horeg-stealth';
export type LoopMode = 'none' | 'all' | 'one';

export interface HoregTheme {
  variant?: ThemeVariant;
  primaryGlowColor?: string;     // Default: #f59e0b (Amber Horeg)
  accentColor?: string;          // Default: #ef4444 (Red Alert)
  cardBackground?: string;       // Default: #121214 (Speaker Cabinet)
  textColor?: string;            // Default: #f4f4f5
  sliderProgressColor?: string;  // Default: #f59e0b
  enableEqAnimation?: boolean;   // Default: true
  borderRadius?: string;         // Default: 12px
}

export interface HoregPlayerOptions {
  container: string | HTMLElement;
  playlist: Track[];
  initialIndex?: number;
  autoplay?: boolean;
  loop?: LoopMode;
  shuffle?: boolean;
  volume?: number; // 0.0 to 1.0
  theme?: HoregTheme;
  onPlay?: (track: Track) => void;
  onPause?: () => void;
  onTrackChange?: (track: Track, index: number) => void;
  onPlaylistChange?: (playlist: Track[], currentIndex: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: (track: Track) => void;
  onError?: (error: MediaError | Error) => void;
}

export interface HoregPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  loop: LoopMode;
  shuffle: boolean;
}

