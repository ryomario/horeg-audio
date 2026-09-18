import { VisualizerMode } from '../types';
import { AudioEnergy } from '../AudioEngine';

export interface VisualizerEngineOptions {
  stageContainer: HTMLElement;
  coverContainer?: HTMLElement;
  enableAnimation?: boolean;
  mode?: VisualizerMode;
  getAudioEnergy?: () => AudioEnergy;
}

export interface ExcursionPhysicsConfig {
  /** Natural resonance angular frequency (rad/s), default: 42.0 (~6.7 Hz) */
  w0?: number;
  /** Damping ratio zeta (underdamped: 0.62 for realistic bouncy recoil) */
  zeta?: number;
  /** Progressive non-linear spring factor at high excursion */
  progressiveK?: number;
}

export interface StrobeLightingState {
  /** Overhead truss strobe intensity [0..1] */
  strobeIntensity: number;
  /** Heavy kick blinder flash intensity [0..1] */
  blinderIntensity: number;
  /** Subwoofer port & underglow intensity [0..1] */
  underglowIntensity: number;
  /** Side satellite flash intensity [0..1] */
  sideFlashIntensity: number;
}

export interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
  color: string;
}
