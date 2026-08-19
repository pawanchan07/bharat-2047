'use client';

/**
 * The scene that opens a citizen's journey — shared by the voting centre and the panchayat.
 *
 * A citizen has to be *seen* walking to the door, otherwise the first screen of a system
 * reads as a placeholder. Everything here is drawn — SVG figures and buildings, CSS gait —
 * rather than typed as emoji, so it renders identically on every machine and can actually
 * be animated.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type WalkPhase = 'waiting' | 'walking' | 'arrived';

const WALK_MS = 2600;
const DOOR_PAUSE_MS = 650;

/** One palette per voter on the roll, so each journey is visibly a different person. */
export const CITIZEN_PALETTES = [
  { cloth: '#d9603f', trim: '#f2b25c', hair: '#17151c' },
  { cloth: '#3f7fbf', trim: '#a8d0f0', hair: '#1a1712' },
  { cloth: '#2f9e77', trim: '#a8e6cd', hair: '#221a24' },
  { cloth: '#a5548f', trim: '#e9b6dc', hair: '#161318' },
  { cloth: '#c9a227', trim: '#f6e0a0', hair: '#3a3a40' },
  { cloth: '#5b5fbf', trim: '#b5b7ef', hair: '#1c1a18' },
];

export const paletteFor = (index: number) => CITIZEN_PALETTES[index % CITIZEN_PALETTES.length];

/** The figure itself, drawn so the legs can actually swing. Rendered inside a caller's <svg>. */
function CitizenFigure({ walking, palette }: { walking: boolean; palette: { cloth: string; trim: string; hair: string } }) {
  return (
    <>
      <g className={walking ? 'vs-bob' : 'vs-idle'}>
        {/* back leg */}
        <g className={walking ? 'vs-leg-back' : ''} style={{ transformOrigin: '22px 50px' }}>
          <rect x="17" y="48" width="7" height="22" rx="3" fill="#2f3b57" />
          <rect x="15" y="68" width="11" height="5" rx="2.5" fill="#111827" />
        </g>
        {/* back arm */}
        <g className={walking ? 'vs-arm-back' : ''} style={{ transformOrigin: '16px 30px' }}>
          <rect x="12" y="28" width="6" height="19" rx="3" fill={palette.trim} />
          <circle cx="15" cy="48" r="3.2" fill="#c98a63" />
        </g>

        {/* body — kurta and dupatta */}
        <path d="M13 28 q9 -5 18 0 l4 24 q-11 5 -26 0 z" fill={palette.cloth} />
        <path d="M15 30 q9 6 15 1 l1.6 6 q-8 5 -17 -1 z" fill={palette.trim} opacity="0.9" />
        {/* neck + head */}
        <rect x="19" y="20" width="6" height="6" rx="2" fill="#c98a63" />
        <circle cx="22" cy="14" r="8" fill="#d69a72" />
        <path d="M14 13 a8 8 0 0 1 16 0 q-8 -6 -16 0 z" fill={palette.hair} />
        <circle cx="31" cy="13" r="3.4" fill={palette.hair} />

        {/* front leg */}
        <g className={walking ? 'vs-leg-front' : ''} style={{ transformOrigin: '22px 50px' }}>
          <rect x="21" y="48" width="7" height="22" rx="3" fill="#3a4767" />
          <rect x="19" y="68" width="11" height="5" rx="2.5" fill="#1f2937" />
        </g>
        {/* front arm */}
        <g className={walking ? 'vs-arm-front' : ''} style={{ transformOrigin: '28px 30px' }}>
          <rect x="26" y="28" width="6" height="19" rx="3" fill={palette.cloth} />
          <circle cx="29" cy="48" r="3.2" fill="#d69a72" />
        </g>
      </g>
    </>
  );
}

/** A villager sized to fill its box. */
function Citizen({ walking, palette }: { walking: boolean; palette: { cloth: string; trim: string; hair: string } }) {
  return (
    <svg viewBox="0 0 44 78" className="w-full h-full overflow-visible" aria-hidden>
      <CitizenFigure walking={walking} palette={palette} />
    </svg>
  );
}

/** A villager already in the queue — same construction, standing still, pushed back in the haze. */
function QueueFigure({ left, cloth, trim, hair, scale }: { left: string; cloth: string; trim: string; hair: string; scale: number }) {
  return (
    <div
      className="absolute bottom-[15%]"
      style={{ left, height: `${34 * scale}%`, aspectRatio: '44 / 78', opacity: 0.55, filter: 'saturate(0.7)' }}
    >
      <Citizen walking={false} palette={{ cloth, trim, hair }} />
    </div>
  );
}

/** The polling station itself: a small-town civic building with the flag up. */
function PollingStation({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 220 170" className="w-full h-full overflow-visible" aria-hidden>
      {/* flagpole and tricolour */}
      <rect x="27" y="8" width="2.5" height="60" fill="#8a93a8" />
      <g>
        <rect x="29.5" y="10" width="30" height="6" fill="#FF9933" />
        <rect x="29.5" y="16" width="30" height="6" fill="#ffffff" />
        <rect x="29.5" y="22" width="30" height="6" fill="#138808" />
        <circle cx="44.5" cy="19" r="2.4" fill="none" stroke="#000088" strokeWidth="0.7" />
      </g>

      {/* body of the building */}
      <rect x="18" y="66" width="184" height="86" rx="3" fill="#e8ddc8" />
      <rect x="18" y="66" width="184" height="86" rx="3" fill="url(#vs-wall)" />
      {/* roof */}
      <path d="M10 66 L110 34 L210 66 Z" fill="#b45c3c" />
      <path d="M10 66 L110 34 L210 66 Z" fill="#000" opacity="0.12" />
      <rect x="6" y="64" width="208" height="6" rx="2" fill="#94472e" />

      {/* columns */}
      {[34, 62, 158, 186].map((x) => (
        <g key={x}>
          <rect x={x} y="78" width="10" height="62" fill="#f4ecdb" />
          <rect x={x - 2} y="74" width="14" height="5" rx="1.5" fill="#dcd0b6" />
          <rect x={x - 2} y="139" width="14" height="5" rx="1.5" fill="#dcd0b6" />
        </g>
      ))}

      {/* windows */}
      <rect x="82" y="80" width="18" height="22" rx="2" fill="#2b3f63" opacity="0.75" />
      <rect x="120" y="80" width="18" height="22" rx="2" fill="#2b3f63" opacity="0.75" />

      {/* doorway — glows once the citizen reaches it */}
      <rect x="90" y="104" width="40" height="48" rx="3" fill={lit ? '#f8d99a' : '#243354'} className={lit ? 'vs-door-lit' : ''} />
      <rect x="90" y="104" width="40" height="48" rx="3" fill="none" stroke="#a98d63" strokeWidth="2" />
      <circle cx="122" cy="130" r="1.8" fill="#6b5433" />

      {/* banner over the door */}
      <rect x="66" y="56" width="88" height="16" rx="2" fill="#0f2a1c" stroke="#2f6b48" strokeWidth="1" />
      <text x="110" y="67.5" textAnchor="middle" fontSize="9" fill="#7fe3ab" fontFamily="var(--font-sans), system-ui, sans-serif" letterSpacing="0.5">
        मतदान केंद्र
      </text>

      {/* steps */}
      <rect x="78" y="152" width="64" height="5" rx="1" fill="#cfc3ab" />
      <rect x="72" y="157" width="76" height="5" rx="1" fill="#bfb29a" />
      <rect x="66" y="162" width="88" height="5" rx="1" fill="#aa9d86" />

      <defs>
        <linearGradient id="vs-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The same person, standing still, framed head-and-shoulders for the biometric scan. */
export function CitizenPortrait({ paletteIndex, className = '' }: { paletteIndex: number; className?: string }) {
  return (
    <svg viewBox="7 3 30 42" className={className} aria-hidden>
      <CitizenFigure walking={false} palette={paletteFor(paletteIndex)} />
    </svg>
  );
}

/** The gram panchayat office: lower, greener, with the notice board every village has. */
function PanchayatBhawan({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 220 170" className="w-full h-full overflow-visible" aria-hidden>
      <rect x="27" y="14" width="2.5" height="54" fill="#8a93a8" />
      <g>
        <rect x="29.5" y="16" width="28" height="5.5" fill="#FF9933" />
        <rect x="29.5" y="21.5" width="28" height="5.5" fill="#ffffff" />
        <rect x="29.5" y="27" width="28" height="5.5" fill="#138808" />
      </g>

      {/* single-storey block with a deep verandah */}
      <rect x="22" y="74" width="176" height="78" rx="3" fill="#dfe6d5" />
      <rect x="22" y="74" width="176" height="78" rx="3" fill="url(#vs-wall)" />
      <path d="M14 74 L110 46 L206 74 Z" fill="#3f7a54" />
      <path d="M14 74 L110 46 L206 74 Z" fill="#000" opacity="0.12" />
      <rect x="10" y="72" width="200" height="6" rx="2" fill="#2f5c40" />

      {[38, 66, 154, 182].map((x) => (
        <rect key={x} x={x} y="84" width="8" height="58" fill="#eef2e8" />
      ))}
      <rect x="86" y="84" width="16" height="20" rx="2" fill="#2b3f63" opacity="0.7" />
      <rect x="124" y="84" width="16" height="20" rx="2" fill="#2b3f63" opacity="0.7" />

      <rect x="94" y="106" width="36" height="46" rx="3" fill={lit ? '#f8d99a' : '#243354'} className={lit ? 'vs-door-lit' : ''} />
      <rect x="94" y="106" width="36" height="46" rx="3" fill="none" stroke="#7f9a86" strokeWidth="2" />

      {/* notice board on the wall */}
      <rect x="146" y="104" width="34" height="26" rx="2" fill="#26402f" stroke="#4f8c67" strokeWidth="1.2" />
      {[109, 114, 119, 124].map((y) => (
        <rect key={y} x="150" y={y} width={y % 10 === 9 ? 20 : 26} height="2" rx="1" fill="#8fd0a8" opacity="0.6" />
      ))}

      <rect x="66" y="62" width="88" height="15" rx="2" fill="#0f2a1c" stroke="#2f6b48" strokeWidth="1" />
      <text x="110" y="73" textAnchor="middle" fontSize="8.5" fill="#7fe3ab" fontFamily="var(--font-sans), system-ui, sans-serif">
        ग्राम पंचायत
      </text>

      <rect x="82" y="152" width="60" height="5" rx="1" fill="#d3dbca" />
      <rect x="76" y="157" width="72" height="5" rx="1" fill="#c2cab9" />
      <rect x="70" y="162" width="84" height="5" rx="1" fill="#aeb6a5" />

      <defs>
        <linearGradient id="vs-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ArrivalScene({
  phase: phaseProp = 'waiting', citizenName, paletteIndex = 0,
  variant = 'polling', caption, arrivedLabel = 'At the booth entrance', autoPlay = false,
}: {
  phase?: WalkPhase;
  citizenName: string;
  paletteIndex?: number;
  variant?: 'polling' | 'panchayat';
  /** Overrides the default "walking to the …" strapline. */
  caption?: string;
  arrivedLabel?: string;
  /** Play the walk once on mount, for journeys with no separate "set off" button. */
  autoPlay?: boolean;
}) {
  // An auto-playing scene owns its own little state machine; a driven one takes the phase
  // from its parent so the step change can wait for the citizen to actually get there.
  const [autoPhase, setAutoPhase] = useState<WalkPhase>('walking');
  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(() => setAutoPhase('arrived'), WALK_MS);
    return () => clearTimeout(t);
  }, [autoPlay]);

  const phase = autoPlay ? autoPhase : phaseProp;
  const walking = phase === 'walking';
  const arrived = phase === 'arrived';

  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1428]">
      <style>{`
        @keyframes vs-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }
        @keyframes vs-sway { 0%,100% { transform: rotate(-0.8deg) } 50% { transform: rotate(0.8deg) } }
        @keyframes vs-swing-a { 0%,100% { transform: rotate(21deg) } 50% { transform: rotate(-21deg) } }
        @keyframes vs-swing-b { 0%,100% { transform: rotate(-21deg) } 50% { transform: rotate(21deg) } }
        @keyframes vs-swing-c { 0%,100% { transform: rotate(-15deg) } 50% { transform: rotate(15deg) } }
        @keyframes vs-swing-d { 0%,100% { transform: rotate(15deg) } 50% { transform: rotate(-15deg) } }
        @keyframes vs-walk-across { from { left: 4% } to { left: 55% } }
        @keyframes vs-shadow-across { from { left: 4% } to { left: 55% } }
        @keyframes vs-doorglow { 0%,100% { opacity: .82 } 50% { opacity: 1 } }
        .vs-bob { animation: vs-bob .46s ease-in-out infinite; }
        .vs-idle { animation: vs-sway 3.4s ease-in-out infinite; transform-origin: 22px 70px; }
        .vs-leg-front { animation: vs-swing-a .46s ease-in-out infinite; }
        .vs-leg-back  { animation: vs-swing-b .46s ease-in-out infinite; }
        .vs-arm-front { animation: vs-swing-d .46s ease-in-out infinite; }
        .vs-arm-back  { animation: vs-swing-c .46s ease-in-out infinite; }
        .vs-door-lit  { animation: vs-doorglow 1.6s ease-in-out infinite; }
        .vs-walker    { animation: vs-walk-across ${WALK_MS}ms cubic-bezier(.35,0,.5,1) forwards; }
        .vs-walker-shadow { animation: vs-shadow-across ${WALK_MS}ms cubic-bezier(.35,0,.5,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .vs-bob, .vs-idle, .vs-leg-front, .vs-leg-back, .vs-arm-front, .vs-arm-back, .vs-door-lit { animation: none; }
          .vs-walker, .vs-walker-shadow { animation-duration: 1ms; }
        }
      `}</style>

      {/* sky */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(#0d1630 0%, #1b2950 46%, #3b4a79 78%, #6b5f7e 100%)' }} />
      {/* early sun */}
      <div className="absolute left-[21%] top-[43%] h-14 w-14 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,196,120,.95) 0%, rgba(255,160,80,.35) 45%, rgba(255,150,70,0) 70%)' }} />

      {/* distant treeline */}
      <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[26%] h-12 w-full" aria-hidden>
        <path
          d="M0 60 L0 40 q12 -14 24 -2 q10 -18 22 -4 q14 -16 26 0 q10 -12 20 2 q16 -18 30 -1 q12 -14 24 1 q14 -16 28 0 q12 -10 22 3 q14 -16 28 -2 q12 -12 24 2 q14 -14 26 1 q10 -8 20 3 q12 -12 24 0 q10 -8 18 2 L400 60 Z"
          fill="#0a1128" opacity="0.9"
        />
      </svg>

      {/* ground */}
      <div className="absolute inset-x-0 bottom-0 h-[26%]" style={{ background: 'linear-gradient(#233055, #161d38)' }} />
      <div className="absolute inset-x-0 bottom-[24%] h-px bg-white/10" />
      {/* paving joints along the footpath */}
      <div className="absolute inset-x-0 bottom-[8%] flex justify-between px-2 opacity-25">
        {Array.from({ length: 26 }).map((_, i) => (
          <div key={i} className="h-6 w-px bg-white/40" />
        ))}
      </div>

      {/* the destination */}
      <div className="absolute bottom-[18%] right-[4%] h-[74%] aspect-[220/170]">
        {variant === 'panchayat'
          ? <PanchayatBhawan lit={walking || arrived} />
          : <PollingStation lit={walking || arrived} />}
      </div>

      {/* two villagers already waiting */}
      <QueueFigure left="63%" cloth="#4b6ea8" trim="#8fb6e8" hair="#1b1b22" scale={0.82} />
      <QueueFigure left="68.5%" cloth="#7a4a6b" trim="#c78fb5" hair="#241a1a" scale={0.76} />

      {/* our citizen: idle at the kerb, then walking to the door */}
      <div
        className={`absolute bottom-[9%] h-[42%] ${walking || arrived ? 'vs-walker' : ''}`}
        style={{ left: '4%', aspectRatio: '44 / 78' }}
      >
        <Citizen walking={walking} palette={paletteFor(paletteIndex)} />
      </div>
      <div
        className={`absolute bottom-[8%] h-2 w-10 -translate-x-1 rounded-[50%] bg-black/40 blur-[3px] ${walking || arrived ? 'vs-walker-shadow' : ''}`}
        style={{ left: '4%' }}
      />

      {/* who this is, and where they are going */}
      <div className="absolute left-4 top-3 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] text-white/70 backdrop-blur">
        {citizenName} · {caption ?? (variant === 'panchayat' ? 'walking to the panchayat bhawan' : 'walking to the polling booth')}
      </div>
      {arrived && (
        <div className="absolute right-4 top-3 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur">
          {arrivedLabel}
        </div>
      )}
    </div>
  );
}

/**
 * Drives the walk and calls back once the citizen is actually at the door, so the step
 * change is the end of a movement rather than an unrelated jump.
 */
export function useWalkToBooth(onArrived: () => void) {
  const [phase, setPhase] = useState<WalkPhase>('waiting');
  const phaseRef = useRef<WalkPhase>('waiting');
  const arrivedRef = useRef(onArrived);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { arrivedRef.current = onArrived; }, [onArrived]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const to = useCallback((p: WalkPhase) => { phaseRef.current = p; setPhase(p); }, []);

  // Stable identities so callers can depend on these without re-running on every render.
  const start = useCallback(() => {
    if (phaseRef.current !== 'waiting') return;
    to('walking');
    timers.current.push(setTimeout(() => to('arrived'), WALK_MS));
    timers.current.push(setTimeout(() => arrivedRef.current(), WALK_MS + DOOR_PAUSE_MS));
  }, [to]);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    to('waiting');
  }, [to]);

  return { phase, start, reset };
}
