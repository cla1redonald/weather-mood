'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { WeatherCondition, NormalizedParams } from '@/types/weather';
import type { VisualProfile } from '@/types/mood';
import { createRenderer, type CanvasRenderer } from '@/lib/canvas';

interface WeatherCanvasProps {
  condition: WeatherCondition | null;
  params: NormalizedParams | null;
  visualProfile?: VisualProfile | null;
  isAudioLoading?: boolean;
  isTransitioning?: boolean;
}

export default function WeatherCanvas({ condition, params, visualProfile, isAudioLoading, isTransitioning }: WeatherCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // Initialize renderer when canvas mounts
  const initRenderer = useCallback(() => {
    if (!canvasRef.current || rendererRef.current) return;
    rendererRef.current = createRenderer(canvasRef.current);
  }, []);

  // Landing state: start renderer with landing profile before any weather data
  useEffect(() => {
    if (condition || params) return;   // Weather data exists, skip landing
    if (!visualProfile) return;        // No landing profile provided

    initRenderer();
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (!renderer.isRunning()) {
      renderer.start({
        condition: 'clear',  // Dummy — ignored when visualProfile is set
        params: { temperature: 0.5, humidity: 0.5, windSpeed: 0, cloudCover: 0 },
        visualProfile,
      });
    }
  }, [visualProfile, condition, params, initRenderer]);

  // Start or update renderer when weather data changes
  useEffect(() => {
    if (!condition || !params) return;

    initRenderer();

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (!renderer.isRunning()) {
      renderer.start({ condition, params, visualProfile: visualProfile ?? null });
    } else {
      renderer.update({ condition, params, visualProfile: visualProfile ?? null });
    }
  }, [condition, params, visualProfile, initRenderer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      />
      {(isAudioLoading || isTransitioning) && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 1,
            animation: 'pulse-overlay 2.5s ease-in-out infinite',
            background: 'radial-gradient(circle at center, rgba(120, 90, 180, 0.08) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
