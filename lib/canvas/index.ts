export { createRenderer } from './renderer';
export type { CanvasRenderer, RendererConfig } from './renderer';
export { getPalette, lerpColor, rgbaToString, temperatureShift, buildBackgroundGradient, randomParticleColor } from './palette';
export type { RGBA, WeatherPalette } from './palette';
export { createPool, updatePool, drawPool, getMaxParticles, spawnParticle } from './particles';
export type { Particle, ParticlePool } from './particles';
export { drawBackground, drawForeground, resetModeState } from './modes';
