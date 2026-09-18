// Web Audio and DOM Mock for Vitest

export class MockAudioParam {
  value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  setValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  setTargetAtTime(val: number, _time: number, _constant: number) {
    this.value = val;
  }
  linearRampToValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  exponentialRampToValueAtTime(val: number, _time: number) {
    this.value = val;
  }
}

export class MockAudioNode {
  connect(dest: any) {
    return dest;
  }
  disconnect() {}
}

export class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1);
}

export class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowshelf';
  frequency = new MockAudioParam(350);
  gain = new MockAudioParam(0);
  Q = new MockAudioParam(1);
}

export class MockAnalyserNode extends MockAudioNode {
  fftSize = 256;
  frequencyBinCount = 128;
  smoothingTimeConstant = 0.8;
  getByteFrequencyData(array: Uint8Array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = (i * 10) % 255;
    }
  }
}

export class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam(-0.5);
  knee = new MockAudioParam(3.0);
  ratio = new MockAudioParam(20.0);
  attack = new MockAudioParam(0.002);
  release = new MockAudioParam(0.080);
}

export class MockMediaStreamDestinationNode extends MockAudioNode {
  stream = {
    id: 'mock-stream-id',
    active: true,
    getAudioTracks: () => [{ id: 'track-1', kind: 'audio', stop: () => {} }],
    getTracks: () => [{ id: 'track-1', kind: 'audio', stop: () => {} }]
  };
}

export class MockScriptProcessorNode extends MockAudioNode {
  bufferSize = 4096;
  onaudioprocess: ((e: any) => void) | null = null;
}

export class MockAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = new MockAudioNode();

  createGain() {
    return new MockGainNode();
  }

  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }

  createAnalyser() {
    return new MockAnalyserNode();
  }

  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode();
  }

  createMediaElementSource(_audio: any) {
    return new MockAudioNode();
  }

  createMediaStreamDestination() {
    return new MockMediaStreamDestinationNode();
  }

  createScriptProcessor() {
    return new MockScriptProcessorNode();
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: (ch: number) => data[ch] || new Float32Array(length)
    };
  }

  decodeAudioData(_arrayBuffer: ArrayBuffer) {
    return Promise.resolve(this.createBuffer(2, 44100, 44100));
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

export class MockMediaRecorder extends EventTarget {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: any;
  options: any;
  mimeType: string;
  ondataavailable: ((e: any) => void) | null = null;
  onstop: ((e: any) => void) | null = null;
  onstart: ((e: any) => void) | null = null;

  static isTypeSupported(_mimeType: string) {
    return true;
  }

  constructor(stream: any, options: any = {}) {
    super();
    this.stream = stream;
    this.options = options;
    this.mimeType = options.mimeType || 'audio/webm';
  }

  start(_timeslice?: number) {
    this.state = 'recording';
    if (this.onstart) this.onstart(new Event('start'));
    this.dispatchEvent(new Event('start'));
  }

  stop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) });
    }
    this.dispatchEvent(new CustomEvent('dataavailable', { detail: { data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) } }));
    if (this.onstop) this.onstop(new Event('stop'));
    this.dispatchEvent(new Event('stop'));
  }
}

export class MockHTMLAudioElement extends EventTarget {
  src = '';
  crossOrigin: string | null = null;
  volume = 1;
  muted = false;
  currentTime = 0;
  duration = 180;
  paused = true;
  preload = 'auto';

  private attrs: Record<string, string> = {};

  setAttribute(name: string, val: string) {
    this.attrs[name.toLowerCase()] = val;
    if (name.toLowerCase() === 'crossorigin') {
      this.crossOrigin = val;
    }
  }

  removeAttribute(name: string) {
    delete this.attrs[name.toLowerCase()];
    if (name.toLowerCase() === 'crossorigin') {
      this.crossOrigin = null;
    }
  }

  getAttribute(name: string) {
    return this.attrs[name.toLowerCase()] || null;
  }

  canPlayType(type: string): CanPlayTypeResult {
    if (type.includes('mpegurl') || type.includes('m3u8')) return 'maybe';
    if (type.includes('audio/mp3') || type.includes('audio/wav')) return 'probably';
    return '';
  }

  play() {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  load() {}
}

export class MockMediaSession {
  metadata: any = null;
  playbackState: 'none' | 'paused' | 'playing' = 'none';
  positionState: any = null;
  handlers: Map<string, Function | null> = new Map();

  setActionHandler(action: string, handler: Function | null) {
    this.handlers.set(action, handler);
  }

  setPositionState(state: any) {
    this.positionState = state;
  }
}

export function setupAudioMocks() {
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).webkitAudioContext = MockAudioContext;
  (globalThis as any).Audio = MockHTMLAudioElement;
  (globalThis as any).MediaRecorder = MockMediaRecorder;

  if (typeof (globalThis as any).MediaMetadata === 'undefined') {
    (globalThis as any).MediaMetadata = class MockMediaMetadata {
      title = '';
      artist = '';
      album = '';
      artwork: any[] = [];
      constructor(init: any = {}) {
        Object.assign(this, init);
      }
    };
  }

  if (typeof (globalThis as any).navigator === 'undefined') {
    (globalThis as any).navigator = {
      mediaSession: new MockMediaSession()
    };
  } else if (!(globalThis as any).navigator.mediaSession) {
    (globalThis as any).navigator.mediaSession = new MockMediaSession();
  }

  if (typeof (globalThis as any).localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = String(val); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => {
        for (const k in store) {
          delete store[k];
        }
      }
    };
  }
}


