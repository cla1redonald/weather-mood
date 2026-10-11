/**
 * Validate and decode the screenshot the browser sends. Size is checked on the
 * base64 length before any decoding, and the decoder is capped, so a hostile
 * upload costs at most a bounded amount of CPU and memory.
 */
import { decode } from 'jpeg-js';
import { CAPTURE_HEIGHT, CAPTURE_WIDTH, MAX_CRITIQUE_IMAGE_BYTES } from '@/lib/critique/limits';

const DATA_URL_PREFIX = 'data:image/jpeg;base64,';

export type DecodedImage =
  | { ok: true; base64: string; bytes: number; width: number; height: number; rgba: Uint8Array }
  | { ok: false; reason: 'not_jpeg_data_url' | 'too_large' | 'not_jpeg' | 'undecodable' | 'wrong_size' };

export function decodeCritiqueImage(value: unknown): DecodedImage {
  if (typeof value !== 'string' || !value.startsWith(DATA_URL_PREFIX)) {
    return { ok: false, reason: 'not_jpeg_data_url' };
  }

  const base64 = value.slice(DATA_URL_PREFIX.length);
  // Upper bound on the decoded size, known before allocating anything.
  if (Math.floor((base64.length * 3) / 4) - 2 > MAX_CRITIQUE_IMAGE_BYTES) {
    return { ok: false, reason: 'too_large' };
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    return { ok: false, reason: 'not_jpeg_data_url' };
  }

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_CRITIQUE_IMAGE_BYTES) return { ok: false, reason: 'too_large' };
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { ok: false, reason: 'not_jpeg' };
  }

  let image: { width: number; height: number; data: Uint8Array };
  try {
    image = decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 32,
    });
  } catch {
    return { ok: false, reason: 'undecodable' };
  }

  if (image.width !== CAPTURE_WIDTH || image.height !== CAPTURE_HEIGHT) {
    return { ok: false, reason: 'wrong_size' };
  }

  return { ok: true, base64, bytes: bytes.length, width: image.width, height: image.height, rgba: image.data };
}
