import { ExcursionPhysicsConfig, ShockwaveRing } from './types';

export class SubwooferExcursionSimulator {
  private displacement: number = 0;
  private velocity: number = 0;
  private w0: number;
  private zeta: number;
  private shockwaves: ShockwaveRing[] = [];
  private lastShockwaveSpawnTime: number = 0;

  constructor(config: ExcursionPhysicsConfig = {}) {
    this.w0 = config.w0 ?? 42.0;
    this.zeta = config.zeta ?? 0.62;
  }

  /**
   * Update physical excursion simulation using sub-stepped damped harmonic oscillator
   * @param dt Delta time in seconds
   * @param targetBass Target excursion demand [0..1]
   * @param bassPunch Instantaneous kinetic kick impulse (20-100 Hz transient onset)
   */
  public update(dt: number, targetBass: number, bassPunch: number = 0): void {
    // Inject instantaneous kinetic impulse from sharp sub-bass kick transient
    if (bassPunch > 0.04) {
      this.velocity += bassPunch * 1.6;
    }

    const clampedDt = Math.min(0.04, Math.max(0.002, dt));
    const k = this.w0 * this.w0;
    const c = 2 * this.zeta * this.w0;

    // Numerical sub-stepping ensures display-rate invariance (60Hz, 120Hz, 144Hz+)
    const subSteps = clampedDt > 0.02 ? 2 : 1;
    const subDt = clampedDt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      const delta = this.displacement - targetBass;
      // Progressive spring hardening as cone approaches maximum excursion
      const progressive = this.displacement > 0.55 ? 1.0 + (this.displacement - 0.55) * 3.8 : 1.0;
      const springForce = -k * delta * progressive;
      const dampingForce = -c * this.velocity;
      const accel = springForce + dampingForce;

      this.velocity += accel * subDt;
      this.displacement += this.velocity * subDt;

      // Mechanical stroke boundaries (no inward inversion)
      if (this.displacement < 0) {
        this.displacement = 0;
        this.velocity = Math.max(0, -this.velocity * 0.25);
      } else if (this.displacement > 1.35) {
        this.displacement = 1.35;
        this.velocity = Math.min(0, -this.velocity * 0.25);
      }
    }

    // Settling threshold
    if (this.displacement < 0.001 && Math.abs(this.velocity) < 0.004) {
      this.displacement = 0;
      this.velocity = 0;
    }

    // Spawn kinetic shockwave rings on heavy sub hits (> 0.46)
    const now = performance.now();
    if (this.displacement > 0.46 && now - this.lastShockwaveSpawnTime > 140) {
      this.lastShockwaveSpawnTime = now;
      const power = (this.displacement - 0.46) / 0.54;
      this.shockwaves.push({
        radius: 1.0,
        maxRadius: 1.65 + power * 0.55,
        opacity: Math.min(0.9, 0.4 + power * 0.6),
        speed: 1.8 + power * 1.5,
        color: power > 0.5 ? 'rgba(239, 68, 68,' : 'rgba(245, 158, 11,'
      });
    }

    // Update active shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      wave.radius += wave.speed * clampedDt;
      const progress = (wave.radius - 1.0) / (wave.maxRadius - 1.0);
      wave.opacity = Math.max(0, wave.opacity * (1 - clampedDt * 3.5));

      if (progress >= 1.0 || wave.opacity <= 0.02) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  public getDisplacement(): number {
    return this.displacement;
  }

  public getVelocity(): number {
    return this.velocity;
  }

  public getConeScale(): number {
    return 1.0 + this.displacement * 0.25;
  }

  public getSurroundScale(): number {
    return 1.0 + this.displacement * 0.09;
  }

  public getShockwaves(): ShockwaveRing[] {
    return this.shockwaves;
  }

  public reset(): void {
    this.displacement = 0;
    this.velocity = 0;
    this.shockwaves = [];
  }
}
