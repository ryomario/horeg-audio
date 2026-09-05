export interface VisualizerOptions {
  barCount?: number;
  container: HTMLElement;
  enableAnimation?: boolean;
}

export class Visualizer {
  private container: HTMLElement;
  private bars: HTMLElement[] = [];
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private isEnabled: boolean = true;
  private baseHeights: number[] = [];

  constructor(options: VisualizerOptions) {
    this.container = options.container;
    this.isEnabled = options.enableAnimation !== false;
    const barCount = options.barCount || 5;

    this.initBars(barCount);
  }

  private initBars(count: number): void {
    this.container.innerHTML = '';
    this.bars = [];
    this.baseHeights = [];

    for (let i = 0; i < count; i++) {
      const bar = document.createElement('span');
      bar.className = 'horeg-eq-bar';
      this.container.appendChild(bar);
      this.bars.push(bar);
      this.baseHeights.push(3 + (i % 2) * 2);
      bar.style.height = `${this.baseHeights[i]}px`;
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
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    // Smooth reset
    for (let i = 0; i < this.bars.length; i++) {
      this.bars[i].style.height = `${this.baseHeights[i] || 3}px`;
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const time = Date.now() / 150;
    for (let i = 0; i < this.bars.length; i++) {
      // Horeg rhythmic bass / mid / high pulsation formula
      const wave1 = Math.sin(time * 1.8 + i * 1.2);
      const wave2 = Math.cos(time * 2.5 + i * 0.8);
      const intensity = Math.abs(wave1 * 0.6 + wave2 * 0.4);
      // Height between 4px and 22px
      const height = Math.floor(4 + intensity * 18);
      this.bars[i].style.height = `${height}px`;
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  public destroy(): void {
    this.stop();
    this.bars = [];
    this.container.innerHTML = '';
  }
}

