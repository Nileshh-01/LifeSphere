'use client';

export function LoadingScreen() {
  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm font-mono">Generating planet...</p>
      </div>
    </div>
  );
}
