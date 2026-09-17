import { AudioEnergy } from './AudioEngine';
import { VisualizerMode } from './types';

export interface VisualizerOptions {
  stageContainer: HTMLElement;
  coverContainer?: HTMLElement;
  enableAnimation?: boolean;
  mode?: VisualizerMode;
  getAudioEnergy?: () => AudioEnergy;
}

export class Visualizer {
  private stageContainer: HTMLElement;
  private coverContainer: HTMLElement | null = null;
  private isEnabled: boolean = true;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private getAudioEnergy?: () => AudioEnergy;
  private mode: VisualizerMode = 'dom';

  // Canvas Element
  private canvasEl: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

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
    this.mode = options.mode || 'dom';
    this.getAudioEnergy = options.getAudioEnergy;

    this.buildStage();
  }

  public setMode(mode: VisualizerMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.buildStage();
    this.applyExcursion(this.smoothBass, this.smoothLeft, this.smoothRight);
  }

  public getMode(): VisualizerMode {
    return this.mode;
  }

  public setAudioEnergyGetter(fn: () => AudioEnergy): void {
    this.getAudioEnergy = fn;
  }

  private buildStage(): void {
    this.stageContainer.innerHTML = '';

    if (this.mode === 'canvas') {
      this.canvasEl = document.createElement('canvas');
      this.canvasEl.className = 'horeg-canvas-visualizer';
      this.canvasEl.style.width = '100%';
      this.canvasEl.style.height = '100%';
      this.canvasEl.style.display = 'block';
      this.canvasEl.style.borderRadius = '12px';
      this.stageContainer.appendChild(this.canvasEl);
      this.ctx = this.canvasEl.getContext('2d');

      if (this.coverContainer) {
        const coverWrap = document.createElement('div');
        coverWrap.className = 'horeg-canvas-cover-wrap';
        coverWrap.style.position = 'absolute';
        coverWrap.style.left = '50%';
        coverWrap.style.top = '50%';
        coverWrap.style.transform = 'translate(-50%, -50%)';
        coverWrap.style.pointerEvents = 'none';
        coverWrap.style.zIndex = '5';
        coverWrap.appendChild(this.coverContainer);
        this.stageContainer.appendChild(coverWrap);
      }
      return;
    }

    // 1. Left Soundbox (Satellite with 2 circular drivers & water ripples)
    this.leftBoxEl = document.createElement('div');
    this.leftBoxEl.className = 'horeg-soundbox is-satellite is-left';
    this.leftBoxEl.innerHTML = /* html */ `
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
    subFrame.innerHTML = /* html */ `
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
    this.rightBoxEl.innerHTML = /* html */ `
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
    if (this.mode === 'dom') {
      if (this.subConeEl && !this.subConeEl.contains(container)) {
        this.subConeEl.innerHTML = '';
        this.subConeEl.appendChild(container);
      }
    } else if (this.stageContainer) {
      const existingWrap = this.stageContainer.querySelector('.horeg-canvas-cover-wrap');
      if (existingWrap && !existingWrap.contains(container)) {
        existingWrap.innerHTML = '';
        existingWrap.appendChild(container);
      }
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

  private drawCanvas(bass: number, left: number, right: number): void {
    if (!this.canvasEl || !this.ctx) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w === 0 || h === 0) return;

    if (this.canvasEl.width !== w * dpr || this.canvasEl.height !== h * dpr) {
      this.canvasEl.width = w * dpr;
      this.canvasEl.height = h * dpr;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const centerY = h / 2;
    const centerX = w / 2;

    // 1. Left Satellite Speaker
    const satW = Math.min(84, w * 0.18);
    const satH = Math.min(145, h * 0.78);
    const leftX = Math.max(12, centerX - satW * 2.2);

    ctx.fillStyle = '#121214';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(leftX, centerY - satH / 2, satW, satH, 6) : ctx.rect(leftX, centerY - satH / 2, satW, satH);
    ctx.fill();
    ctx.stroke();

    const driverRadius = satW * 0.32;
    const leftScale = 1.0 + left * 0.18;
    const leftTopY = centerY - satH * 0.23;
    const leftBottomY = centerY + satH * 0.23;
    const satCenterX = leftX + satW / 2;

    [leftTopY, leftBottomY].forEach((driverY) => {
      if (left > 0.04) {
        ctx.beginPath();
        ctx.arc(satCenterX, driverY, driverRadius * (1.2 + left * 0.4), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${Math.min(0.8, left * 0.75)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(satCenterX, driverY, driverRadius * leftScale, 0, Math.PI * 2);
      ctx.fillStyle = '#18181b';
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(satCenterX, driverY, driverRadius * 0.35 * leftScale, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    });

    // 2. Right Satellite Speaker
    const rightX = Math.min(w - satW - 12, centerX + satW * 1.2);
    ctx.fillStyle = '#121214';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(rightX, centerY - satH / 2, satW, satH, 6) : ctx.rect(rightX, centerY - satH / 2, satW, satH);
    ctx.fill();
    ctx.stroke();

    const rightScale = 1.0 + right * 0.18;
    const satRightCenterX = rightX + satW / 2;
    [leftTopY, leftBottomY].forEach((driverY) => {
      if (right > 0.04) {
        ctx.beginPath();
        ctx.arc(satRightCenterX, driverY, driverRadius * (1.2 + right * 0.4), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${Math.min(0.8, right * 0.75)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(satRightCenterX, driverY, driverRadius * rightScale, 0, Math.PI * 2);
      ctx.fillStyle = '#18181b';
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(satRightCenterX, driverY, driverRadius * 0.35 * rightScale, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    });

    // 3. Center Monster Subwoofer
    const subSize = Math.min(w * 0.40, h * 0.88);
    const subRadius = subSize / 2;

    // Shockwave expansion rings
    if (bass > 0.45) {
      const shockPower = (bass - 0.45) / 0.55;
      ctx.beginPath();
      ctx.arc(centerX, centerY, subRadius * (1.08 + shockPower * 0.48), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${Math.min(0.85, shockPower * 1.2)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, subRadius * (1.28 + shockPower * 0.65), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, (shockPower - 0.15) * 0.9)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Subwoofer Cabinet (Micro-rumble vibration on heavy bass)
    let rumbleX = 0;
    let rumbleY = 0;
    if (bass > 0.45) {
      const r = (bass - 0.45) / 0.55;
      rumbleX = (Math.random() - 0.5) * 1.8 * r;
      rumbleY = (Math.random() - 0.5) * 1.8 * r;
    }
    const subBoxX = centerX - subSize / 2 + rumbleX;
    const subBoxY = centerY - subSize / 2 + rumbleY;

    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(subBoxX, subBoxY, subSize, subSize, 12) : ctx.rect(subBoxX, subBoxY, subSize, subSize);
    ctx.fill();
    ctx.stroke();

    // Rubber Surround
    const surroundScale = 1.0 + bass * 0.08;
    ctx.beginPath();
    ctx.arc(centerX + rumbleX, centerY + rumbleY, subRadius * 0.82 * surroundScale, 0, Math.PI * 2);
    ctx.fillStyle = '#27272a';
    ctx.fill();

    // Subwoofer Cone Excursion
    const coneScale = 1.0 + bass * 0.24;
    const coneRadius = subRadius * 0.70 * coneScale;
    const radGrad = ctx.createRadialGradient(centerX + rumbleX, centerY + rumbleY, coneRadius * 0.1, centerX + rumbleX, centerY + rumbleY, coneRadius);
    radGrad.addColorStop(0, '#27272a');
    radGrad.addColorStop(0.8, '#121214');
    radGrad.addColorStop(1, '#09090b');

    ctx.beginPath();
    ctx.arc(centerX + rumbleX, centerY + rumbleY, coneRadius, 0, Math.PI * 2);
    ctx.fillStyle = radGrad;
    ctx.fill();
    ctx.strokeStyle = `rgba(245, 158, 11, ${Math.min(0.8, bass * 0.9)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center dust cap
    ctx.beginPath();
    ctx.arc(centerX + rumbleX, centerY + rumbleY, coneRadius * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#18181b';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    if (this.coverContainer) {
      const coverScale = 1.0 + bass * 0.12;
      this.coverContainer.style.transform = `scale(${coverScale.toFixed(3)})`;
    }
  }

  private applyExcursion(bass: number, left: number, right: number): void {
    if (this.mode === 'canvas') {
      this.drawCanvas(bass, left, right);
      return;
    }

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
    this.canvasEl = null;
    this.ctx = null;
    this.stageContainer.innerHTML = '';
  }
}
