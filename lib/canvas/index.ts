export { createRenderer } from './renderer';
export type { CanvasRenderer, RendererConfig } from './renderer';
export { getPalette, lerpColor, rgbaToString, temperatureShift, buildBackgroundGradient, randomParticleColor, profileToPalette } from './palette';
export type { RGBA, WeatherPalette } from './palette';
export { createPool, updatePool, drawPool, getMaxParticles, spawnParticle, updatePoolWithProfile, drawPoolWithProfile, spawnProfileParticle } from './particles';
export type { Particle, ParticlePool, ProfileSpawnConfig } from './particles';
export { drawBackground, drawForeground, resetModeState, createProfileMode, drawProfileBackground, drawProfileForeground } from './modes';
export type { ProfileModeConfig } from './modes';
