import { describe, it, expect, beforeEach } from 'vitest';
import { setupDomMocks, MockDOMElement } from './mocks/dom';

setupDomMocks();

import {
  SubwooferExcursionSimulator,
  StrobeLightingRig,
  CanvasRenderer,
  Visualizer
} from '../src/visualizer';

describe('SubwooferExcursionSimulator Unit Tests', () => {
  let simulator: SubwooferExcursionSimulator;

  beforeEach(() => {
    simulator = new SubwooferExcursionSimulator();
  });

  it('should initialize with zero displacement and velocity', () => {
    expect(simulator.getDisplacement()).toBe(0);
    expect(simulator.getVelocity()).toBe(0);
    expect(simulator.getConeScale()).toBe(1.0);
    expect(simulator.getSurroundScale()).toBe(1.0);
    expect(simulator.getShockwaves().length).toBe(0);
  });

  it('should respond to target bass and dynamic kinetic kick punch', () => {
    // Inject kick impulse
    simulator.update(0.016, 0.8, 0.5);

    expect(simulator.getVelocity()).toBeGreaterThan(0);
    expect(simulator.getDisplacement()).toBeGreaterThan(0);
    expect(simulator.getConeScale()).toBeGreaterThan(1.0);
    expect(simulator.getSurroundScale()).toBeGreaterThan(1.0);
  });

  it('should clamp displacement to mechanical boundaries (no inward inversion)', () => {
    // Drive negative
    simulator.update(0.016, -1.0, 0);
    expect(simulator.getDisplacement()).toBeGreaterThanOrEqual(0);

    // Drive extreme positive
    for (let i = 0; i < 20; i++) {
      simulator.update(0.016, 5.0, 2.0);
    }
    expect(simulator.getDisplacement()).toBeLessThanOrEqual(1.35);
  });

  it('should spawn and dissipate shockwave rings on heavy sub hits', () => {
    // Drive with heavy sub-bass hit > 0.46 over multiple physical frames
    for (let i = 0; i < 10; i++) {
      simulator.update(0.016, 0.95, 0.6);
    }
    expect(simulator.getShockwaves().length).toBeGreaterThan(0);

    const firstWave = simulator.getShockwaves()[0];
    expect(firstWave.radius).toBeGreaterThanOrEqual(1.0);
    expect(firstWave.opacity).toBeGreaterThan(0);

    // Run decay updates
    for (let i = 0; i < 50; i++) {
      simulator.update(0.02, 0, 0);
    }
    // Eventually shockwaves should dissipate
    expect(simulator.getShockwaves().length).toBe(0);
  });

  it('should reset properly', () => {
    simulator.update(0.016, 0.9, 0.5);
    simulator.reset();
    expect(simulator.getDisplacement()).toBe(0);
    expect(simulator.getVelocity()).toBe(0);
    expect(simulator.getShockwaves().length).toBe(0);
  });
});

describe('StrobeLightingRig Unit Tests', () => {
  let strobeRig: StrobeLightingRig;

  beforeEach(() => {
    strobeRig = new StrobeLightingRig();
  });

  it('should initialize with zero intensity', () => {
    const state = strobeRig.getState();
    expect(state.strobeIntensity).toBe(0);
    expect(state.blinderIntensity).toBe(0);
    expect(state.underglowIntensity).toBe(0);
    expect(state.sideFlashIntensity).toBe(0);
  });

  it('should trigger strobe and blinder on dynamic peak threshold detection', () => {
    // Heavy sub hit triggers strobe & blinder
    strobeRig.update(0.016, 0.85, 0.5, 0.6);
    const activeState = strobeRig.getState();

    expect(activeState.strobeIntensity).toBeGreaterThan(0);
    expect(activeState.blinderIntensity).toBeGreaterThan(0);
    expect(activeState.sideFlashIntensity).toBeGreaterThan(0);
  });

  it('should decay exponentially over delta time', () => {
    strobeRig.update(0.016, 0.9, 0.6, 0.7);
    const beforeDecay = strobeRig.getState();

    // Multiple decay steps with silence
    for (let i = 0; i < 30; i++) {
      strobeRig.update(0.016, 0, 0, 0);
    }
    const afterDecay = strobeRig.getState();

    expect(afterDecay.strobeIntensity).toBeLessThan(beforeDecay.strobeIntensity);
    expect(afterDecay.blinderIntensity).toBeLessThan(beforeDecay.blinderIntensity);
    expect(afterDecay.sideFlashIntensity).toBeLessThan(beforeDecay.sideFlashIntensity);
  });

  it('should reset state cleanly', () => {
    strobeRig.update(0.016, 0.9, 0.5, 0.5);
    strobeRig.reset();
    const state = strobeRig.getState();
    expect(state.strobeIntensity).toBe(0);
    expect(state.blinderIntensity).toBe(0);
  });
});

describe('CanvasRenderer & Visualizer Integration Tests', () => {
  let stageContainer: MockDOMElement;

  beforeEach(() => {
    stageContainer = new MockDOMElement('div');
  });

  it('should instantiate CanvasRenderer with 2D context', () => {
    const renderer = new CanvasRenderer();
    expect(renderer.getCanvas()).toBeDefined();
    expect(renderer.getContext()).toBeDefined();
  });

  it('should execute canvas render cycle without throwing errors', () => {
    const renderer = new CanvasRenderer();
    expect(() => {
      renderer.render({
        bass: 0.7,
        left: 0.5,
        right: 0.5,
        coneScale: 1.15,
        surroundScale: 1.05,
        shockwaves: [
          { radius: 1.2, maxRadius: 1.8, opacity: 0.8, speed: 2, color: 'rgba(245, 158, 11,' }
        ],
        strobeState: {
          strobeIntensity: 0.8,
          blinderIntensity: 0.5,
          underglowIntensity: 0.7,
          sideFlashIntensity: 0.4
        }
      });
    }).not.toThrow();
  });

  it('should initialize Visualizer in canvas mode and support switching modes', () => {
    const visualizer = new Visualizer({
      stageContainer: stageContainer as any,
      mode: 'canvas'
    });

    expect(visualizer.getMode()).toBe('canvas');
    expect(visualizer.getCanvasRenderer()).toBeDefined();
    expect(visualizer.getExcursionSimulator()).toBeDefined();
    expect(visualizer.getStrobeLightingRig()).toBeDefined();

    // Switch to DOM mode
    visualizer.setMode('dom');
    expect(visualizer.getMode()).toBe('dom');

    // Switch back to canvas mode
    visualizer.setMode('canvas');
    expect(visualizer.getMode()).toBe('canvas');

    visualizer.destroy();
  });
});
