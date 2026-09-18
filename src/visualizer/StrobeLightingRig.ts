import { StrobeLightingState } from './types';

export class StrobeLightingRig {
  private strobeIntensity: number = 0;
  private blinderIntensity: number = 0;
  private underglowIntensity: number = 0;
  private sideFlashIntensity: number = 0;

  // Adaptive peak tracking
  private peakThreshold: number = 0.48;
  private lastFlashTime: number = 0;

  /**
   * Update carnival strobe lighting rig state based on real-time audio dynamics
   * @param dt Delta time in seconds
   * @param bass Current subwoofer excursion / sub-bass energy
   * @param bassPunch Transient kick punch onset
   * @param midHigh Mid and high frequency energy
   */
  public update(dt: number, bass: number, bassPunch: number = 0, midHigh: number = 0): void {
    const clampedDt = Math.min(0.04, Math.max(0.002, dt));
    const now = performance.now();

    // 1. Dynamic Peak Detection & Blinder Flash:
    // Heavy sub-bass impacts inject blinder burst
    if (bass > 0.62 || bassPunch > 0.35) {
      const blinderPower = Math.max((bass - 0.62) / 0.38, bassPunch);
      this.blinderIntensity = Math.min(1.0, this.blinderIntensity + blinderPower * 0.9);
    }

    // 2. High-speed Stroboscopic Truss Flash:
    // When kick transient strikes or bass hits peak threshold
    const isPeakHit = (bass > this.peakThreshold) || (bassPunch > 0.15);
    const minStrobeInterval = 65; // ms between consecutive strobe pulses (max ~15 Hz strobe rate)

    if (isPeakHit && now - this.lastFlashTime > minStrobeInterval) {
      this.lastFlashTime = now;
      const flashStrength = Math.min(1.0, 0.6 + bass * 0.4 + bassPunch * 0.4);
      this.strobeIntensity = Math.max(this.strobeIntensity, flashStrength);

      // Adaptive threshold tracking
      this.peakThreshold = Math.min(0.75, Math.max(0.42, bass * 0.92));
    } else {
      // Slowly relax threshold towards baseline
      this.peakThreshold = this.peakThreshold * (1 - clampedDt * 1.8) + 0.48 * (clampedDt * 1.8);
    }

    // 3. Side Satellite Flash:
    if (midHigh > 0.35) {
      const sidePower = (midHigh - 0.35) / 0.65;
      this.sideFlashIntensity = Math.max(this.sideFlashIntensity, sidePower * 0.85);
    }

    // 4. Subwoofer Port & Cabinet Underglow (directly tracks current bass presence):
    const targetUnderglow = Math.min(1.0, Math.max(0, (bass - 0.15) / 0.70));
    const underglowAlpha = 1 - Math.exp(-16 * clampedDt);
    this.underglowIntensity += (targetUnderglow - this.underglowIntensity) * underglowAlpha;

    // 5. Exponential decay for natural analog/LED phosphor strobe fades
    const strobeDecay = Math.exp(-22 * clampedDt);
    this.strobeIntensity *= strobeDecay;
    if (this.strobeIntensity < 0.01) this.strobeIntensity = 0;

    const blinderDecay = Math.exp(-12 * clampedDt);
    this.blinderIntensity *= blinderDecay;
    if (this.blinderIntensity < 0.01) this.blinderIntensity = 0;

    const sideDecay = Math.exp(-20 * clampedDt);
    this.sideFlashIntensity *= sideDecay;
    if (this.sideFlashIntensity < 0.01) this.sideFlashIntensity = 0;
  }

  public getState(): StrobeLightingState {
    return {
      strobeIntensity: this.strobeIntensity,
      blinderIntensity: this.blinderIntensity,
      underglowIntensity: this.underglowIntensity,
      sideFlashIntensity: this.sideFlashIntensity
    };
  }

  public reset(): void {
    this.strobeIntensity = 0;
    this.blinderIntensity = 0;
    this.underglowIntensity = 0;
    this.sideFlashIntensity = 0;
    this.peakThreshold = 0.48;
  }
}
