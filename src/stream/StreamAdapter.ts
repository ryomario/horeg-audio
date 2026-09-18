import { StreamType, StreamInfo } from '../types';

/**
 * Detects the protocol / streaming type of a media URL.
 */
export function detectStreamType(url: string): StreamType {
  if (!url || typeof url !== 'string') return 'direct';

  const cleanUrl = url.toLowerCase().split('?')[0];
  const strippedUrl = cleanUrl.replace(/;+$/, '');

  // HLS Manifests
  if (strippedUrl.endsWith('.m3u8') || url.includes('.m3u8?') || url.includes('/hls/')) {
    return 'hls';
  }

  // Playlist / Shoutcast / Icecast radio streams
  if (
    strippedUrl.endsWith('.pls') ||
    strippedUrl.endsWith('.m3u') ||
    strippedUrl.endsWith('.xspf') ||
    strippedUrl.endsWith('/stream') ||
    strippedUrl.endsWith('/listen') ||
    url.includes('icecast') ||
    url.includes('shoutcast') ||
    /:[0-9]{4,5}\/(stream|;)?/i.test(url)
  ) {
    return 'radio';
  }

  return 'direct';
}

/**
 * Checks whether a given audio URL or duration represents a live continuous stream.
 */
export function isLiveStream(url: string, duration?: number): boolean {
  if (duration === Infinity || (duration !== undefined && isNaN(duration))) {
    return true;
  }
  const type = detectStreamType(url);
  return type === 'radio' || type === 'live';
}

export interface StreamAdapterOptions {
  hlsConfig?: any;
  hlsConstructor?: any;
  onStreamTypeDetected?: (info: StreamInfo) => void;
  onError?: (error: Error) => void;
}

/**
 * Protocol adapter for HLS (.m3u8) and continuous online radio streams.
 */
export class StreamAdapter {
  private audio: HTMLAudioElement;
  private hlsInstance: any = null;
  private currentInfo: StreamInfo = { type: 'direct', isLive: false, url: '' };
  private options: StreamAdapterOptions;

  constructor(audio: HTMLAudioElement, options: StreamAdapterOptions = {}) {
    this.audio = audio;
    this.options = options;
  }

  /**
   * Configures and attaches audio source according to stream type.
   */
  public load(url: string): StreamInfo {
    this.cleanup();

    const streamType = detectStreamType(url);
    const isLive = streamType === 'hls' || streamType === 'radio';
    this.currentInfo = { type: streamType, isLive, url };

    if (this.options.onStreamTypeDetected) {
      this.options.onStreamTypeDetected(this.currentInfo);
    }

    if (streamType === 'hls') {
      const canNativeHls =
        typeof this.audio.canPlayType === 'function' &&
        (this.audio.canPlayType('application/vnd.apple.mpegurl') ||
          this.audio.canPlayType('application/x-mpegURL'));

      if (canNativeHls) {
        // Native Safari/iOS playback
        this.audio.src = url;
      } else {
        // External Hls.js support if available in window or options
        const HlsClass =
          this.options.hlsConstructor ||
          (typeof window !== 'undefined' ? (window as any).Hls : null);

        if (HlsClass && HlsClass.isSupported && HlsClass.isSupported()) {
          try {
            this.hlsInstance = new HlsClass(this.options.hlsConfig || {});
            this.hlsInstance.loadSource(url);
            this.hlsInstance.attachMedia(this.audio);
            if (this.options.onError) {
              this.hlsInstance.on(HlsClass.Events.ERROR, (_: any, data: any) => {
                if (data.fatal) {
                  this.options.onError!(new Error(`HLS Fatal Error: ${data.type} - ${data.details}`));
                }
              });
            }
          } catch (e) {
            // Fallback to setting audio.src directly
            this.audio.src = url;
          }
        } else {
          this.audio.src = url;
        }
      }
    } else {
      this.audio.src = url;
    }

    return this.currentInfo;
  }

  public getStreamInfo(): StreamInfo {
    return { ...this.currentInfo };
  }

  public isLive(): boolean {
    return this.currentInfo.isLive || this.audio.duration === Infinity;
  }

  public cleanup(): void {
    if (this.hlsInstance) {
      try {
        this.hlsInstance.destroy();
      } catch (_) {}
      this.hlsInstance = null;
    }
  }

  public destroy(): void {
    this.cleanup();
  }
}
