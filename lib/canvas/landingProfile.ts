import type { VisualProfile } from '@/types/mood';

/**
 * Landing page ambient VisualProfile — deep twilight with ascending glow particles.
 * Weather-neutral, mysterious yet inviting. The radial gradient creates a vignette
 * that draws the eye toward center. Rising particles evoke hope and anticipation.
 */
export const LANDING_VISUAL_PROFILE: VisualProfile = {
  background: {
    topColor: [12, 10, 38],     // Deep indigo-black
    bottomColor: [28, 18, 52],  // Dark plum
    style: 'radial',
  },
  particles: {
    colors: [
      [120, 90, 180],   // Soft violet
      [80, 140, 200],   // Muted blue
      [180, 120, 160],  // Dusty rose
      [100, 180, 180],  // Teal whisper
    ],
    maxCount: 120,
    spawnRate: 8,
    sizeRange: [2, 8],
    alphaRange: [0.15, 0.5],
    speedRange: [0.3, 1.2],
    direction: 'up',
    lifespan: [5, 12],
    drawStyle: 'glow',
  },
  effects: {
    ripples: { active: false, color: [0, 0, 0], rate: 0 },
    lightning: { active: false, interval: [20, 30] },
    cloudNoise: { active: true, opacity: 0.04, scale: 0.002 },
    glow: { active: true, color: [100, 60, 160], intensity: 0.25 },
  },
  description: 'Landing ambient: deep twilight with ascending glow particles',
};
