import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAudioEngine, type AudioEngine } from '@/lib/audio/engine';

// Mock Web Audio API
function createMockAudioParam(initialValue = 0) {
  return {
    value: initialValue,
    setValueAtTime: vi.fn(function (this: { value: number }, v: number) {
      this.value = v;
      return this;
    }),
    linearRampToValueAtTime: vi.fn(function (
      this: { value: number },
      v: number,
    ) {
      this.value = v;
      return this;
    }),
    cancelScheduledValues: vi.fn(),
  };
}

function createMockOscillator() {
  return {
    type: 'sine' as OscillatorType,
    frequency: createMockAudioParam(440),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockGainNode() {
  return {
    gain: createMockAudioParam(1),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockBiquadFilter() {
  return {
    type: 'lowpass' as BiquadFilterType,
    frequency: createMockAudioParam(4000),
    Q: createMockAudioParam(1),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockBufferSource() {
  return {
    buffer: null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockAudioBuffer() {
  return {
    getChannelData: vi.fn(() => new Float32Array(88200)),
  };
}

function setupMockAudioContext() {
  const mockCtx = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    sampleRate: 44100,
    destination: { connect: vi.fn() },
    createOscillator: vi.fn(() => createMockOscillator()),
    createGain: vi.fn(() => createMockGainNode()),
    createBiquadFilter: vi.fn(() => createMockBiquadFilter()),
    createBufferSource: vi.fn(() => createMockBufferSource()),
    createBuffer: vi.fn(() => createMockAudioBuffer()),
    resume: vi.fn(async function (this: { state: AudioContextState }) {
      this.state = 'running';
    }),
    close: vi.fn(),
  };

  vi.stubGlobal(
    'AudioContext',
    vi.fn(function () {
      return mockCtx;
    }),
  );

  return mockCtx;
}

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    setupMockAudioContext();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates without errors', () => {
    engine = createAudioEngine();
    expect(engine).toBeDefined();
    expect(engine.isMuted()).toBe(true);
    engine.destroy();
  });

  it('starts muted by default', () => {
    engine = createAudioEngine();
    expect(engine.isMuted()).toBe(true);
    engine.destroy();
  });

  it('resumes AudioContext on resume()', async () => {
    const mockCtx = setupMockAudioContext();
    engine = createAudioEngine();
    // Trigger context creation by calling update
    engine.update(
      { temperature: 0.5, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 },
      'clear',
    );
    await engine.resume();
    expect(mockCtx.resume).toHaveBeenCalled();
    engine.destroy();
  });

  it('mute() sets muted state', () => {
    engine = createAudioEngine();
    engine.unmute();
    expect(engine.isMuted()).toBe(false);
    engine.mute();
    expect(engine.isMuted()).toBe(true);
    engine.destroy();
  });

  it('unmute() clears muted state', () => {
    engine = createAudioEngine();
    expect(engine.isMuted()).toBe(true);
    engine.unmute();
    expect(engine.isMuted()).toBe(false);
    engine.destroy();
  });

  it('update() does not throw with valid params', () => {
    engine = createAudioEngine();
    expect(() =>
      engine.update(
        { temperature: 0.5, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 },
        'rain',
      ),
    ).not.toThrow();
    engine.destroy();
  });

  it('update() does not throw with extreme params', () => {
    engine = createAudioEngine();
    expect(() =>
      engine.update(
        { temperature: 0, humidity: 0, windSpeed: 0, cloudCover: 0 },
        'clear',
      ),
    ).not.toThrow();
    expect(() =>
      engine.update(
        { temperature: 1, humidity: 1, windSpeed: 1, cloudCover: 1 },
        'storm',
      ),
    ).not.toThrow();
    engine.destroy();
  });

  it('handles all weather conditions without errors', () => {
    engine = createAudioEngine();
    const conditions = [
      'rain',
      'snow',
      'clear',
      'cloudy',
      'storm',
      'wind',
    ] as const;
    const params = {
      temperature: 0.5,
      humidity: 0.5,
      windSpeed: 0.5,
      cloudCover: 0.5,
    };

    for (const condition of conditions) {
      expect(() => engine.update(params, condition)).not.toThrow();
    }
    engine.destroy();
  });

  it('destroy() cleans up and prevents further use', () => {
    engine = createAudioEngine();
    engine.update(
      { temperature: 0.5, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 },
      'clear',
    );
    engine.destroy();
    expect(() =>
      engine.update(
        { temperature: 0.5, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 },
        'clear',
      ),
    ).toThrow('AudioEngine has been destroyed');
  });

  it('destroy() can be called safely even without audio context creation', () => {
    engine = createAudioEngine();
    expect(() => engine.destroy()).not.toThrow();
  });

  it('creates AudioContext lazily on first use', () => {
    engine = createAudioEngine();
    expect(AudioContext).not.toHaveBeenCalled();
    engine.update(
      { temperature: 0.5, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 },
      'clear',
    );
    expect(AudioContext).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it('multiple update calls reuse the same AudioContext', () => {
    engine = createAudioEngine();
    engine.update(
      { temperature: 0, humidity: 0, windSpeed: 0, cloudCover: 0 },
      'clear',
    );
    engine.update(
      { temperature: 1, humidity: 1, windSpeed: 1, cloudCover: 1 },
      'storm',
    );
    expect(AudioContext).toHaveBeenCalledTimes(1);
    engine.destroy();
  });
});
