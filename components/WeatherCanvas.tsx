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
}

export default function WeatherCanvas({ condition, params, visualProfile, isAudioLoading }: WeatherCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // Initialize renderer when canvas mounts
  const initRenderer = useCallback(() => {
    if (!canvasRef.current || rendererRef.current) return;
    rendererRef.current = createRenderer(canvasRef.current);
  }, []);

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
      {isAudioLoading && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 1,
            animation: 'pulse-overlay 2s ease-in-out infinite',
            background: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
