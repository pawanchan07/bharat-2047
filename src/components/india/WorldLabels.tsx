'use client';

/**
 * Floating name plates for the town's landmarks.
 *
 * The world is drawn on a canvas, so these labels live in HTML above it and are projected
 * by hand: grid → world → screen, using the same transform the renderer uses
 * (screen = world × zoom + offset). They therefore track panning and zooming exactly.
 */

import React from 'react';

// Must match the engine's isometric tile geometry (src/components/game/types.ts).
const TILE_WIDTH = 64;
const TILE_HEIGHT = TILE_WIDTH * 0.6;

export interface Viewport {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
}

export interface WorldLabel {
  id: string;
  name: string;
  icon: string;
  /** grid footprint */
  x: number; y: number; w: number; h: number;
  live: boolean;
}

/** Centre of a grid tile in world pixels, before the camera transform. */
function tileCentre(gx: number, gy: number) {
  return {
    x: (gx - gy) * (TILE_WIDTH / 2) + TILE_WIDTH / 2,
    y: (gx + gy) * (TILE_HEIGHT / 2) + TILE_HEIGHT / 2,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function WorldLabels({
  labels, viewport, activeId, onSelect,
}: {
  labels: WorldLabel[];
  viewport: Viewport | null;
  activeId?: string | null;
  onSelect: (id: string) => void;
}) {
  if (!viewport) return null;
  const { zoom, offset, canvasSize } = viewport;

  // Plates stay legible rather than growing with the world, but still shrink a little when
  // you pull back so a wide shot of the town does not turn into a wall of text.
  const scale = clamp(0.55 + zoom * 0.45, 0.6, 1.1);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {labels.map((l) => {
        // Planned systems drop away first — pulled back, only the working ones are named,
        // which is also the honest hierarchy: three of these you can actually walk into.
        const fadeIn = l.live ? 0.42 : 0.86;
        const opacity = clamp((zoom - fadeIn) / 0.22, 0, 1) * (l.live ? 1 : 0.5);
        if (opacity <= 0.02) return null;

        const centre = tileCentre(l.x + (l.w - 1) / 2, l.y + (l.h - 1) / 2);
        // Lift the plate clear of the roof: a taller footprint carries a taller building.
        const lift = (38 + 36 * Math.max(l.w, l.h)) * zoom;
        // The plate is anchored on the tile itself and grows upward, so the stem always
        // lands on the roof no matter how far the camera is pushed in or out.
        const left = centre.x * zoom + offset.x;
        const top = centre.y * zoom + offset.y;

        // Cull anything the camera cannot see.
        if (left < -220 || left > canvasSize.width + 220 || top < -160 || top > canvasSize.height + 220) {
          return null;
        }

        const isActive = activeId === l.id;
        // Planned systems get a quieter chip so the eye lands on what actually works.
        const plateScale = scale * (l.live ? 1 : 0.82);
        return (
          <div
            key={l.id}
            className="absolute pointer-events-none flex flex-col items-center"
            style={{ left, top, opacity, transform: `translate(-50%, -100%) scale(${plateScale})`, transformOrigin: 'bottom center' }}
          >
            <button
              onClick={() => onSelect(l.id)}
              className={`pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold shadow-lg backdrop-blur transition-colors
                ${isActive
                  ? 'bg-amber-400 border-amber-300 text-black shadow-amber-500/30'
                  : l.live
                    ? 'bg-[#0b1020]/90 border-amber-400/50 text-white hover:bg-amber-400 hover:text-black hover:border-amber-300'
                    : 'bg-[#0b1020]/60 border-white/15 text-white/70 hover:text-white hover:border-white/40'}`}
            >
              <span aria-hidden>{l.icon}</span>
              <span>{l.name}</span>
              {l.live && !isActive && (
                <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            {/* Stem down to the rooftop, so a plate is never ambiguous about which building it names. */}
            <div
              className={`w-px ${l.live ? 'bg-amber-400/60' : 'bg-white/25'}`}
              style={{ height: Math.max(6, lift / plateScale - 5) }}
            />
            <div className={`h-[5px] w-[5px] -mt-[2px] rotate-45 ${l.live ? 'bg-amber-400/80' : 'bg-white/35'}`} />
          </div>
        );
      })}
    </div>
  );
}
