import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureCanvasFrame, coverRect, dataUrlByteLength } from '@/lib/critique/capture';

interface StubContext {
  fillStyle: string;
  fillRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
}

function dataUrlOfBytes(bytes: number): string {
  // base64 of `bytes` bytes, no padding when bytes is a multiple of 3
  return `data:image/jpeg;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4)}`;
}

function stubOffscreen(sizesByQuality: Record<number, number> = { 0.8: 55 * 1024 }) {
  const ctx: StubContext = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn((_type: string, quality: number) => dataUrlOfBytes(sizesByQuality[quality] ?? 300 * 1024)),
  };
  return { canvas, ctx, create: () => canvas as unknown as HTMLCanvasElement };
}

function liveCanvas(width: number, height: number): HTMLCanvasElement {
  return { width, height } as HTMLCanvasElement;
}

describe('captureCanvasFrame', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits about three seconds before drawing, so particles can settle', async () => {
    const off = stubOffscreen();
    const pending = captureCanvasFrame(liveCanvas(1920, 1080), { createCanvas: off.create });

    await vi.advanceTimersByTimeAsync(2_900);
    expect(off.ctx.drawImage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    await pending;
    expect(off.ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('draws the live canvas into a 768 by 432 frame and returns a JPEG at quality 0.8', async () => {
    const off = stubOffscreen();
    const source = liveCanvas(1920, 1080);
    const pending = captureCanvasFrame(source, { createCanvas: off.create });
    await vi.advanceTimersByTimeAsync(3_000);
    const dataUrl = await pending;

    expect(off.canvas.width).toBe(768);
    expect(off.canvas.height).toBe(432);
    expect(off.ctx.drawImage).toHaveBeenCalledWith(source, 0, 0, 1920, 1080, 0, 0, 768, 432);
    expect(off.canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    const kb = dataUrlByteLength(dataUrl) / 1024;
    expect(kb).toBeGreaterThan(40);
    expect(kb).toBeLessThan(70);
  });

  it('centre-crops a portrait phone canvas instead of squashing it', async () => {
    const off = stubOffscreen();
    const source = liveCanvas(1170, 2532);
    const pending = captureCanvasFrame(source, { createCanvas: off.create });
    await vi.advanceTimersByTimeAsync(3_000);
    await pending;

    const [, sx, sy, sw, sh] = off.ctx.drawImage.mock.calls[0];
    expect(sx).toBe(0);
    expect(sw).toBe(1170);
    expect(sw / sh).toBeCloseTo(16 / 9, 5);
    expect(sy).toBeCloseTo((2532 - sh) / 2, 5);
  });

  it('steps JPEG quality down when a busy frame would exceed the 150 KB cap', async () => {
    const off = stubOffscreen({ 0.8: 190 * 1024, 0.6: 120 * 1024 });
    const pending = captureCanvasFrame(liveCanvas(1600, 900), { createCanvas: off.create });
    await vi.advanceTimersByTimeAsync(3_000);
    const dataUrl = await pending;

    expect(off.canvas.toDataURL).toHaveBeenNthCalledWith(1, 'image/jpeg', 0.8);
    expect(off.canvas.toDataURL).toHaveBeenNthCalledWith(2, 'image/jpeg', 0.6);
    expect(dataUrlByteLength(dataUrl)).toBeLessThanOrEqual(150 * 1024);
  });

  it('rejects with an AbortError and never draws when aborted while settling', async () => {
    const off = stubOffscreen();
    const controller = new AbortController();
    const pending = captureCanvasFrame(liveCanvas(1920, 1080), { createCanvas: off.create, signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });

    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await assertion;
    expect(off.ctx.drawImage).not.toHaveBeenCalled();
  });

  it('fails clearly when the canvas has no size yet', async () => {
    const off = stubOffscreen();
    const pending = captureCanvasFrame(liveCanvas(0, 0), { createCanvas: off.create });
    const assertion = expect(pending).rejects.toThrow(/no size/);
    await vi.advanceTimersByTimeAsync(3_000);
    await assertion;
  });
});

describe('capture helpers', () => {
  it('coverRect crops a wide source at the sides', () => {
    const rect = coverRect(3000, 1000, 768, 432);
    expect(rect.sh).toBe(1000);
    expect(rect.sw / rect.sh).toBeCloseTo(16 / 9, 5);
    expect(rect.sx).toBeCloseTo((3000 - rect.sw) / 2, 5);
  });

  it('dataUrlByteLength accounts for base64 padding', () => {
    expect(dataUrlByteLength('data:image/jpeg;base64,QUJD')).toBe(3);
    expect(dataUrlByteLength('data:image/jpeg;base64,QUI=')).toBe(2);
    expect(dataUrlByteLength('data:image/jpeg;base64,QQ==')).toBe(1);
  });
});
