'use client';

/**
 * The first thing anyone sees. It reports real progress — the bar is driven by sprite
 * sheets actually landing, not by a timer — because a prototype that claims to run real
 * cryptography should not fake its own loading bar.
 */

import React from 'react';
import { Tricolour } from './Tricolour';

const STAGES: { upTo: number; label: string }[] = [
  { upTo: 0.12, label: 'Fetching the town of Rampur' },
  { upTo: 0.55, label: 'Painting streets, fields and rooftops' },
  { upTo: 0.92, label: 'Placing the civic buildings' },
  { upTo: 1.01, label: 'Waking the town' },
];

export function BootScreen({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const stage = STAGES.find((s) => progress < s.upTo) ?? STAGES[STAGES.length - 1];

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0b1020] px-6 text-white">
      <Tricolour className="w-20 h-auto drop-shadow-lg" />

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-wide">
          <span className="text-amber-400">भारत</span> BHARAT <span className="text-emerald-400">2047</span>
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.35em] text-white/35">Future India prototype</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-2 flex items-baseline justify-between text-xs">
          <span className="text-white/50">{stage.label}…</span>
          <span className="font-mono tabular-nums text-amber-300">{pct}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Loading Bharat 2047"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* The gradient is inline because globals.css paints every
              `[role="progressbar"] > div` in the city builder's blue, and that selector
              outranks a utility class. */}
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{
              width: `${Math.max(3, pct)}%`,
              background: 'linear-gradient(90deg, #FF9933 0%, #fcd34d 50%, #138808 100%)',
            }}
          />
        </div>
      </div>

      <p className="max-w-sm text-center text-[11px] leading-relaxed text-white/30">
        Nothing here is a video. The town is a live isometric world and every civic system
        inside it computes for real in your browser.
      </p>
    </div>
  );
}
