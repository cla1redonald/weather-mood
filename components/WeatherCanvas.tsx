'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { WeatherCondition, NormalizedParams } from '@/types/weather';
import { createRenderer, type CanvasRenderer } from '@/lib/canvas';

interface WeatherCanvasProps {
  condition: WeatherCondition | null;
  params: NormalizedParams | null;
}

export default function WeatherCanvas({ condition, params }: WeatherCanvasProps) {
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
      renderer.start({ condition, params });
    } else {
      renderer.update({ condition, params });
    }
  }, [condition, params, initRenderer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
