import { AudioEnergy } from './AudioEngine';

export interface VisualizerOptions {
  stageContainer: HTMLElement;
  coverContainer?: HTMLElement;
  enableAnimation?: boolean;
  getAudioEnergy?: () => AudioEnergy;
}

export class Visualizer {
  private stageContainer: HTMLElement;
  private coverContainer: HTMLElement | null = null;
  private isEnabled: boolean = true;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private getAudioEnergy?: () => AudioEnergy;

  // DOM Elements
  private leftBoxEl!: HTMLElement;
  private leftTopDriverEl!: HTMLElement;
  private leftBottomDriverEl!: HTMLElement;
  private leftRipples: HTMLElement[] = [];

  private subBoxEl!: HTMLElement;
  private subSurroundEl!: HTMLElement;
  private subConeEl!: HTMLElement;
  private shockwave1El!: HTMLElement;
  private shockwave2El!: HTMLElement;

  private rightBoxEl!: HTMLElement;
  private rightTopDriverEl!: HTMLElement;
  private rightBottomDriverEl!: HTMLElement;
  private rightRipples: HTMLElement[] = [];

  // Physics values for delta-time invariant bouncy excursion and decay
  private smoothBass: number = 0;
  private bassVelocity: number = 0;
  private smoothLeft: number = 0;
  private smoothRight: number = 0;
  private lastTimestamp: number = 0;

  constructor(options: VisualizerOptions) {
    this.stageContainer = options.stageContainer;
    this.coverContainer = options.coverContainer || null;
    this.isEnabled = options.enableAnimation !== false;
    this.getAudioEnergy = options.getAudioEnergy;

    this.buildStage();
  }

  public setAudioEnergyGetter(fn: () => AudioEnergy): void {
    this.getAudioEnergy = fn;
  }

  private buildStage(): void {
    this.stageContainer.innerHTML = '';

    // 1. Left Soundbox (Satellite with 2 circular drivers & water ripples)
    this.leftBoxEl = document.createElement('div');
    this.leftBoxEl.className = 'horeg-soundbox is-satellite is-left';
    this.leftBoxEl.innerHTML = `
      <div class="horeg-box-header">
        <span class="horeg-box-bolt top-left"></span>
        <span class="horeg-tweeter-slot"></span>
        <span class="horeg-box-bolt top-right"></span>
      </div>
      <div class="horeg-satellite-baffle">
        <!-- Lingkaran 1 Kiri: Top Driver -->
        <div class="horeg-satellite-driver top">
          <span class="horeg-driver-ripple ripple-1"></span>
          <span class="horeg-driver-ripple ripple-2"></span>
          <div class="horeg-driver-surround">
            <div class="horeg-driver-cone">
              <div class="horeg-driver-cap"></div>
            </div>
          </div>
        </div>
        <!-- Lingkaran 2 Kiri: Bottom Driver -->
        <div class="horeg-satellite-driver bottom">
          <span class="horeg-driver-ripple ripple-1"></span>
          <span class="horeg-driver-ripple ripple-2"></span>
          <div class="horeg-driver-surround">
            <div class="horeg-driver-cone">
              <div class="horeg-driver-cap"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="horeg-box-footer">
        <span class="horeg-box-bolt bottom-left"></span>
        <span class="horeg-port-slot"></span>
        <span class="horeg-box-bolt bottom-right"></span>
      </div>
    `;
    this.leftTopDriverEl = this.leftBoxEl.querySelector('.top .horeg-driver-cone') as HTMLElement;
    this.leftBottomDriverEl = this.leftBoxEl.querySelector('.bottom .horeg-driver-cone') as HTMLElement;
    this.leftRipples = Array.from(this.leftBoxEl.querySelectorAll('.horeg-driver-ripple'));
    this.stageContainer.appendChild(this.leftBoxEl);

    // 2. Center Soundbox (Monster Horeg Subwoofer in front)
    this.subBoxEl = document.createElement('div');
    this.subBoxEl.className = 'horeg-soundbox is-subwoofer';

    // Shockwave ripple rings
    const shockwavesWrap = document.createElement('div');
    shockwavesWrap.className = 'horeg-shockwaves-wrap';
    this.shockwave1El = document.createElement('div');
    this.shockwave1El.className = 'horeg-shockwave wave-1';
    this.shockwave2El = document.createElement('div');
    this.shockwave2El.className = 'horeg-shockwave wave-2';
    shockwavesWrap.appendChild(this.shockwave1El);
    shockwavesWrap.appendChild(this.shockwave2El);
    this.subBoxEl.appendChild(shockwavesWrap);

    // Subwoofer frame and bolts
    const subFrame = document.createElement('div');
    subFrame.className = 'horeg-sub-frame';
    subFrame.innerHTML = `
      <span class="horeg-box-bolt top-left"></span>
      <span class="horeg-box-bolt top-right"></span>
      <span class="horeg-sub-badge">SUB 18\"</span>
      <span class="horeg-box-bolt bottom-left"></span>
      <span class="horeg-box-bolt bottom-right"></span>
      <div class="horeg-sub-ports">
        <span class="horeg-sub-port left"></span>
        <span class="horeg-sub-port right"></span>
      </div>
    `;

    // Subwoofer baffle & vibrating cone
    const subBaffle = document.createElement('div');
    subBaffle.className = 'horeg-sub-baffle';

    this.subSurroundEl = document.createElement('div');
    this.subSurroundEl.className = 'horeg-sub-surround';

    this.subConeEl = document.createElement('div');
    this.subConeEl.className = 'horeg-sub-cone';

    // Circular cover art mounted in center of the subwoofer cone
    if (this.coverContainer) {
      this.subConeEl.appendChild(this.coverContainer);
    }

    this.subSurroundEl.appendChild(this.subConeEl);
    subBaffle.appendChild(this.subSurroundEl);
    this.subBoxEl.appendChild(subFrame);
    this.subBoxEl.appendChild(subBaffle);
    this.stageContainer.appendChild(this.subBoxEl);

    // 3. Right Soundbox (Satellite with 2 circular drivers & water ripples)
    this.rightBoxEl = document.createElement('div');
    this.rightBoxEl.className = 'horeg-soundbox is-satellite is-right';
    this.rightBoxEl.innerHTML = `
      <div class="horeg-box-header">
        <span class="horeg-box-bolt top-left"></span>
        <span class="horeg-tweeter-slot"></span>
        <span class="horeg-box-bolt top-right"></span>
      </div>
      <div class="horeg-satellite-baffle">
        <!-- Lingkaran 1 Kanan: Top Driver -->
        <div class="horeg-satellite-driver top">
          <span class="horeg-driver-ripple ripple-1"></span>
          <span class="horeg-driver-ripple ripple-2"></span>
          <div class="horeg-driver-surround">
            <div class="horeg-driver-cone">
              <div class="horeg-driver-cap"></div>
            </div>
          </div>
        </div>
        <!-- Lingkaran 2 Kanan: Bottom Driver -->
        <div class="horeg-satellite-driver bottom">
          <span class="horeg-driver-ripple ripple-1"></span>
          <span class="horeg-driver-ripple ripple-2"></span>
          <div class="horeg-driver-surround">
            <div class="horeg-driver-cone">
              <div class="horeg-driver-cap"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="horeg-box-footer">
        <span class="horeg-box-bolt bottom-left"></span>
        <span class="horeg-port-slot"></span>
        <span class="horeg-box-bolt bottom-right"></span>
      </div>
    `;
    this.rightTopDriverEl = this.rightBoxEl.querySelector('.top .horeg-driver-cone') as HTMLElement;
    this.rightBottomDriverEl = this.rightBoxEl.querySelector('.bottom .horeg-driver-cone') as HTMLElement;
    this.rightRipples = Array.from(this.rightBoxEl.querySelectorAll('.horeg-driver-ripple'));
    this.stageContainer.appendChild(this.rightBoxEl);
  }

  public setCoverContainer(container: HTMLElement): void {
    this.coverContainer = container;
    if (this.subConeEl && !this.subConeEl.contains(container)) {
      this.subConeEl.innerHTML = '';
      this.subConeEl.appendChild(container);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  public start(): void {
    if (this.isRunning || !this.isEnabled) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    this.decayToIdle();
  }

  private decayToIdle(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    let lastDecayTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.004, (now - lastDecayTime) / 1000));
      lastDecayTime = now;

      const decayFactor = Math.exp(-18 * dt);
      this.smoothBass *= decayFactor;
      this.bassVelocity = 0;
      this.smoothLeft *= decayFactor;
      this.smoothRight *= decayFactor;

      this.applyExcursion(this.smoothBass, this.smoothLeft, this.smoothRight);

      if (this.smoothBass > 0.003 || this.smoothLeft > 0.003 || this.smoothRight > 0.003) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.smoothBass = 0;
        this.bassVelocity = 0;
        this.smoothLeft = 0;
        this.smoothRight = 0;
        this.applyExcursion(0, 0, 0);
        this.animFrameId = null;
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  private loop = (timestamp: number = performance.now()): void => {
    if (!this.isRunning) return;

    // Delta-time calculation for display-rate invariance (60Hz, 120Hz, 144Hz, 240Hz)
    const dt = this.lastTimestamp ? Math.min(0.04, Math.max(0.004, (timestamp - this.lastTimestamp) / 1000)) : 0.016;
    this.lastTimestamp = timestamp;

    const energy = this.getAudioEnergy ? this.getAudioEnergy() : { bass: 0, midHigh: 0, left: 0, right: 0, bassPunch: 0 };

    const targetBass = energy.bass < 0.01 ? 0 : energy.bass;
    const targetLeft = energy.left < 0.01 ? 0 : energy.left;
    const targetRight = energy.right < 0.01 ? 0 : energy.right;
    const bassPunch = energy.bassPunch || 0;

    // Direct Transient Kinetic Impulse: sharp kick onsets inject instantaneous Lorentz force
    if (bassPunch > 0.04) {
      this.bassVelocity += bassPunch * 1.5;
    }

    // Physical Damped Harmonic Oscillator (Subwoofer spider & rubber surround simulation)
    // Resonance angular frequency w0 = 42 rad/s (~6.7 Hz physical oscillation)
    // Damping ratio zeta = 0.62 (underdamped: permits realistic elastic overshoot & bouncy recoil)
    const w0 = 42.0;
    const zeta = 0.62;
    const k = w0 * w0;      // spring constant (~1764)
    const c = 2 * zeta * w0; // damping coefficient (~52.1)

    // Sub-stepping for unconditional numerical stability on any framerate
    const subSteps = dt > 0.022 ? 2 : 1;
    const subDt = dt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      const displacement = this.smoothBass - targetBass;
      // Progressive spring resistance as cone reaches extreme stroke
      const progressiveFactor = this.smoothBass > 0.60 ? 1.0 + (this.smoothBass - 0.60) * 3.5 : 1.0;
      const springForce = -k * displacement * progressiveFactor;
      const dampingForce = -c * this.bassVelocity;
      const acceleration = springForce + dampingForce;

      this.bassVelocity += acceleration * subDt;
      this.smoothBass += this.bassVelocity * subDt;

      // Mechanical stroke boundaries (no inward inversion)
      if (this.smoothBass < 0) {
        this.smoothBass = 0;
        this.bassVelocity = Math.max(0, -this.bassVelocity * 0.25);
      } else if (this.smoothBass > 1.25) {
        this.smoothBass = 1.25;
        this.bassVelocity = Math.min(0, -this.bassVelocity * 0.25);
      }
    }

    if (this.smoothBass < 0.001 && Math.abs(this.bassVelocity) < 0.005) {
      this.smoothBass = 0;
      this.bassVelocity = 0;
    }

    // Satellites frame-rate invariant exponential smoothing:
    const satAlpha = 1 - Math.exp(-24 * dt);
    this.smoothLeft += (targetLeft - this.smoothLeft) * satAlpha;
    if (this.smoothLeft < 0.005) this.smoothLeft = 0;

    this.smoothRight += (targetRight - this.smoothRight) * satAlpha;
    if (this.smoothRight < 0.005) this.smoothRight = 0;

    this.applyExcursion(this.smoothBass, this.smoothLeft, this.smoothRight);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private applyExcursion(bass: number, left: number, right: number): void {
    // 1. Center Monster Subwoofer: Proportional excursion scaled according to dB capacity
    const subScale = 1.0 + bass * 0.24;
    this.subConeEl.style.transform = `scale(${subScale.toFixed(3)})`;

    // 3D Rubber Surround Stretch
    if (this.subSurroundEl) {
      const surroundScale = 1.0 + bass * 0.08;
      this.subSurroundEl.style.transform = `scale(${surroundScale.toFixed(3)})`;
    }

    // Dynamic 3D Inset Shadow (Depth Illusion: softens when cone extends outward)
    const shadowBlur = Math.round(10 + bass * 10);
    const shadowSpread = Math.round(bass * 3);
    this.subConeEl.style.boxShadow = `0 0 ${shadowBlur}px ${shadowSpread}px rgba(0, 0, 0, 0.7)`;

    // Subwoofer Cabinet Micro-Rumble (Sound Horeg Power Vibration on heavy bass hits)
    if (bass > 0.45) {
      const rumbleIntensity = (bass - 0.45) / 0.55;
      const rx = ((Math.random() - 0.5) * 1.5 * rumbleIntensity).toFixed(2);
      const ry = ((Math.random() - 0.5) * 1.5 * rumbleIntensity).toFixed(2);
      const boxScale = (1.0 + rumbleIntensity * 0.03).toFixed(3);
      this.subBoxEl.style.transform = `translate(${rx}px, ${ry}px) scale(${boxScale})`;
    } else {
      this.subBoxEl.style.transform = 'translate(0px, 0px) scale(1)';
    }

    // Subwoofer Shockwaves: Trigger strictly on heavy bass hits (> 0.48), scaled to capacity
    if (bass > 0.48) {
      const shockPower = (bass - 0.48) / 0.52;
      const waveScale1 = 1.0 + shockPower * 0.45;
      const waveOpacity1 = Math.min(0.85, shockPower * 1.25);
      this.shockwave1El.style.transform = `scale(${waveScale1.toFixed(3)})`;
      this.shockwave1El.style.opacity = waveOpacity1.toFixed(2);

      const waveScale2 = 1.0 + shockPower * 0.72;
      const waveOpacity2 = Math.max(0, (shockPower - 0.18) * 1.1);
      this.shockwave2El.style.transform = `scale(${waveScale2.toFixed(3)})`;
      this.shockwave2El.style.opacity = waveOpacity2.toFixed(2);
    } else {
      this.shockwave1El.style.transform = 'scale(1)';
      this.shockwave1El.style.opacity = '0';
      this.shockwave2El.style.transform = 'scale(1)';
      this.shockwave2El.style.opacity = '0';
    }

    // 2. Left & Right Satellites (Cones excursion)
    const leftScale = 1.0 + left * 0.12;
    if (this.leftTopDriverEl) this.leftTopDriverEl.style.transform = `scale(${leftScale.toFixed(3)})`;
    if (this.leftBottomDriverEl) this.leftBottomDriverEl.style.transform = `scale(${leftScale.toFixed(3)})`;

    const rightScale = 1.0 + right * 0.12;
    if (this.rightTopDriverEl) this.rightTopDriverEl.style.transform = `scale(${rightScale.toFixed(3)})`;
    if (this.rightBottomDriverEl) this.rightBottomDriverEl.style.transform = `scale(${rightScale.toFixed(3)})`;

    // 3. Compact Water-like Ripples on the 4 Satellite Circles (2 Left, 2 Right)
    const applyRipples = (ripples: HTMLElement[], intensity: number) => {
      const hasSignal = intensity > 0.04;
      for (let i = 0; i < ripples.length; i++) {
        const ripple = ripples[i];
        const isSecond = ripple.classList.contains('ripple-2');

        if (!hasSignal) {
          ripple.style.transform = 'scale(1)';
          ripple.style.opacity = '0';
          continue;
        }

        const expansion = isSecond ? 0.42 : 0.28;
        const scale = 1.0 + intensity * expansion;
        const baseOpacity = isSecond ? 0.65 : 0.85;
        const opacity = Math.max(0, Math.min(1, (intensity * baseOpacity) - (isSecond ? 0.15 : 0.05)));

        ripple.style.transform = `scale(${scale.toFixed(3)})`;
        ripple.style.opacity = opacity.toFixed(2);
      }
    };

    applyRipples(this.leftRipples, left);
    applyRipples(this.rightRipples, right);
  }

  public destroy(): void {
    this.stop();
    this.stageContainer.innerHTML = '';
  }
}
