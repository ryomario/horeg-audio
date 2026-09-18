import { AudioEnergy } from './AudioEngine';
import { VisualizerMode } from './types';
import {
  SubwooferExcursionSimulator,
  StrobeLightingRig,
  CanvasRenderer,
  VisualizerEngineOptions
} from './visualizer/index';

export * from './visualizer/index';

export type VisualizerOptions = VisualizerEngineOptions;

export class Visualizer {
  private stageContainer: HTMLElement;
  private coverContainer: HTMLElement | null = null;
  private isEnabled: boolean = true;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private getAudioEnergy?: () => AudioEnergy;
  private mode: VisualizerMode = 'dom';

  // Subwoofer excursion physical simulator (20-100 Hz responsive harmonic oscillator)
  private excursionSimulator: SubwooferExcursionSimulator;

  // Strobe Rig & Lighting effect with dynamic peak threshold detection
  private strobeRig: StrobeLightingRig;

  // GPU-accelerated HTML5 Canvas 2D modern renderer
  private canvasRenderer: CanvasRenderer | null = null;
  private canvasEl: HTMLCanvasElement | null = null;

  // DOM Elements (Used when mode === 'dom')
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

  // Frame-rate invariant satellite smoothing
  private smoothLeft: number = 0;
  private smoothRight: number = 0;
  private lastTimestamp: number = 0;

  constructor(options: VisualizerOptions) {
    this.stageContainer = options.stageContainer;
    this.coverContainer = options.coverContainer || null;
    this.isEnabled = options.enableAnimation !== false;
    this.mode = options.mode || 'dom';
    this.getAudioEnergy = options.getAudioEnergy;

    this.excursionSimulator = new SubwooferExcursionSimulator();
    this.strobeRig = new StrobeLightingRig();

    this.buildStage();
  }

  public setMode(mode: VisualizerMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.buildStage();
    this.applyExcursion(this.excursionSimulator.getDisplacement(), this.smoothLeft, this.smoothRight);
  }

  public getMode(): VisualizerMode {
    return this.mode;
  }

  public getExcursionSimulator(): SubwooferExcursionSimulator {
    return this.excursionSimulator;
  }

  public getStrobeLightingRig(): StrobeLightingRig {
    return this.strobeRig;
  }

  public getCanvasRenderer(): CanvasRenderer | null {
    return this.canvasRenderer;
  }

  public setAudioEnergyGetter(fn: () => AudioEnergy): void {
    this.getAudioEnergy = fn;
  }

  private buildStage(): void {
    this.stageContainer.innerHTML = '';

    if (this.mode === 'canvas') {
      this.canvasRenderer = new CanvasRenderer();
      this.canvasEl = this.canvasRenderer.getCanvas();
      this.stageContainer.appendChild(this.canvasEl);

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

    this.canvasRenderer = null;
    this.canvasEl = null;

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
        <div class="horeg-satellite-driver top">
          <span class="horeg-driver-ripple ripple-1"></span>
          <span class="horeg-driver-ripple ripple-2"></span>
          <div class="horeg-driver-surround">
            <div class="horeg-driver-cone">
              <div class="horeg-driver-cap"></div>
            </div>
          </div>
        </div>
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

    const shockwavesWrap = document.createElement('div');
    shockwavesWrap.className = 'horeg-shockwaves-wrap';
    this.shockwave1El = document.createElement('div');
    this.shockwave1El.className = 'horeg-shockwave wave-1';
    this.shockwave2El = document.createElement('div');
    this.shockwave2El.className = 'horeg-shockwave wave-2';
    shockwavesWrap.appendChild(this.shockwave1El);
    shockwavesWrap.appendChild(this.shockwave2El);
    this.subBoxEl.appendChild(shockwavesWrap);

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

    const subBaffle = document.createElement('div');
    subBaffle.className = 'horeg-sub-baffle';

    this.subSurroundEl = document.createElement('div');
    this.subSurroundEl.className = 'horeg-sub-surround';

    this.subConeEl = document.createElement('div');
    this.subConeEl.className = 'horeg-sub-cone';

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
        <div class="horeg-satellite-driver top">
          <span class="horeg-driver-ripple ripple-1"></span>
          <span class="horeg-driver-ripple ripple-2"></span>
          <div class="horeg-driver-surround">
            <div class="horeg-driver-cone">
              <div class="horeg-driver-cap"></div>
            </div>
          </div>
        </div>
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
      const dt = Math.min(0.04, Math.max(0.002, (now - lastDecayTime) / 1000));
      lastDecayTime = now;

      const decayFactor = Math.exp(-18 * dt);
      this.smoothLeft *= decayFactor;
      this.smoothRight *= decayFactor;

      // Decay physical excursion simulator
      this.excursionSimulator.update(dt, 0, 0);
      this.strobeRig.update(dt, 0, 0, 0);

      const bass = this.excursionSimulator.getDisplacement();
      this.applyExcursion(bass, this.smoothLeft, this.smoothRight);

      if (bass > 0.003 || this.smoothLeft > 0.003 || this.smoothRight > 0.003) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.excursionSimulator.reset();
        this.strobeRig.reset();
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
    const dt = this.lastTimestamp ? Math.min(0.04, Math.max(0.002, (timestamp - this.lastTimestamp) / 1000)) : 0.016;
    this.lastTimestamp = timestamp;

    const energy = this.getAudioEnergy ? this.getAudioEnergy() : { bass: 0, midHigh: 0, left: 0, right: 0, bassPunch: 0 };

    const targetBass = energy.bass < 0.01 ? 0 : energy.bass;
    const targetLeft = energy.left < 0.01 ? 0 : energy.left;
    const targetRight = energy.right < 0.01 ? 0 : energy.right;
    const bassPunch = energy.bassPunch || 0;

    // 1. Update Subwoofer Excursion Simulator (20-100 Hz sub-bass physical model)
    this.excursionSimulator.update(dt, targetBass, bassPunch);

    // 2. Update Strobe Rig & Lighting Effect (Dynamic peak threshold detector)
    this.strobeRig.update(dt, this.excursionSimulator.getDisplacement(), bassPunch, energy.midHigh);

    // 3. Satellites frame-rate invariant exponential smoothing
    const satAlpha = 1 - Math.exp(-24 * dt);
    this.smoothLeft += (targetLeft - this.smoothLeft) * satAlpha;
    if (this.smoothLeft < 0.005) this.smoothLeft = 0;

    this.smoothRight += (targetRight - this.smoothRight) * satAlpha;
    if (this.smoothRight < 0.005) this.smoothRight = 0;

    this.applyExcursion(this.excursionSimulator.getDisplacement(), this.smoothLeft, this.smoothRight);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private applyExcursion(bass: number, left: number, right: number): void {
    // Canvas Mode: 100% GPU frame rendering on 2D context without any DOM style recalculations
    if (this.mode === 'canvas') {
      if (this.canvasRenderer) {
        this.canvasRenderer.render({
          bass,
          left,
          right,
          coneScale: this.excursionSimulator.getConeScale(),
          surroundScale: this.excursionSimulator.getSurroundScale(),
          shockwaves: this.excursionSimulator.getShockwaves(),
          strobeState: this.strobeRig.getState(),
          coverElement: this.coverContainer
        });
      }
      return;
    }

    // DOM Mode (Fallback): DOM element transforms and styles
    const subScale = this.excursionSimulator.getConeScale();
    this.subConeEl.style.transform = `scale(${subScale.toFixed(3)})`;

    if (this.subSurroundEl) {
      const surroundScale = this.excursionSimulator.getSurroundScale();
      this.subSurroundEl.style.transform = `scale(${surroundScale.toFixed(3)})`;
    }

    const shadowBlur = Math.round(10 + bass * 10);
    const shadowSpread = Math.round(bass * 3);
    this.subConeEl.style.boxShadow = `0 0 ${shadowBlur}px ${shadowSpread}px rgba(0, 0, 0, 0.7)`;

    if (bass > 0.45) {
      const rumbleIntensity = (bass - 0.45) / 0.55;
      const rx = ((Math.random() - 0.5) * 1.5 * rumbleIntensity).toFixed(2);
      const ry = ((Math.random() - 0.5) * 1.5 * rumbleIntensity).toFixed(2);
      const boxScale = (1.0 + rumbleIntensity * 0.03).toFixed(3);
      this.subBoxEl.style.transform = `translate(${rx}px, ${ry}px) scale(${boxScale})`;
    } else {
      this.subBoxEl.style.transform = 'translate(0px, 0px) scale(1)';
    }

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

    const leftScale = 1.0 + left * 0.12;
    if (this.leftTopDriverEl) this.leftTopDriverEl.style.transform = `scale(${leftScale.toFixed(3)})`;
    if (this.leftBottomDriverEl) this.leftBottomDriverEl.style.transform = `scale(${leftScale.toFixed(3)})`;

    const rightScale = 1.0 + right * 0.12;
    if (this.rightTopDriverEl) this.rightTopDriverEl.style.transform = `scale(${rightScale.toFixed(3)})`;
    if (this.rightBottomDriverEl) this.rightBottomDriverEl.style.transform = `scale(${rightScale.toFixed(3)})`;

    const applyRipples = (ripples: HTMLElement[], intensity: number) => {
      const hasSignal = intensity > 0.04;
      for (let i = 0; i < ripples.length; i++) {
        const ripple = ripples[i];
        const isSecond = ripple.classList ? ripple.classList.contains('ripple-2') : false;

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
    if (this.canvasRenderer) {
      this.canvasRenderer.destroy();
      this.canvasRenderer = null;
    }
    this.canvasEl = null;
    this.stageContainer.innerHTML = '';
  }
}
