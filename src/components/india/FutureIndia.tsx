'use client';

/**
 * Bharat 2047 — explorable Future India town.
 * The IsoCity engine renders the living world; clicking a landmark opens that civic
 * system. Live: Digital Voting Centre, AI Panchayat Kendra, Bank of Bharat.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CanvasIsometricGrid, SpriteSheetKey } from '@/components/game/CanvasIsometricGrid';
import { VotingCentre } from './VotingCentre';
import { PanchayatKendra } from './PanchayatKendra';
import { BankOfBharat } from './BankOfBharat';
import { Intent } from './Intent';
import { Tricolour } from './Tricolour';
import { WorldLabels, Viewport, WorldLabel } from './WorldLabels';

/**
 * The town is fixed and pristine on every visit, so we know exactly which sprite sheets it
 * needs. Loading only these cuts the critical path from ~7.2 MB to ~2.4 MB; the rest
 * (construction, abandoned, high-density, farms, mansions, aircraft) is fetched later at
 * idle time, since the simulation could in principle still call for it.
 */
const TOWN_SHEETS: SpriteSheetKey[] = ['parks', 'shops', 'stations', 'services', 'infrastructure'];

interface Landmark {
  id: string;
  name: string;
  icon: string;
  x: number; y: number; w: number; h: number; // grid footprint
  status: 'live' | 'next' | 'planned';
  tagline: string;
  description: string;
  /** label on the button that opens a live system */
  cta?: string;
}

const LANDMARKS: Landmark[] = [
  {
    id: 'voting', name: 'Digital Voting Centre', icon: '🗳️',
    x: 13, y: 6, w: 2, h: 2, status: 'live',
    tagline: 'Blockchain elections — tamper-proof, anonymous, instantly auditable.',
    description: 'Step inside and follow a citizen through a full blockchain vote: identity → anonymous token → ballot → SHA-256 seal → proof-of-work mining → the public chain. Then try to hack it.',
    cta: '🗳️ Step inside — cast a vote',
  },
  {
    id: 'panchayat', name: 'AI Panchayat Kendra', icon: '🏛️',
    x: 16, y: 6, w: 1, h: 1, status: 'live',
    tagline: 'Every villager gets a tireless assistant — and a human still signs every decision.',
    description: 'A villager brings any problem — a pension not arriving, wages unpaid, a handpump dry. A classifier trained live in your browser reads it in Hindi, Hinglish or English and shows its working; a rules engine checks her actual record; then five gates decide whether software may proceed alone or a panchayat member must sign. Type your own complaint and watch the confidence move.',
    cta: '🏛️ Step inside — bring a problem',
  },
  {
    id: 'bank', name: 'Bank of Bharat', icon: '🏦',
    x: 13, y: 13, w: 3, h: 3, status: 'live',
    tagline: 'A bank a regulator can audit without being allowed to read it.',
    description: 'Not another ledger on a chain — the town already has two. The harder question is what a supervisor can compute over a bank’s books without seeing anybody’s account. Turns out: solvency, sector concentration, and most financial crime. Every balance is sealed in a real Pedersen commitment; the audit multiplies them together and catches a one-rupee lie. Try to cook the books yourself.',
    cta: '🏦 Step inside — audit the bank',
  },
  {
    id: 'school', name: 'National Digital School', icon: '🏫',
    x: 6, y: 6, w: 2, h: 2, status: 'planned',
    tagline: 'Grades & certificates on decentralized storage — impossible to forge.',
    description: 'Planned: every marksheet and degree anchored to decentralized storage, verifiable by any employer in seconds.',
  },
  {
    id: 'hospital', name: 'Smart Health Centre', icon: '🏥',
    x: 20, y: 6, w: 2, h: 2, status: 'planned',
    tagline: 'AI triage + portable health records + transparent insurance.',
    description: 'Planned: AI-assisted triage for villages, records the patient owns, and insurance claims settled on-chain.',
  },
  {
    id: 'police', name: 'AI Safety Command', icon: '🚓',
    x: 6, y: 21, w: 1, h: 1, status: 'planned',
    tagline: 'AI CCTV that spots incidents in seconds — with privacy safeguards.',
    description: 'Planned: camera network detects accidents & crimes, dispatches the nearest responder, and logs every access to footage on an audit chain.',
  },
  {
    id: 'mobility', name: 'Smart Mobility Hub', icon: '🚌',
    x: 13, y: 21, w: 2, h: 2, status: 'planned',
    tagline: 'Buses & trains that citizens can actually plan their day around.',
    description: 'Planned: live tracking, demand-responsive routes, one QR ticket for every mode of transport.',
  },
  {
    id: 'garbage', name: 'Smart Waste Network', icon: '🗑️',
    x: 6, y: 23, w: 1, h: 1, status: 'planned',
    tagline: 'Bins that call the municipality — and watch over life itself.',
    description: 'Planned: fill-level sensors dispatch trucks on optimized routes; thermal sensors detect any living being and trigger an instant emergency alert.',
  },
];

const STATUS_META = {
  live: { label: 'LIVE DEMO', cls: 'bg-emerald-500 text-black' },
  next: { label: 'COMING NEXT', cls: 'bg-amber-500 text-black' },
  planned: { label: 'PLANNED', cls: 'bg-white/20 text-white/80' },
} as const;

export function FutureIndia({
  booted = true, onAssetProgress, onReady,
}: {
  /** False while the boot screen is still covering the world. */
  booted?: boolean;
  onAssetProgress?: (loaded: number, total: number) => void;
  onReady?: () => void;
} = {}) {
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState<Landmark | null>(null);
  const [showVoting, setShowVoting] = useState(false);
  const [showPanchayat, setShowPanchayat] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showIntent, setShowIntent] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  const hitTest = useMemo(() => {
    return (x: number, y: number): Landmark | null => {
      for (const l of LANDMARKS) {
        if (x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h) return l;
      }
      return null;
    };
  }, []);

  // The engine reports the clicked tile; we resolve it to a landmark right there rather
  // than in an effect, so one click is one render. Only landmarks stay selected — a
  // highlight diamond left on an empty field is the city builder's affordance, not ours,
  // and it explains nothing to a visitor.
  const handleTileSelect = useCallback((tile: { x: number; y: number } | null) => {
    const l = tile ? hitTest(tile.x, tile.y) : null;
    setSelectedTile(l ? tile : null);
    setActive(l);
    if (l) setNavigationTarget({ x: l.x, y: l.y });
  }, [hitTest]);

  const openLandmark = (l: Landmark) => {
    setActive(l);
    setNavigationTarget({ x: l.x, y: l.y });
  };

  const openLandmarkById = useCallback((id: string) => {
    const l = LANDMARKS.find((k) => k.id === id);
    if (l) {
      setActive(l);
      setNavigationTarget({ x: l.x, y: l.y });
    }
  }, []);

  // Hand the loading bar real numbers, and reveal the world once the sheets it needs have
  // landed. Deliberately not deferred to a frame callback: an occluded or backgrounded
  // window stops producing frames entirely, and the loading screen would sit there waiting
  // for a paint that is not coming.
  const handleSpriteProgress = useCallback((loaded: number, total: number) => {
    onAssetProgress?.(loaded, total);
    if (loaded >= total) onReady?.();
  }, [onAssetProgress, onReady]);

  const worldLabels: WorldLabel[] = useMemo(
    () => LANDMARKS.map((l) => ({
      id: l.id, name: l.name, icon: l.icon,
      x: l.x, y: l.y, w: l.w, h: l.h,
      live: l.status === 'live',
    })),
    [],
  );

  const systemOpen = showVoting || showPanchayat || showBank;

  return (
    <div className="w-full h-screen overflow-hidden bg-[#0b1020] relative">
      {/* The living town */}
      <CanvasIsometricGrid
        overlayMode="none"
        selectedTile={selectedTile}
        setSelectedTile={handleTileSelect}
        navigationTarget={navigationTarget}
        onNavigationComplete={() => setNavigationTarget(null)}
        onViewportChange={setViewport}
        onSpriteProgress={handleSpriteProgress}
        eagerSheets={TOWN_SHEETS}
        paused={!booted || systemOpen || showIntent}
        hideEngineUI
      />

      {/* Name plates floating over the buildings themselves */}
      {booted && !systemOpen && !showWelcome && (
        <WorldLabels
          labels={worldLabels}
          viewport={viewport}
          activeId={active?.id ?? null}
          onSelect={openLandmarkById}
        />
      )}

      {/* Title bar */}
      <div className="absolute top-0 inset-x-0 z-20 pointer-events-none">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-[#0b1020]/90 to-transparent">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-wide drop-shadow">
              <span className="text-amber-400">भारत</span> BHARAT <span className="text-emerald-400">2047</span>
            </h1>
            <p className="text-white/60 text-xs">How I want to see India&apos;s civic systems work in 2047 — argued technically, not just drawn · click any named building</p>
          </div>
          <div className="flex items-center gap-4 pointer-events-auto">
            <button
              onClick={() => setShowIntent(true)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500 hover:text-black border border-white/15 text-white/80 text-xs font-medium transition-colors">
              Why this exists
            </button>
            <div className="text-right text-white/40 text-xs">drag to pan · scroll to zoom</div>
          </div>
        </div>
      </div>

      {/* System dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 flex-wrap justify-center max-w-4xl px-4">
        {LANDMARKS.map((l) => (
          <button key={l.id} onClick={() => openLandmark(l)}
            className={`px-3 py-2 rounded-xl border text-sm backdrop-blur transition-all
              ${active?.id === l.id ? 'bg-amber-500 text-black border-amber-400 font-semibold' : 'bg-[#0b1020]/80 text-white/80 border-white/15 hover:border-amber-400/60 hover:text-white'}`}>
            <span className="mr-1">{l.icon}</span>{l.name}
            {l.status === 'live' && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
        ))}
      </div>

      {/* Landmark panel */}
      {active && !showVoting && !showPanchayat && !showBank && (
        <div className="absolute right-4 top-20 z-20 w-[340px] rounded-2xl bg-[#0e1428]/95 border border-white/15 shadow-2xl backdrop-blur p-5 text-white">
          <div className="flex items-start justify-between mb-2">
            <div className="text-4xl">{active.icon}</div>
            <button onClick={() => handleTileSelect(null)} className="text-white/40 hover:text-white">✕</button>
          </div>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${STATUS_META[active.status].cls}`}>
            {STATUS_META[active.status].label}
          </span>
          <h2 className="text-xl font-bold mb-1">{active.name}</h2>
          <p className="text-amber-300/90 text-sm mb-3">{active.tagline}</p>
          <p className="text-white/60 text-sm mb-4">{active.description}</p>
          {active.status === 'live' ? (
            <button onClick={() => {
              if (active.id === 'panchayat') setShowPanchayat(true);
              else if (active.id === 'bank') setShowBank(true);
              else setShowVoting(true);
            }}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg shadow-lg shadow-amber-500/25">
              {active.cta ?? 'Step inside'}
            </button>
          ) : (
            <div className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-center text-white/40 text-sm">
              This system opens in the next version
            </div>
          )}
        </div>
      )}

      {/* Welcome overlay */}
      {showWelcome && (
        <div className="absolute inset-0 z-30 bg-[#0b1020]/85 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-lg text-center text-white">
            <Tricolour className="w-20 h-auto mx-auto mb-5 drop-shadow-lg" />
            <h1 className="text-4xl font-bold mb-5"><span className="text-amber-400">Bharat</span> 2047</h1>
            <p className="text-white/70 mb-2">This is how I want to see India&apos;s civic systems work in 2047 — voting, panchayats, banking, schools — and I would rather show you than tell you.</p>
            <p className="text-white/50 text-sm mb-6">So none of it is a mockup. The town lives, traffic flows, the voting centre runs genuine cryptography, the panchayat trains a real classifier in your browser while you watch, and the bank is audited without anyone being allowed to read it.</p>
            <button onClick={() => setShowWelcome(false)}
              className="px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xl shadow-xl shadow-amber-500/30">
              Explore the town →
            </button>
            <button onClick={() => { setShowWelcome(false); setShowIntent(true); }}
              className="block mx-auto mt-4 text-white/60 hover:text-amber-300 text-sm underline underline-offset-4">
              Or read why I built this first
            </button>
            <div className="mt-4 text-white/30 text-xs">Open source · built on the open-source IsoCity engine (MIT)</div>
          </div>
        </div>
      )}

      {/* The working blockchain voting experience */}
      {showVoting && <VotingCentre onClose={() => setShowVoting(false)} onShowIntent={() => setShowIntent(true)} />}

      {/* The working AI grievance desk */}
      {showPanchayat && <PanchayatKendra onClose={() => setShowPanchayat(false)} onShowIntent={() => setShowIntent(true)} />}

      {/* The confidential ledger a regulator can audit without reading */}
      {showBank && <BankOfBharat onClose={() => setShowBank(false)} onShowIntent={() => setShowIntent(true)} />}

      {/* Why any of this exists. Sits above the systems so it can be opened from inside one. */}
      {showIntent && <Intent onClose={() => setShowIntent(false)} />}
    </div>
  );
}
