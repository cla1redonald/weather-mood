/**
 * Screenshot the live canvas for the critic: wait for particles to settle,
 * centre-crop to 16:9, scale to 768 by 432 and encode as JPEG.
 *
 * The poem is a DOM overlay, not part of the canvas, so it is not in the
 * screenshot. The critic is told where it sits and judges that region.
 */
import {
  CAPTURE_HEIGHT,
  CAPTURE_QUALITY,
  CAPTURE_SETTLE_MS,
  CAPTURE_WIDTH,
  MAX_CRITIQUE_IMAGE_BYTES,
} from '@/lib/critique/limits';

export interface CaptureOptions {
  settleMs?: number;
  signal?: AbortSignal;
  /** Injected in tests; defaults to document.createElement('canvas'). */
  createCanvas?: () => HTMLCanvasElement;
}

export function abortError(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

/** Resolve after `ms`, or reject with an AbortError as soon as `signal` fires. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** The centred region of a source that fills the destination aspect ratio. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): SourceRect {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    const sw = srcH * dstAspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / dstAspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

/** Bytes of the payload a base64 data URL carries, without decoding it. */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function captureCanvasFrame(
  source: HTMLCanvasElement,
  options: CaptureOptions = {},
): Promise<string> {
  const { settleMs = CAPTURE_SETTLE_MS, signal } = options;
  await sleep(settleMs, signal);

  if (source.width === 0 || source.height === 0) {
    throw new Error('Canvas has no size to capture');
  }

  const offscreen = options.createCanvas ? options.createCanvas() : document.createElement('canvas');
  offscreen.width = CAPTURE_WIDTH;
  offscreen.height = CAPTURE_HEIGHT;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2d context for capture');

  // JPEG has no alpha. Black matches the page behind the canvas.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
  const { sx, sy, sw, sh } = coverRect(source.width, source.height, CAPTURE_WIDTH, CAPTURE_HEIGHT);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);

  // A typical frame is 40 to 70 KB at 0.8. A very busy one can be larger,
  // so step the quality down rather than send something the server refuses.
  for (const quality of [CAPTURE_QUALITY, 0.6, 0.4]) {
    const dataUrl = offscreen.toDataURL('image/jpeg', quality);
    if (dataUrlByteLength(dataUrl) <= MAX_CRITIQUE_IMAGE_BYTES) return dataUrl;
  }
  throw new Error('Captured frame is too large to send');
}
