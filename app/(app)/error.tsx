'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-8 text-center">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md w-full">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-[#1C2B3A] mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-1">
          {error.message || 'An unexpected error occurred on this page.'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">Ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="flex items-center gap-2 mx-auto mt-4 px-5 py-2.5 bg-[#F5C000] text-[#1C2B3A] font-semibold rounded-md hover:bg-[#D4A800] transition-colors text-sm"
        >
          <RefreshCw size={15} />
          Try again
        </button>
      </div>
    </div>
  );
}
