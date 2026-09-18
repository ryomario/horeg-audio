import { HoregAudio } from '../../../src/Player';
import { Track, VisualizerMode, ThemeVariant } from '../../../src/types';

const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as any)) as typeof HTMLElement;

export class HoregAudioElement extends BaseElement {
  public static get observedAttributes(): string[] {
    return [
      'src',
      'title',
      'artist',
      'cover',
      'bass',
      'theme',
      'volume',
      'autoplay',
      'mode',
      'loop'
    ];
  }

  private playerInstance: HoregAudio | null = null;
  private mountContainer: HTMLDivElement | null = null;
  private isConnectedToDom: boolean = false;

  constructor() {
    super();
  }

  public connectedCallback(): void {
    if (this.isConnectedToDom) return;
    this.isConnectedToDom = true;

    // Create an inner mount point
    this.mountContainer = document.createElement('div');
    this.mountContainer.style.width = '100%';
    this.appendChild(this.mountContainer);

    this.initPlayer();
  }

  public disconnectedCallback(): void {
    if (this.playerInstance) {
      this.playerInstance.destroy();
      this.playerInstance = null;
    }
    if (this.mountContainer && this.mountContainer.parentNode) {
      this.mountContainer.parentNode.removeChild(this.mountContainer);
      this.mountContainer = null;
    }
    this.isConnectedToDom = false;
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.playerInstance) return;

    switch (name) {
      case 'bass':
        if (newValue !== null) {
          const bassNum = parseFloat(newValue);
          if (!isNaN(bassNum)) {
            this.playerInstance.setBass(bassNum);
          }
        }
        break;
      case 'volume':
        if (newValue !== null) {
          const volNum = parseFloat(newValue);
          if (!isNaN(volNum)) {
            this.playerInstance.setVolume(volNum);
          }
        }
        break;
      case 'theme':
        if (newValue) {
          this.playerInstance.setTheme({ variant: newValue as ThemeVariant });
        }
        break;
      case 'mode':
        if (newValue === 'dom' || newValue === 'canvas' || newValue === 'webgl') {
          this.playerInstance.setVisualizerMode(newValue as VisualizerMode);
        }
        break;
      case 'src':
        if (newValue) {
          const title = this.getAttribute('title') || 'Unknown Track';
          const artist = this.getAttribute('artist') || 'Unknown Artist';
          const cover = this.getAttribute('cover') || undefined;
          this.playerInstance.addTrackFromUrl(newValue, { title, artist, coverArt: cover }, true);
        }
        break;
    }
  }

  private initPlayer(): void {
    if (!this.mountContainer) return;

    const src = this.getAttribute('src');
    const title = this.getAttribute('title') || 'Untitled';
    const artist = this.getAttribute('artist') || 'Sound Horeg';
    const cover = this.getAttribute('cover') || undefined;
    const bass = this.getAttribute('bass') ? parseFloat(this.getAttribute('bass')!) : 0;
    const volume = this.getAttribute('volume') ? parseFloat(this.getAttribute('volume')!) : 0.8;
    const autoplay = this.hasAttribute('autoplay');
    const themeVariant = (this.getAttribute('theme') as ThemeVariant) || 'horeg-classic';
    const visualizerMode = (this.getAttribute('mode') as VisualizerMode) || 'dom';

    const playlist: Track[] = src
      ? [
          {
            title,
            artist,
            src,
            coverArt: cover
          }
        ]
      : [];

    this.playerInstance = new HoregAudio({
      container: this.mountContainer,
      playlist,
      autoplay,
      volume,
      bassBoost: bass,
      theme: { variant: themeVariant },
      visualizerMode,
      onPlay: (track) => {
        this.dispatchEvent(new CustomEvent('play', { detail: { track } }));
      },
      onPause: () => {
        this.dispatchEvent(new CustomEvent('pause'));
      },
      onEnded: (track) => {
        this.dispatchEvent(new CustomEvent('ended', { detail: { track } }));
      },
      onTimeUpdate: (currentTime, duration) => {
        this.dispatchEvent(new CustomEvent('timeupdate', { detail: { currentTime, duration } }));
      },
      onTrackChange: (track, index) => {
        this.dispatchEvent(new CustomEvent('trackchange', { detail: { track, index } }));
      },
      onBassChange: (bassLevel) => {
        this.dispatchEvent(new CustomEvent('basschange', { detail: { bass: bassLevel } }));
      },
      onError: (error) => {
        this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
      }
    });
  }

  // --- Public Element Properties & Methods ---

  public get player(): HoregAudio | null {
    return this.playerInstance;
  }

  public get paused(): boolean {
    return !this.playerInstance?.isPlaying();
  }

  public get duration(): number {
    return this.playerInstance?.getDuration() || 0;
  }

  public get currentTime(): number {
    return this.playerInstance?.getCurrentTime() || 0;
  }

  public set currentTime(seconds: number) {
    this.playerInstance?.seek(seconds);
  }

  public get volume(): number {
    return this.playerInstance?.getVolume() || 0;
  }

  public set volume(val: number) {
    this.playerInstance?.setVolume(val);
  }

  public get bass(): number {
    return this.playerInstance?.getBass() || 0;
  }

  public set bass(val: number) {
    this.playerInstance?.setBass(val);
  }

  public play(): Promise<void> | void {
    return this.playerInstance?.play();
  }

  public pause(): void {
    this.playerInstance?.pause();
  }

  public togglePlay(): Promise<void> | void {
    return this.playerInstance?.togglePlay();
  }

  public next(): void {
    this.playerInstance?.next();
  }

  public prev(): void {
    this.playerInstance?.prev();
  }

  public seek(seconds: number): void {
    this.playerInstance?.seek(seconds);
  }

  public setBass(gain: number): void {
    this.playerInstance?.setBass(gain);
  }

  public setTheme(theme: any): void {
    this.playerInstance?.setTheme(theme);
  }

  public setVisualizerMode(mode: VisualizerMode): void {
    this.playerInstance?.setVisualizerMode(mode);
  }
}

export function registerHoregAudioElement(tagName: string = 'horeg-audio'): typeof HoregAudioElement | undefined {
  if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, HoregAudioElement);
    }
    return HoregAudioElement;
  }
  return undefined;
}
