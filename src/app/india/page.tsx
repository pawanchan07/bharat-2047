'use client';

import React, { useEffect, useState } from 'react';
import { compressToUTF16 } from 'lz-string';
import { GameProvider } from '@/context/GameContext';
import { FutureIndia } from '@/components/india/FutureIndia';

const STORAGE_KEY = 'isocity-game-state';

export default function IndiaPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/example-states/future_india.json');
        const state = await res.json();
        // Always load the pristine town so the demo starts identical every time
        localStorage.setItem(STORAGE_KEY, compressToUTF16(JSON.stringify(state)));
        // Bright daytime look for the showcase
        localStorage.setItem('isocity-day-night-mode', 'day');
        if (!cancelled) setReady(true);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Could not load the town.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className="w-full h-screen flex items-center justify-center bg-[#0b1020] text-white/60">{error}</div>;
  }

  if (!ready) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-[#0b1020] text-white gap-3">
        <div className="text-5xl animate-bounce">🇮🇳</div>
        <div className="text-white/50 text-sm tracking-widest">LOADING BHARAT 2047…</div>
      </div>
    );
  }

  return (
    <GameProvider>
      <FutureIndia />
    </GameProvider>
  );
}
