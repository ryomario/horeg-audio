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
  private subConeEl!: HTMLElement;
  private shockwave1El!: HTMLElement;
  private shockwave2El!: HTMLElement;

  private rightBoxEl!: HTMLElement;
  private rightTopDriverEl!: HTMLElement;
  private rightBottomDriverEl!: HTMLElement;
  private rightRipples: HTMLElement[] = [];

  // Physics values for smooth excursion and decay
  private smoothBass: number = 0;
  private smoothLeft: number = 0;
  private smoothRight: number = 0;

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

    const subSurround = document.createElement('div');
    subSurround.className = 'horeg-sub-surround';

    this.subConeEl = document.createElement('div');
    this.subConeEl.className = 'horeg-sub-cone';

    // Circular cover art mounted in center of the subwoofer cone
    if (this.coverContainer) {
      this.subConeEl.appendChild(this.coverContainer);
    }

    subSurround.appendChild(this.subConeEl);
    subBaffle.appendChild(subSurround);
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
    this.loop();
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

    const step = () => {
      this.smoothBass *= 0.80;
      this.smoothLeft *= 0.80;
      this.smoothRight *= 0.80;

      this.applyExcursion(this.smoothBass, this.smoothLeft, this.smoothRight);

      if (this.smoothBass > 0.005 || this.smoothLeft > 0.005 || this.smoothRight > 0.005) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.smoothBass = 0;
        this.smoothLeft = 0;
        this.smoothRight = 0;
        this.applyExcursion(0, 0, 0);
        this.animFrameId = null;
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const energy = this.getAudioEnergy ? this.getAudioEnergy() : { bass: 0, midHigh: 0, left: 0, right: 0 };

    const targetBass = energy.bass < 0.01 ? 0 : energy.bass;
    const targetLeft = energy.left < 0.01 ? 0 : energy.left;
    const targetRight = energy.right < 0.01 ? 0 : energy.right;

    // Fast attack (snap to kick beat), fast bouncy release back to small rest radius
    if (targetBass > this.smoothBass) {
      this.smoothBass += (targetBass - this.smoothBass) * 0.85;
    } else {
      this.smoothBass += (targetBass - this.smoothBass) * 0.38;
    }
    if (this.smoothBass < 0.01) this.smoothBass = 0;

    this.smoothLeft += (targetLeft - this.smoothLeft) * 0.40;
    if (this.smoothLeft < 0.01) this.smoothLeft = 0;

    this.smoothRight += (targetRight - this.smoothRight) * 0.40;
    if (this.smoothRight < 0.01) this.smoothRight = 0;

    this.applyExcursion(this.smoothBass, this.smoothLeft, this.smoothRight);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private applyExcursion(bass: number, left: number, right: number): void {
    // 1. Center Monster Subwoofer (Exclusively driven by Bass)
    const subScale = 1.0 + bass * 0.42;
    this.subConeEl.style.transform = `scale(${subScale.toFixed(3)})`;

    // Subwoofer cabinet only swells when real bass is actively punching
    const boxScale = bass > 0.15 ? 1.0 + (bass - 0.15) * 0.08 : 1.0;
    this.subBoxEl.style.transform = `scale(${boxScale.toFixed(3)})`;

    // Subwoofer Shockwaves: Trigger strictly on real bass punch
    if (bass > 0.16) {
      const shockPower = (bass - 0.16) / 0.84;
      const waveScale1 = 1.0 + shockPower * 0.85;
      const waveOpacity1 = Math.min(0.95, shockPower * 1.6);
      this.shockwave1El.style.transform = `scale(${waveScale1.toFixed(3)})`;
      this.shockwave1El.style.opacity = waveOpacity1.toFixed(2);

      const waveScale2 = 1.0 + shockPower * 1.25;
      const waveOpacity2 = Math.max(0, (shockPower - 0.15) * 1.4);
      this.shockwave2El.style.transform = `scale(${waveScale2.toFixed(3)})`;
      this.shockwave2El.style.opacity = waveOpacity2.toFixed(2);
    } else {
      this.shockwave1El.style.transform = 'scale(1)';
      this.shockwave1El.style.opacity = '0';
      this.shockwave2El.style.transform = 'scale(1)';
      this.shockwave2El.style.opacity = '0';
    }

    // 2. Left & Right Satellites (Cones excursion)
    const leftScale = 1.0 + left * 0.08;
    if (this.leftTopDriverEl) this.leftTopDriverEl.style.transform = `scale(${leftScale.toFixed(3)})`;
    if (this.leftBottomDriverEl) this.leftBottomDriverEl.style.transform = `scale(${leftScale.toFixed(3)})`;

    const rightScale = 1.0 + right * 0.08;
    if (this.rightTopDriverEl) this.rightTopDriverEl.style.transform = `scale(${rightScale.toFixed(3)})`;
    if (this.rightBottomDriverEl) this.rightBottomDriverEl.style.transform = `scale(${rightScale.toFixed(3)})`;

    // 3. Compact Water-like Ripples on the 4 Satellite Circles (2 Left, 2 Right)
    // Ripples expand subtly on a small radius and fade away cleanly
    const applyRipples = (ripples: HTMLElement[], intensity: number) => {
      const hasSignal = intensity > 0.12;
      for (let i = 0; i < ripples.length; i++) {
        const ripple = ripples[i];
        const isSecond = ripple.classList.contains('ripple-2');

        if (!hasSignal) {
          ripple.style.transform = 'scale(1)';
          ripple.style.opacity = '0';
          continue;
        }

        // Compact ripple radius: expands from 1.0 up to ~1.28 (ripple-1) or ~1.42 (ripple-2)
        const expansion = isSecond ? 0.42 : 0.28;
        const scale = 1.0 + intensity * expansion;
        // Fade out as it expands outward like water ripple
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
