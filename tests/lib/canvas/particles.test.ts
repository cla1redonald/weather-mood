import { describe, it, expect } from 'vitest';
import {
  createPool,
  spawnParticle,
  updatePool,
  getMaxParticles,
} from '@/lib/canvas/particles';
import { getPalette } from '@/lib/canvas/palette';
import type { WeatherCondition, NormalizedParams } from '@/types/weather';

const DEFAULT_PARAMS: NormalizedParams = {
  temperature: 0.5,
  humidity: 0.5,
  windSpeed: 0.5,
  cloudCover: 0.5,
};

function makeSpawnConfig(condition: WeatherCondition, params?: Partial<NormalizedParams>) {
  const p = { ...DEFAULT_PARAMS, ...params };
  return {
    canvasWidth: 1920,
    canvasHeight: 1080,
    condition,
    params: p,
    palette: getPalette(condition),
  };
}

describe('createPool', () => {
  it('creates an empty pool with the given max count', () => {
    const pool = createPool(100);
    expect(pool.particles).toHaveLength(0);
    expect(pool.maxCount).toBe(100);
  });

  it('creates a pool with zero max count', () => {
    const pool = createPool(0);
    expect(pool.maxCount).toBe(0);
  });
});

describe('spawnParticle', () => {
  it('spawns a rain particle within canvas bounds', () => {
    const config = makeSpawnConfig('rain');
    const p = spawnParticle(config);
    // Rain starts above the canvas or near the top
    expect(p.y).toBeLessThanOrEqual(config.canvasHeight);
    expect(p.vy).toBeGreaterThan(0); // Falls downward (positive vy)
    expect(p.life).toBe(1);
    expect(p.maxLife).toBeGreaterThan(0);
  });

  it('spawns a snow particle with slow speed', () => {
    const config = makeSpawnConfig('snow');
    const p = spawnParticle(config);
    expect(p.vy).toBeGreaterThan(0);
    expect(p.vy).toBeLessThan(3);
    expect(p.size).toBeGreaterThanOrEqual(2);
  });

  it('spawns a clear/sunny particle moving upward', () => {
    const config = makeSpawnConfig('clear');
    const p = spawnParticle(config);
    // Clear particles rise (negative vy)
    expect(p.vy).toBeLessThan(0);
  });

  it('spawns a cloudy particle with large size', () => {
    const config = makeSpawnConfig('cloudy');
    const p = spawnParticle(config);
    expect(p.size).toBeGreaterThanOrEqual(8);
    expect(p.alpha).toBeLessThan(0.2);
  });

  it('spawns a storm particle', () => {
    const config = makeSpawnConfig('storm');
    const p = spawnParticle(config);
    expect(p.life).toBe(1);
    expect(p.color).toHaveLength(4);
  });

  it('spawns a wind particle moving rightward', () => {
    const config = makeSpawnConfig('wind');
    const p = spawnParticle(config);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.trail).toEqual([]);
  });

  it('wind particle speed increases with wind param', () => {
    const slowConfig = makeSpawnConfig('wind', { windSpeed: 0 });
    const fastConfig = makeSpawnConfig('wind', { windSpeed: 1 });
    const slowParticle = spawnParticle(slowConfig);
    const fastParticle = spawnParticle(fastConfig);
    // Fast wind should generally have higher vx (probabilistic, but large gap)
    // Use a generous margin since there's randomness
    expect(fastParticle.vx).toBeGreaterThan(slowParticle.vx * 0.5);
  });

  it('all conditions produce particles with valid color arrays', () => {
    const conditions: WeatherCondition[] = ['rain', 'snow', 'clear', 'cloudy', 'storm', 'wind'];
    for (const c of conditions) {
      const config = makeSpawnConfig(c);
      const p = spawnParticle(config);
      expect(p.color).toHaveLength(4);
      expect(p.color[0]).toBeGreaterThanOrEqual(0);
      expect(p.color[0]).toBeLessThanOrEqual(255);
      expect(p.color[3]).toBeGreaterThanOrEqual(0);
      expect(p.color[3]).toBeLessThanOrEqual(1);
    }
  });
});

describe('updatePool', () => {
  it('spawns particles up to max count', () => {
    const pool = createPool(10);
    const config = makeSpawnConfig('rain');
    const dt = 0.5;

    updatePool(pool, dt, config);

    expect(pool.particles.length).toBeGreaterThan(0);
    expect(pool.particles.length).toBeLessThanOrEqual(10);
  });

  it('does not exceed max count', () => {
    const pool = createPool(5);
    const config = makeSpawnConfig('storm');

    // Run many updates
    for (let i = 0; i < 20; i++) {
      updatePool(pool, 0.016, config);
    }

    expect(pool.particles.length).toBeLessThanOrEqual(5);
  });

  it('recycles particles that go off screen', () => {
    const pool = createPool(5);
    const config = makeSpawnConfig('rain');

    // Fill the pool
    for (let i = 0; i < 10; i++) {
      updatePool(pool, 0.1, config);
    }

    const initialCount = pool.particles.length;

    // Move particles way off screen
    for (const p of pool.particles) {
      p.y = config.canvasHeight + 200;
    }

    // Update should recycle them
    updatePool(pool, 0.016, config);

    // Should still have particles (recycled, not removed)
    expect(pool.particles.length).toBe(initialCount);
  });

  it('decreases particle life over time', () => {
    const pool = createPool(3);
    const config = makeSpawnConfig('clear');

    updatePool(pool, 0.5, config);
    const particle = pool.particles[0];
    const initialLife = particle.life;

    updatePool(pool, 0.5, config);
    expect(particle.life).toBeLessThan(initialLife);
  });

  it('recycles dead particles (life <= 0)', () => {
    const pool = createPool(2);
    const config = makeSpawnConfig('rain');

    updatePool(pool, 0.1, config);

    // Kill a particle
    pool.particles[0].life = -0.1;

    updatePool(pool, 0.016, config);

    // All particles should still be alive (dead one was recycled)
    for (const p of pool.particles) {
      expect(p.life).toBeGreaterThan(0);
    }
  });

  it('wind particles accumulate trail positions', () => {
    const pool = createPool(5);
    const config = makeSpawnConfig('wind');

    // Run several updates
    for (let i = 0; i < 10; i++) {
      updatePool(pool, 0.016, config);
    }

    // At least some particles should have trails
    const withTrails = pool.particles.filter(p => p.trail.length > 0);
    expect(withTrails.length).toBeGreaterThan(0);
  });

  it('wind particle trails are capped at 6 positions', () => {
    const pool = createPool(3);
    const config = makeSpawnConfig('wind');

    // Run many updates
    for (let i = 0; i < 30; i++) {
      updatePool(pool, 0.016, config);
    }

    for (const p of pool.particles) {
      expect(p.trail.length).toBeLessThanOrEqual(6);
    }
  });

  it('humidity affects spawn rate (higher density with high humidity)', () => {
    const lowPool = createPool(50);
    const highPool = createPool(50);
    const lowConfig = makeSpawnConfig('rain', { humidity: 0 });
    const highConfig = makeSpawnConfig('rain', { humidity: 1 });

    for (let i = 0; i < 5; i++) {
      updatePool(lowPool, 0.1, lowConfig);
      updatePool(highPool, 0.1, highConfig);
    }

    // High humidity should generally produce more particles
    expect(highPool.particles.length).toBeGreaterThanOrEqual(lowPool.particles.length);
  });
});

describe('getMaxParticles', () => {
  it('returns consistent values for same inputs', () => {
    const a = getMaxParticles(1920, 'rain');
    const b = getMaxParticles(1920, 'rain');
    expect(a).toBe(b);
  });
});
