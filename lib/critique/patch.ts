/**
 * Apply the critic's flat patch to a full VisualProfile. Every result goes
 * back through clampVisualProfile, so a patch can never push a value out of
 * the renderer's safe range.
 */
import { clampVisualProfile, type RGB, type VisualProfile } from '@/types/mood';
import type { ProfilePatch } from '@/lib/critique/schema';
import type { PixelFailure, PixelReport } from '@/lib/critique/pixels';

type Mutable = {
  background: Record<string, unknown>;
  particles: Record<string, unknown>;
  effects: Record<string, Record<string, unknown>>;
  description: string;
};

/** Keys of the patch that carry a value. */
export function changedFields(patch: ProfilePatch): string[] {
  return Object.entries(patch)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key]) => key);
}

export function applyPatch(profile: VisualProfile, patch: ProfilePatch): VisualProfile {
  const next = structuredClone(profile) as unknown as Mutable;
  const set = <T>(value: T | undefined, write: (v: T) => void) => {
    if (value !== undefined && value !== null) write(value);
  };

  set(patch.topColor, (v) => { next.background.topColor = v; });
  set(patch.bottomColor, (v) => { next.background.bottomColor = v; });
  set(patch.gradientStyle, (v) => { next.background.style = v; });
  set(patch.particleColors, (v) => { next.particles.colors = v; });
  set(patch.particleCount, (v) => { next.particles.maxCount = v; });
  set(patch.spawnRate, (v) => { next.particles.spawnRate = v; });
  set(patch.particleSize, (v) => { next.particles.sizeRange = v; });
  set(patch.particleAlpha, (v) => { next.particles.alphaRange = v; });
  set(patch.particleSpeed, (v) => { next.particles.speedRange = v; });
  set(patch.direction, (v) => { next.particles.direction = v; });
  set(patch.drawStyle, (v) => { next.particles.drawStyle = v; });
  set(patch.glowActive, (v) => { next.effects.glow.active = v; });
  set(patch.glowColor, (v) => { next.effects.glow.color = v; });
  set(patch.glowIntensity, (v) => { next.effects.glow.intensity = v; });
  set(patch.cloudNoiseActive, (v) => { next.effects.cloudNoise.active = v; });
  set(patch.cloudNoiseOpacity, (v) => { next.effects.cloudNoise.opacity = v; });
  set(patch.ripplesActive, (v) => { next.effects.ripples.active = v; });
  set(patch.lightningActive, (v) => { next.effects.lightning.active = v; });

  return clampVisualProfile(next as unknown as Partial<VisualProfile>);
}

function scaleColour(rgb: RGB, factor: number, floor = 0): RGB {
  return rgb.map((c) => Math.max(floor, Math.min(255, Math.round(c * factor)))) as RGB;
}

function lift(rgb: RGB, minimum: number): RGB {
  return rgb.map((c) => Math.max(c, minimum)) as RGB;
}

/**
 * A minimal fix for each pixel failure, used only to fill fields the model's
 * patch left alone. It makes a forced revise change something visible even
 * when the model saw nothing wrong.
 */
export function pixelFixPatch(report: PixelReport, profile: VisualProfile): ProfilePatch {
  const failures = new Set<PixelFailure>(report.failures);
  const patch: ProfilePatch = {};
  const { background, particles } = profile;

  if (failures.has('too_dark') || failures.has('blank')) {
    patch.topColor = lift(scaleColour(background.topColor, 1.6), 40);
    patch.bottomColor = lift(scaleColour(background.bottomColor, 1.6), 70);
    patch.particleAlpha = [Math.max(particles.alphaRange[0], 0.35), Math.max(particles.alphaRange[1], 0.8)];
    patch.particleCount = Math.max(particles.maxCount, 150);
  }
  if (failures.has('washed_out')) {
    patch.topColor = scaleColour(background.topColor, 0.7);
    patch.bottomColor = scaleColour(background.bottomColor, 0.78);
  }
  if (failures.has('cluttered')) {
    patch.particleCount = Math.round(particles.maxCount * 0.55);
    patch.spawnRate = Math.round(particles.spawnRate * 0.55);
  }
  return patch;
}

/** The model's patch wins wherever it set a field; pixel fixes fill the rest. */
export function mergePatches(fromModel: ProfilePatch, fromPixels: ProfilePatch): ProfilePatch {
  const merged: ProfilePatch = { ...fromPixels };
  for (const key of changedFields(fromModel) as Array<keyof ProfilePatch>) {
    (merged as Record<string, unknown>)[key] = fromModel[key];
  }
  return merged;
}
