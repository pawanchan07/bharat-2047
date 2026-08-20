'use client';

/**
 * The town reacting to what you did.
 *
 * When a case is filed or an attack is caught, a pulse appears over the place it happened,
 * projected onto the world with the same transform the name plates use, so it sits on the
 * actual building rather than floating in a corner. It fades after a few seconds, because a
 * world covered in permanent badges stops being a world.
 */

import React, { useEffect, useState } from 'react';
import { Viewport } from './WorldLabels';
import { TownEvent, useTownState } from './TownState';

const TILE_WIDTH = 64;
const TILE_HEIGHT = TILE_WIDTH * 0.6;
/** How long a pulse stays up. Long enough to notice on the way out of a building. */
const LIFETIME_MS = 9000;

const TONE: Record<TownEvent['kind'], { ring: string; text: string; glyph: string }> = {
  vote: { ring: 'border-emerald-400/70 bg-emerald-500/20', text: 'text-emerald-200', glyph: '🗳️' },
  case: { ring: 'border-amber-400/70 bg-amber-500/20', text: 'text-amber-100', glyph: '📝' },
  resolved: { ring: 'border-emerald-400/70 bg-emerald-500/25', text: 'text-emerald-200', glyph: '🔧' },
  attack: { ring: 'border-red-400/70 bg-red-500/20', text: 'text-red-100', glyph: '🛡️' },
};

export function TownPulse({ viewport }: { viewport: Viewport | null }) {
  const { events } = useTownState();
  const [now, setNow] = useState(() => Date.now());

  // Only tick while something is actually on screen, so an idle town costs nothing. The
  // clock is read inside the interval rather than during render, which keeps this component
  // pure and lets React re-render it freely.
  const live = events.filter((e) => e.at && now - e.ts < LIFETIME_MS);
  const newest = events.length > 0 ? events[events.length - 1].ts : 0;

  useEffect(() => {
    if (newest === 0) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    const stop = setTimeout(() => clearInterval(id), LIFETIME_MS + 1000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [newest]);

  if (!viewport || live.length === 0) return null;
  const { zoom, offset, canvasSize } = viewport;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {live.map((e) => {
        const at = e.at!;
        const worldX = (at.x - at.y) * (TILE_WIDTH / 2) + TILE_WIDTH / 2;
        const worldY = (at.x + at.y) * (TILE_HEIGHT / 2) + TILE_HEIGHT / 2;
        const left = worldX * zoom + offset.x;
        const top = worldY * zoom + offset.y - 120 * zoom;
        if (left < -200 || left > canvasSize.width + 200 || top < -100 || top > canvasSize.height + 100) return null;

        const age = (now - e.ts) / LIFETIME_MS;
        const tone = TONE[e.kind];

        return (
          <div
            key={e.id}
            className="absolute -translate-x-1/2 -translate-y-full transition-opacity duration-500"
            style={{ left, top, opacity: age > 0.8 ? (1 - age) * 5 : 1 }}
          >
            <div className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur ${tone.ring} ${tone.text}`}>
              <span aria-hidden>{tone.glyph}</span>
              {e.label}
            </div>
            <div className="mx-auto mt-0.5 h-2 w-2 animate-ping rounded-full bg-white/60" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}
