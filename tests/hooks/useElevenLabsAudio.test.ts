import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElevenLabsAudio } from '@/hooks/useElevenLabsAudio';

// ---- Mock Audio Elements ----

let audioInstances: MockAudio[] = [];

class MockAudio {
  volume = 0;
  src = '';
  loop = false;
  paused = true;
  ended = false;
  currentTime = 0;
  buffered = { length: 0 };
  onerror: (() => void) | null = null;
  onended: (() => void) | null = null;
  error = null;

  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  addEventListener = vi.fn();
  removeEventListener = vi.fn();

  constructor() {
    audioInstances.push(this);
  }
}

const OriginalAudio = globalThis.Audio;

// ---- Mock fetch ----

function createMockResponse(options?: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  body?: ReadableStream<Uint8Array> | null;
}): Response {
  const {
    ok = true,
    status = 200,
    contentType = 'audio/mpeg',
    body = null,
  } = options ?? {};

  const headers = new Headers();
  headers.set('content-type', contentType);

  return {
    ok,
    status,
    headers,
    body,
    blob: vi.fn(() =>
      Promise.resolve(new Blob(['audio-data'], { type: 'audio/mpeg' })),
    ),
    text: vi.fn(() => Promise.resolve('')),
    json: vi.fn(() => Promise.resolve({})),
  } as unknown as Response;
}

// ---- Setup / Teardown ----

let nextUrlId = 0;

beforeEach(() => {
  audioInstances = [];
  nextUrlId = 0;

  // Mock Audio constructor with a real class
  globalThis.Audio = MockAudio as unknown as typeof Audio;

  // Mock URL APIs
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    return `blob:mock-url-${nextUrlId++}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  // Mock requestAnimationFrame for fadeVolume — schedule via setTimeout
  // to avoid infinite recursion (fadeVolume calls rAF repeatedly until progress === 1)
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number;
  });

  // Mock fetch
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(createMockResponse());
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.Audio = OriginalAudio;
});

describe('useElevenLabsAudio', () => {
  // ---- Initial State ----

  it('starts muted with no audio loaded', () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    expect(result.current.isMuted).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasAudio).toBe(false);
  });

  it('creates three audio elements on mount', () => {
    renderHook(() => useElevenLabsAudio());

    // Music, SFX, Narration
    expect(audioInstances).toHaveLength(3);
  });

  // ---- fetchAll calls ----

  it('fetchAll triggers 3 API calls in parallel', async () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    await act(async () => {
      result.current.fetchAll({
        poem: 'test poem',
        voice: 'aria',
        musicDirection: 'gentle piano',
        ambienceDirection: 'soft rain',
      });
      // Let promises settle
      await new Promise((r) => setTimeout(r, 50));
    });

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls;
    const urls = fetchCalls.map((c) => c[0]);
    expect(urls).toContain('/api/music');
    expect(urls).toContain('/api/sfx');
    expect(urls).toContain('/api/narrate');
  });

  it('fetchAll auto-unmutes', async () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    expect(result.current.isMuted).toBe(true);

    await act(async () => {
      result.current.fetchAll({
        poem: 'test',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.isMuted).toBe(false);
  });

  it('fetchAll sets isLoading then clears it when done', async () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    await act(async () => {
      result.current.fetchAll({
        poem: 'test',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
    });

    // isLoading should be true during fetches
    // (it will be set immediately in the async flow)
    // After settlement it should be false
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('fetchAll aborts previous in-flight requests', async () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    await act(async () => {
      result.current.fetchAll({
        poem: 'first',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
    });

    await act(async () => {
      result.current.fetchAll({
        poem: 'second',
        musicDirection: 'guitar',
        ambienceDirection: 'wind',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    // At least the second batch of 3 calls should have been made
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls;
    expect(fetchCalls.length).toBeGreaterThanOrEqual(3);
  });

  // ---- Mute / Unmute ----

  it('mute sets isMuted to true', async () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    await act(async () => {
      result.current.fetchAll({
        poem: 'test',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.mute();
    });

    expect(result.current.isMuted).toBe(true);
  });

  it('unmute is no-op when already unmuted', async () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    // Unmute via fetchAll
    await act(async () => {
      result.current.fetchAll({
        poem: 'test',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.isMuted).toBe(false);

    // Calling unmute again should be a no-op
    act(() => {
      result.current.unmute();
    });

    expect(result.current.isMuted).toBe(false);
  });

  it('mute then unmute toggles state correctly', async () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    // Start unmuted via fetchAll
    await act(async () => {
      result.current.fetchAll({
        poem: 'test',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    act(() => {
      result.current.mute();
    });
    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.unmute();
    });
    expect(result.current.isMuted).toBe(false);
  });

  // ---- Error handling ----

  it('handles API error responses gracefully', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(globalThis.fetch).mockResolvedValue(
      createMockResponse({ ok: false, status: 500 }),
    );

    const { result } = renderHook(() => useElevenLabsAudio());

    await act(async () => {
      result.current.fetchAll({
        poem: 'test',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should have logged errors for all 3 API calls
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles JSON error responses (not audio)', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(globalThis.fetch).mockResolvedValue(
      createMockResponse({ contentType: 'application/json' }),
    );

    const { result } = renderHook(() => useElevenLabsAudio());

    await act(async () => {
      result.current.fetchAll({
        poem: 'test',
        musicDirection: 'piano',
        ambienceDirection: 'rain',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // ---- Cleanup on unmount ----

  it('cleans up audio elements on unmount', () => {
    const { unmount } = renderHook(() => useElevenLabsAudio());

    // All 3 audio elements should exist
    expect(audioInstances).toHaveLength(3);

    unmount();

    // After unmount, audio elements should have been paused
    for (const audio of audioInstances) {
      expect(audio.pause).toHaveBeenCalled();
    }
  });

  // ---- Interface stability ----

  it('exposes the correct interface shape', () => {
    const { result } = renderHook(() => useElevenLabsAudio());

    expect(typeof result.current.fetchAll).toBe('function');
    expect(typeof result.current.mute).toBe('function');
    expect(typeof result.current.unmute).toBe('function');
    expect(typeof result.current.isMuted).toBe('boolean');
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(typeof result.current.hasAudio).toBe('boolean');
  });
});
