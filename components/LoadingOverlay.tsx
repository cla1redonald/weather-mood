'use client';

interface LoadingOverlayProps {
  cityName: string | null;
  isVisible: boolean;
}

export default function LoadingOverlay({ cityName, isVisible }: LoadingOverlayProps) {
  if (!isVisible || !cityName) return null;

  return (
    <div className="fixed inset-x-0 top-[30%] z-10 flex justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        {/* Spinner */}
        <div className="w-10 h-10 border-[3px] border-white/15 border-t-white/80 rounded-full animate-spin" />

        {/* City name */}
        <p className="text-white/90 text-xl font-light tracking-wide">
          {cityName}
        </p>

        {/* Status text */}
        <p className="text-white/50 text-sm tracking-widest uppercase">
          Creating your experience
        </p>
      </div>
    </div>
  );
}
