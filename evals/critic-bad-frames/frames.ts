/**
 * Synthetic 768x432 frames for the critic evals and the critique route tests.
 * Generated from a seeded random source, so every run sees identical pixels,
 * and encoded with jpeg-js at quality 80 to match what the browser sends.
 */
import { encode } from 'jpeg-js';
import { CAPTURE_HEIGHT, CAPTURE_WIDTH, MAX_CRITIQUE_IMAGE_BYTES } from '@/lib/critique/limits';

export type Verdict = 'accept' | 'revise';

export interface FrameCase {
  id: string;
  description: string;
  /** What the deterministic pixel checks alone should decide. */
  expectedPixels: 'fail' | 'pass';
  /** What the full critic (model plus pixel checks) should decide. Null: no fixed expectation. */
  expectedVerdict: Verdict | null;
  render: () => Uint8Array;
}

type RGB = [number, number, number];

const W = CAPTURE_WIDTH;
const H = CAPTURE_HEIGHT;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blank(colour: RGB): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = colour[0];
    data[i * 4 + 1] = colour[1];
    data[i * 4 + 2] = colour[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

function gradient(top: RGB, bottom: RGB): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  for (let row = 0; row < H; row++) {
    const t = row / (H - 1);
    const r = top[0] + (bottom[0] - top[0]) * t;
    const g = top[1] + (bottom[1] - top[1]) * t;
    const b = top[2] + (bottom[2] - top[2]) * t;
    for (let col = 0; col < W; col++) {
      const o = (row * W + col) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  return data;
}

/** Soft round particles, alpha falling off to the edge, blended over the frame. */
function dots(data: Uint8Array, count: number, colour: RGB, radius: [number, number], alpha: number, seed: number): Uint8Array {
  const random = mulberry32(seed);
  for (let n = 0; n < count; n++) {
    const cx = random() * W;
    const cy = random() * H;
    const r = radius[0] + random() * (radius[1] - radius[0]);
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        const a = alpha * (1 - d * d);
        const o = (y * W + x) * 4;
        data[o] = data[o] * (1 - a) + colour[0] * a;
        data[o + 1] = data[o + 1] * (1 - a) + colour[1] * a;
        data[o + 2] = data[o + 2] * (1 - a) + colour[2] * a;
      }
    }
  }
  return data;
}

/** Thin diagonal streaks, like the renderer's 'line' draw style in rain. */
function streaks(data: Uint8Array, count: number, colour: RGB, length: number, alpha: number, seed: number): Uint8Array {
  const random = mulberry32(seed);
  for (let n = 0; n < count; n++) {
    const x0 = random() * W;
    const y0 = random() * H;
    for (let s = 0; s < length; s++) {
      const x = Math.round(x0 + s * 0.25);
      const y = Math.round(y0 + s);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = (y * W + x) * 4;
      data[o] = data[o] * (1 - alpha) + colour[0] * alpha;
      data[o + 1] = data[o + 1] * (1 - alpha) + colour[1] * alpha;
      data[o + 2] = data[o + 2] * (1 - alpha) + colour[2] * alpha;
    }
  }
  return data;
}

/**
 * Thousands of small hard-edged dots in clashing colours. The renderer caps
 * particles at 400, so this is past anything it can draw: it stands for a
 * frame that has broken down into noise.
 */
function clutter(seed: number): Uint8Array {
  const data = gradient([60, 40, 70], [60, 40, 70]);
  const palette: RGB[] = [[255, 220, 120], [120, 240, 255], [255, 90, 160], [250, 250, 250]];
  const random = mulberry32(seed);
  for (let n = 0; n < 6000; n++) {
    const colour = palette[n % palette.length];
    dotsAt(data, random() * W, random() * H, 1 + random(), colour, 0.95);
  }
  return data;
}

/** One hard-edged disc. */
function dotsAt(data: Uint8Array, cx: number, cy: number, r: number, colour: RGB, alpha: number): void {
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, Math.ceil(cx + r)); x++) {
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const o = (y * W + x) * 4;
      data[o] = data[o] * (1 - alpha) + colour[0] * alpha;
      data[o + 1] = data[o + 1] * (1 - alpha) + colour[1] * alpha;
      data[o + 2] = data[o + 2] * (1 - alpha) + colour[2] * alpha;
    }
  }
}

export const FRAME_CASES: FrameCase[] = [
  {
    id: 'blank',
    description: 'A single flat mid-grey: nothing rendered.',
    expectedPixels: 'fail',
    expectedVerdict: 'revise',
    render: () => blank([128, 128, 128]),
  },
  {
    id: 'all-black',
    description: 'Pure black, as if the canvas never drew.',
    expectedPixels: 'fail',
    expectedVerdict: 'revise',
    render: () => blank([0, 0, 0]),
  },
  {
    id: 'white-on-white',
    description: 'Near-white sky with white particles: washed out, poem unreadable.',
    expectedPixels: 'fail',
    expectedVerdict: 'revise',
    render: () => dots(gradient([246, 247, 250], [252, 252, 253]), 160, [255, 255, 255], [3, 9], 0.6, 11),
  },
  {
    id: 'over-dense-clutter',
    description: 'Every pixel fighting for attention: maximum particle noise.',
    expectedPixels: 'fail',
    expectedVerdict: 'revise',
    render: () => clutter(7),
  },
  {
    id: 'control-max-particles',
    description: 'The renderer at its limit: 400 large bright particles. Busy, but judging that is the model\'s job.',
    expectedPixels: 'pass',
    expectedVerdict: null,
    render: () => dots(gradient([30, 60, 90], [80, 120, 150]), 400, [255, 230, 180], [4, 10], 0.9, 17),
  },
  {
    id: 'good-dusk',
    description: 'Slate-to-violet dusk gradient with sparse warm glow particles.',
    expectedPixels: 'pass',
    expectedVerdict: 'accept',
    render: () => dots(gradient([34, 46, 84], [118, 100, 140]), 120, [250, 205, 140], [3, 10], 0.55, 3),
  },
  {
    id: 'control-storm',
    description: 'A legitimate dark storm with rain streaks: must not trip the dark check.',
    expectedPixels: 'pass',
    expectedVerdict: null,
    render: () => streaks(gradient([20, 25, 35], [40, 50, 65]), 380, [140, 160, 180], 18, 0.7, 5),
  },
  {
    id: 'control-snow',
    description: 'A legitimate bright snowfall: must not trip the washed-out check.',
    expectedPixels: 'pass',
    expectedVerdict: null,
    render: () => dots(gradient([180, 195, 215], [220, 230, 245]), 200, [240, 245, 255], [2, 8], 0.7, 13),
  },
];

export function encodeFrame(rgba: Uint8Array, quality = 80): Buffer {
  return encode({ data: rgba, width: W, height: H }, quality).data;
}

/** Encode the way captureCanvasFrame does: quality 0.8, stepping down to fit the cap. */
export function encodeLikeBrowser(rgba: Uint8Array): { jpeg: Buffer; quality: number } {
  for (const quality of [80, 60]) {
    const jpeg = encodeFrame(rgba, quality);
    if (jpeg.length <= MAX_CRITIQUE_IMAGE_BYTES) return { jpeg, quality };
  }
  return { jpeg: encodeFrame(rgba, 40), quality: 40 };
}

export function frameToDataUrl(rgba: Uint8Array, quality = 80): string {
  return `data:image/jpeg;base64,${encodeFrame(rgba, quality).toString('base64')}`;
}

export function frameCase(id: string): FrameCase {
  const found = FRAME_CASES.find((c) => c.id === id);
  if (!found) throw new Error(`No frame case ${id}`);
  return found;
}
