'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { compressToUTF16 } from 'lz-string';
import { GameProvider } from '@/context/GameContext';
import { FutureIndia } from '@/components/india/FutureIndia';
import { BootScreen } from '@/components/india/BootScreen';

const STORAGE_KEY = 'isocity-game-state';

/** The town JSON is a small part of the wait; the world's sprite sheets are the rest. */
const TOWN_SHARE = 0.12;

export default function IndiaPage() {
  const [townReady, setTownReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [booted, setBooted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/example-states/future_india.json');
        if (!res.ok) throw new Error(`town fetch failed: ${res.status}`);
        const state = await res.json();
        // Always load the pristine town so the demo starts identical every time
        localStorage.setItem(STORAGE_KEY, compressToUTF16(JSON.stringify(state)));
        // Bright daytime look for the showcase
        localStorage.setItem('isocity-day-night-mode', 'day');
        if (!cancelled) {
          setProgress(TOWN_SHARE);
          setTownReady(true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Could not load the town. Please reload the page.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Real progress, reported by the renderer as each sprite sheet the town needs lands.
  const handleAssetProgress = useCallback((loaded: number, total: number) => {
    const fraction = total > 0 ? loaded / total : 1;
    setProgress(TOWN_SHARE + fraction * (1 - TOWN_SHARE));
  }, []);

  const handleReady = useCallback(() => {
    setProgress(1);
    setBooted(true);
    // A mark rather than a log: measurable from devtools or a script, silent for visitors.
    try { performance.mark('bharat-2047:town-ready'); } catch { /* no-op */ }
  }, []);

  // Safety net. A loading screen that never lifts is the worst thing this page could do to
  // someone, so if an asset stalls we show the town anyway and let it finish filling in.
  useEffect(() => {
    if (!townReady || booted) return;
    const bail = setTimeout(() => setBooted(true), 12000);
    return () => clearTimeout(bail);
  }, [townReady, booted]);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#0b1020] text-white/60 px-6 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden bg-[#0b1020]">
      {/* The world mounts underneath the boot screen so its assets load while you read it. */}
      {townReady && (
        <GameProvider>
          <FutureIndia
            booted={booted}
            onAssetProgress={handleAssetProgress}
            onReady={handleReady}
          />
        </GameProvider>
      )}
      {!booted && <BootScreen progress={progress} />}
    </div>
  );
}
