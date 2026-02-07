/**
 * Noise buffer generators — pure functions, no Web Audio dependencies.
 * Used by the precipitation layer to create colored noise buffers.
 */

/** Fill a Float32Array with white noise (uniform random [-1, 1]) */
export function fillWhiteNoise(data: Float32Array): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

/**
 * Fill a Float32Array with pink noise using the Voss-McCartney algorithm.
 * Uses 8 octaves of white noise summed at different update rates.
 */
export function fillPinkNoise(data: Float32Array): void {
  const numOctaves = 8;
  const octaves = new Float32Array(numOctaves);
  let runningSum = 0;

  // Initialize octaves
  for (let o = 0; o < numOctaves; o++) {
    octaves[o] = Math.random() * 2 - 1;
    runningSum += octaves[o];
  }

  for (let i = 0; i < data.length; i++) {
    // For each octave, update at rate 1/2^octave
    for (let o = 0; o < numOctaves; o++) {
      // Update this octave when the lower bits are all zero
      if (i % (1 << o) === 0) {
        runningSum -= octaves[o];
        octaves[o] = Math.random() * 2 - 1;
        runningSum += octaves[o];
      }
    }
    // Normalize: sum of 8 values in [-1,1] ranges [-8,8], scale to ~[-1,1]
    data[i] = runningSum / numOctaves;
  }
}

/**
 * Fill a Float32Array with brown noise using a leaky integrator.
 * Each sample: (last + 0.02 * white) / 1.02, then normalized * 3.5
 */
export function fillBrownNoise(data: Float32Array): void {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
}
