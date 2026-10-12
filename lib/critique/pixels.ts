/**
 * Deterministic checks on the decoded screenshot. They run on every critique
 * whatever the model says, and any failure forces a revise: a model can talk
 * itself into liking a black frame, arithmetic cannot.
 *
 * Thresholds are on Rec. 709 luma (0 to 255), set against the synthetic frames
 * in evals/critic-bad-frames. A storm frame built from the darkest fallback
 * palette measures a mean near 37 and a snow frame from the brightest near
 * 211, so neither trips the dark or washed-out checks. Legitimate frames
 * measure an edge density of 4 or less; noise-level clutter measures above 20.
 * The clutter check only catches noise: ordinary over-density is for the
 * model's density score, because the renderer caps particles at 400.
 */

export type PixelFailure = 'blank' | 'too_dark' | 'washed_out' | 'cluttered';

export interface PixelReport {
  meanLuminance: number;
  luminanceStdDev: number;
  /** Mean absolute luma step between neighbouring pixels. Noise scores high. */
  edgeDensity: number;
  /** Mean luma behind the poem panel (bottom centre of the frame). */
  poemRegionLuminance: number;
  failures: PixelFailure[];
}

export const PIXEL_THRESHOLDS = {
  blankStdDev: 4,
  tooDarkMean: 14,
  washedOutMean: 235,
  clutteredEdgeDensity: 15,
} as const;

/** Where PoemOverlay sits, as fractions of the frame. */
export const POEM_REGION = { x0: 0.3, x1: 0.7, y0: 0.65, y1: 0.95 } as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Analyse RGBA pixels (4 bytes per pixel, row-major), the layout both
 * jpeg-js and canvas ImageData use.
 */
export function analysePixels(rgba: ArrayLike<number>, width: number, height: number): PixelReport {
  const pixelCount = width * height;
  if (pixelCount === 0 || rgba.length < pixelCount * 4) {
    return { meanLuminance: 0, luminanceStdDev: 0, edgeDensity: 0, poemRegionLuminance: 0, failures: ['blank'] };
  }

  const luma = new Float32Array(pixelCount);
  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const y = 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
    luma[i] = y;
    sum += y;
    sumSquares += y * y;
  }
  const mean = sum / pixelCount;
  const stdDev = Math.sqrt(Math.max(0, sumSquares / pixelCount - mean * mean));

  let stepSum = 0;
  let stepCount = 0;
  for (let row = 0; row < height - 1; row++) {
    for (let col = 0; col < width - 1; col++) {
      const i = row * width + col;
      stepSum += Math.abs(luma[i] - luma[i + 1]) + Math.abs(luma[i] - luma[i + width]);
      stepCount += 2;
    }
  }
  const edgeDensity = stepCount > 0 ? stepSum / stepCount : 0;

  const x0 = Math.floor(width * POEM_REGION.x0);
  const x1 = Math.ceil(width * POEM_REGION.x1);
  const y0 = Math.floor(height * POEM_REGION.y0);
  const y1 = Math.ceil(height * POEM_REGION.y1);
  let regionSum = 0;
  let regionCount = 0;
  for (let row = y0; row < y1; row++) {
    for (let col = x0; col < x1; col++) {
      regionSum += luma[row * width + col];
      regionCount += 1;
    }
  }
  const poemRegionLuminance = regionCount > 0 ? regionSum / regionCount : mean;

  const failures: PixelFailure[] = [];
  if (stdDev < PIXEL_THRESHOLDS.blankStdDev) failures.push('blank');
  if (mean < PIXEL_THRESHOLDS.tooDarkMean) failures.push('too_dark');
  if (mean > PIXEL_THRESHOLDS.washedOutMean) failures.push('washed_out');
  if (edgeDensity > PIXEL_THRESHOLDS.clutteredEdgeDensity) failures.push('cluttered');

  return {
    meanLuminance: round1(mean),
    luminanceStdDev: round1(stdDev),
    edgeDensity: round1(edgeDensity),
    poemRegionLuminance: round1(poemRegionLuminance),
    failures,
  };
}
