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

export class MockAudioContext {
  state = 'running';
  currentTime = 0;
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

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
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

export function setupAudioMocks() {
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).webkitAudioContext = MockAudioContext;
  (globalThis as any).Audio = MockHTMLAudioElement;
}
