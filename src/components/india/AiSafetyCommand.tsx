'use client';

/**
 * AI Safety Command: the building where the watcher is the one on screen.
 *
 * Every other demonstration of this technology shows a video feed with a box drawn round a
 * person, and argues "the system sees well". This one argues that in a town where cameras
 * are going to exist anyway, the thing worth engineering is that abusing them is expensive
 * in mathematics rather than merely forbidden in policy. Policy changes with governments.
 * A key threshold does not.
 *
 * Nothing here is pre-recorded. The street below is drawn to a canvas frame by frame, and
 * safety.ts reads those actual pixels: real frame differencing, producing the eight numbers
 * that are the entire payload a camera in this town transmits. The visitor can watch a face
 * on screen and watch the numbers beside it, and see that nothing connects the two.
 *
 * There is deliberately no face recognition in this building. That is a refusal rather than
 * an omission, it is argued on screen, and its cost is stated: this network will tell you
 * that an incident happened here at this time, and it will never tell you who did it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACCESS_REASONS, AccessEntry, AccessReason, CHAIN_TEST, CHAIN_VERDICT, FrameFeatures,
  RoadGraph, SHAREHOLDERS, Share, appendAccess, assess, commit, extractFeatures, openFootage,
  sealFootage, shortestRoute, splitSecret, verifyAccessChain,
} from './safety';
import { IntentCard } from './Intent';
import { ArrivalScene } from './ArrivalScene';
import { useTownState } from './TownState';
import { WhatItUses, WhatItCosts } from './SystemFacts';

type Step = 'arrive' | 'watch' | 'incident' | 'dispatch' | 'request' | 'log' | 'chain';

const STEPS: { key: Step; label: string }[] = [
  { key: 'arrive', label: 'The street' },
  { key: 'watch', label: 'What the pole sends' },
  { key: 'incident', label: 'An incident' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'request', label: 'Open the footage' },
  { key: 'log', label: 'Who looked' },
  { key: 'chain', label: 'Does it need a chain' },
];

const CAM_W = 168;
const CAM_H = 112;
const CAMERA_ID = 'cam-07';
const CAMERA_PLACE = 'Junction of the market road';

/** The town's streets, as the dispatcher sees them. Coordinates are the isometric grid. */
const ROADS: RoadGraph = {
  nodes: [
    { id: 'station', label: 'Safety Command', x: 6, y: 21 },
    { id: 'canal', label: 'Canal road', x: 6, y: 14 },
    { id: 'chowk', label: 'Rampur chowk', x: 11, y: 14 },
    { id: 'market', label: 'Market road', x: 13, y: 13 },
    { id: 'school', label: 'School gate', x: 6, y: 6 },
    { id: 'bank', label: 'Bank of Bharat', x: 16, y: 6 },
    { id: 'panchayat', label: 'Panchayat Kendra', x: 13, y: 6 },
    { id: 'booth', label: 'Polling booth', x: 13, y: 6 },
  ],
  edges: [
    ['station', 'canal'], ['canal', 'chowk'], ['chowk', 'market'], ['canal', 'school'],
    ['market', 'panchayat'], ['panchayat', 'bank'], ['school', 'panchayat'],
  ],
};

type Scenario = 'quiet' | 'walk' | 'fall' | 'crowd' | 'bag';

const SCENARIOS: { key: Scenario; label: string; blurb: string }[] = [
  { key: 'quiet', label: 'Quiet street', blurb: 'Nothing moving. The pole still reports, and reports nothing.' },
  { key: 'walk', label: 'Someone walks past', blurb: 'Ordinary movement. One region, steady travel, no rule agrees with another.' },
  { key: 'fall', label: 'Someone collapses', blurb: 'Upright to flat, then stillness. Two rules agree and a responder is sent.' },
  { key: 'crowd', label: 'A crowd surges', blurb: 'Four regions moving hard at once, held across frames.' },
  { key: 'bag', label: 'A bag is dropped', blurb: 'The case that matters: one indicator fires and nobody is sent.' },
];

/* ------------------------------------------------------------------ the drawn street */

interface Actor {
  x: number;
  /** 0 upright, 1 flat on the ground. */
  down: number;
  scale: number;
  hue: number;
  /**
   * A bag is drawn as its own object rather than as a shrunken person. Scaling a body down
   * until it reads as luggage also scales it below the area threshold that makes the
   * unattended-object rule fire, and the screen would then promise that one indicator had
   * fired while in fact none had.
   */
  kind?: 'person' | 'bag';
}

/**
 * Draw one frame of the street.
 *
 * This is an ordinary canvas painting, and that is the point of the whole screen: a visitor
 * can see a person here, in colour, with a face, and then look at the eight numbers the pole
 * transmits and find nothing of the person in them. The gap between the two panels is the
 * argument.
 */
function drawStreet(g: CanvasRenderingContext2D, actors: Actor[], t: number) {
  const W = CAM_W;
  const H = CAM_H;

  const sky = g.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, '#22304d');
  sky.addColorStop(1, '#3b4a6b');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // Buildings along the far side, deliberately static so they contribute no motion.
  g.fillStyle = '#1b2540';
  const skyline = [10, 26, 18, 34, 22, 30, 14];
  skyline.forEach((h, i) => g.fillRect(i * 24, H * 0.55 - h, 22, h));
  g.fillStyle = 'rgba(255,196,120,0.5)';
  skyline.forEach((h, i) => {
    for (let w = 0; w < 2; w++) g.fillRect(i * 24 + 4 + w * 8, H * 0.55 - h + 5, 4, 4);
  });

  g.fillStyle = '#2b3350';
  g.fillRect(0, H * 0.55, W, H * 0.45);
  g.fillStyle = '#39405f';
  g.fillRect(0, H * 0.55, W, 3);
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.setLineDash([7, 7]);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, H * 0.82);
  g.lineTo(W, H * 0.82);
  g.stroke();
  g.setLineDash([]);

  const GROUND = H * 0.9;
  for (const a of actors) {
    if (a.kind === 'bag') {
      // Roughly square and about 15 px a side, which is a sack on this street and is also
      // comfortably above the area the unattended rule needs before it will say anything.
      const s = 15;
      g.fillStyle = `hsl(${a.hue} 55% 46%)`;
      g.beginPath();
      g.roundRect(a.x - s / 2, GROUND - s, s, s, 3);
      g.fill();
      g.strokeStyle = `hsl(${a.hue} 45% 30%)`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(a.x, GROUND - s, 4, Math.PI, 0);
      g.stroke();
      continue;
    }
    const bodyH = 30 * a.scale;
    const bodyW = 9 * a.scale;
    const headR = 4.6 * a.scale;
    g.save();
    g.translate(a.x, GROUND);
    // Rotating about the feet is what turns a tall silhouette into a wide one, which is the
    // only thing the detector downstream can notice about a fall.
    g.rotate((a.down * Math.PI) / 2);
    g.fillStyle = `hsl(${a.hue} 62% 58%)`;
    g.beginPath();
    g.roundRect(-bodyW / 2, -bodyH, bodyW, bodyH, 3);
    g.fill();
    g.fillStyle = '#f0c69a';
    g.beginPath();
    g.arc(0, -bodyH - headR + 1, headR, 0, Math.PI * 2);
    g.fill();
    // A face, drawn so that the screen is not quietly making its own argument easier.
    g.fillStyle = 'rgba(30,20,15,0.75)';
    g.fillRect(-1.8 * a.scale, -bodyH - headR - 0.4, 1.1 * a.scale, 1.1 * a.scale);
    g.fillRect(0.7 * a.scale, -bodyH - headR - 0.4, 1.1 * a.scale, 1.1 * a.scale);
    g.restore();
  }

  // The pole itself, and a lamp that flickers a little so the scene is not sterile.
  g.fillStyle = '#151c33';
  g.fillRect(W - 16, H * 0.3, 3, H * 0.6);
  g.fillStyle = `rgba(255,214,150,${0.5 + Math.sin(t / 400) * 0.06})`;
  g.beginPath();
  g.ellipse(W - 14.5, H * 0.3, 7, 4, 0, 0, Math.PI * 2);
  g.fill();
}

/** Where each actor stands for a given scenario at a given step of the clip. */
function actorsFor(scenario: Scenario, frame: number): Actor[] {
  const walkX = 26 + frame * 13;
  switch (scenario) {
    case 'quiet':
      return [];
    case 'walk':
      return [{ x: walkX, down: 0, scale: 1, hue: 205 }];
    case 'fall':
      // Three frames walking, then down and motionless, which is the shape the rules look for.
      return [{ x: Math.min(walkX, 65), down: frame >= 3 ? 1 : 0, scale: 1, hue: 205 }];
    case 'crowd': {
      const sway = (frame % 2 === 0 ? 1 : -1) * 7;
      return [30, 60, 90, 120].map((x, i) => ({
        x: x + sway * (i % 2 === 0 ? 1 : -1), down: 0, scale: 0.95, hue: 190 + i * 22,
      }));
    }
    case 'bag':
      // Present from frame one onward and never moving again, which is the whole signal.
      return frame === 0 ? [] : [{ x: 84, down: 0, scale: 1, hue: 34, kind: 'bag' }];
  }
}

const FRAMES_PER_CLIP = 6;

/**
 * The camera pole: a canvas the scene is painted to, and the numbers read back off it.
 *
 * `getImageData` on consecutive frames, handed straight to `extractFeatures`. The clip runs
 * as six discrete frames rather than continuously, because the visitor needs to be able to
 * stop on one and read the numbers that came out of it, and because six frames is what the
 * rules in safety.ts are written to reason over.
 */
function CameraPole({
  scenario, frame, onClip, showDiff,
}: {
  scenario: Scenario;
  frame: number;
  onClip: (fs: FrameFeatures[]) => void;
  showDiff: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const diffRef = useRef<HTMLCanvasElement | null>(null);
  const clipPixels = useRef<Uint8ClampedArray[]>([]);
  const [ready, setReady] = useState(0);

  // The whole clip is computed once, up front. Doing it frame by frame as the visitor watches
  // ties the arithmetic to the order the frames happen to be rendered in, which means scrubbing
  // backwards compares the wrong two images and silently reports nonsense.
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = CAM_W;
    off.height = CAM_H;
    const g = off.getContext('2d', { willReadFrequently: true });
    if (!g) return;

    const frames: Uint8ClampedArray[] = [];
    const features: FrameFeatures[] = [];
    for (let i = 0; i < FRAMES_PER_CLIP; i++) {
      drawStreet(g, actorsFor(scenario, i), i * 220);
      const pixels = g.getImageData(0, 0, CAM_W, CAM_H).data;
      frames.push(pixels);
      features.push(
        extractFeatures(i === 0 ? pixels : frames[i - 1], pixels, CAM_W, CAM_H, features[i - 1], i),
      );
    }
    clipPixels.current = frames;
    onClip(features);
    setReady((r) => r + 1);
  }, [scenario, onClip]);

  // Painting is then a pure function of which frame is selected, so scrubbing is exact.
  useEffect(() => {
    const frames = clipPixels.current;
    if (!frames.length) return;
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!g) return;
    drawStreet(g, actorsFor(scenario, frame), frame * 220);

    // The motion mask, drawn so the visitor can see exactly which pixels the numbers came
    // from. It is the same comparison the detector makes, painted instead of counted.
    const diff = diffRef.current;
    const dg = diff?.getContext('2d');
    if (!dg) return;
    const cur = frames[frame];
    const prev = frames[Math.max(0, frame - 1)];
    const out = dg.createImageData(CAM_W, CAM_H);
    for (let i = 0; i < cur.length; i += 4) {
      const lp = (prev[i] * 77 + prev[i + 1] * 150 + prev[i + 2] * 29) >> 8;
      const lc = (cur[i] * 77 + cur[i + 1] * 150 + cur[i + 2] * 29) >> 8;
      const delta = lc - lp;
      const on = Math.abs(delta) >= 26;
      out.data[i] = on && delta > 0 ? 56 : 12;
      out.data[i + 1] = on ? (delta > 0 ? 220 : 90) : 16;
      out.data[i + 2] = on && delta < 0 ? 150 : 28;
      out.data[i + 3] = 255;
    }
    dg.putImageData(out, 0, 0);
  }, [scenario, frame, ready]);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <figure className="m-0">
        <canvas
          ref={canvasRef} width={CAM_W} height={CAM_H}
          className="w-full rounded-lg border border-white/15 bg-[#22304d]"
          style={{ imageRendering: 'pixelated', aspectRatio: `${CAM_W} / ${CAM_H}` }}
        />
        <figcaption className="mt-1 flex items-center gap-1.5 text-[10px] text-white/40">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          What the lens sees. It never leaves the pole.
        </figcaption>
      </figure>
      <figure className={`m-0 ${showDiff ? '' : 'hidden sm:block'}`}>
        <canvas
          ref={diffRef} width={CAM_W} height={CAM_H}
          className="w-full rounded-lg border border-white/15 bg-black"
          style={{ imageRendering: 'pixelated', aspectRatio: `${CAM_W} / ${CAM_H}` }}
        />
        <figcaption className="mt-1 text-[10px] text-white/40">
          What changed. Green is where something now is, purple where it was.
        </figcaption>
      </figure>
    </div>
  );
}

/** One number from the payload, with the name a person would use for it. */
function Num({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="font-mono text-sm text-cyan-300">{value}</div>
      {hint && <div className="text-[9px] leading-snug text-white/30">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ the building */

export function AiSafetyCommand({
  onClose, onShowIntent,
}: {
  onClose: () => void;
  onShowIntent: () => void;
}) {
  const town = useTownState();
  const [step, setStep] = useState<Step>('arrive');
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  const [scenario, setScenario] = useState<Scenario>('fall');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [features, setFeatures] = useState<FrameFeatures[]>([]);

  const onClip = useCallback((fs: FrameFeatures[]) => setFeatures(fs), []);

  useEffect(() => {
    if (!playing) return;
    if (frame >= FRAMES_PER_CLIP - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setFrame((f) => f + 1), 420);
    return () => clearTimeout(id);
  }, [playing, frame]);

  const runClip = useCallback((next: Scenario) => {
    setScenario(next);
    setFrame(0);
    setPlaying(true);
  }, []);

  // Assess only as far as the visitor has actually watched, so the verdict builds with the
  // clip rather than being known before the first frame is on screen.
  const assessment = useMemo(() => assess(features.slice(0, frame + 1)), [features, frame]);
  const complete = frame >= FRAMES_PER_CLIP - 1 && !playing;

  const route = useMemo(() => shortestRoute(ROADS, 'station', 'market'), []);

  /* --------------------------------------------------- the sealed clip and its key */

  const [sealedClip, setSealedClip] = useState<Awaited<ReturnType<typeof sealFootage>> | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [opened, setOpened] = useState<{ ok: boolean; text: string } | null>(null);
  const [reason, setReason] = useState<AccessReason>('active-incident');

  const [chain, setChain] = useState<AccessEntry[]>([]);
  const [chainOk, setChainOk] = useState<{ ok: boolean; brokenAt: number[] } | null>(null);
  const saltRef = useRef({ subject: '', officer: '' });

  useEffect(() => {
    let live = true;
    (async () => {
      const clipText =
        `Camera 07, ${CAMERA_PLACE}. 47 seconds, 1440 by 810. One person enters from the ` +
        `east, goes to the ground at 00:31 and does not get up. A second person stops at 00:38.`;
      const s = await sealFootage(clipText, CAMERA_ID, [], 0);
      if (!live) return;
      setSealedClip(s);
      setShares(splitSecret(s.key, 2, 3));
      saltRef.current = {
        subject: 'salt held by the citizen, never by the station',
        officer: 'station roster salt',
      };
    })();
    return () => { live = false; };
  }, []);

  const toggleHolder = (id: string) =>
    setHeld((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));

  /**
   * Try to open the clip with whatever shares are currently held.
   *
   * There is no permission check anywhere in this function. It combines what it was given
   * and hands the result to AES-GCM, which either authenticates or does not. That is the
   * difference between a safeguard and a setting: a setting can be changed by whoever
   * administers the system, and this cannot be changed by anybody.
   */
  const attemptOpen = useCallback(async () => {
    if (!sealedClip) return;
    const chosen = shares.filter((s) => held.includes(s.holder));
    let result: { ok: boolean; text: string };
    try {
      if (chosen.length < 2) throw new Error('below the threshold');
      const text = await openFootage(sealedClip.sealed, chosen);
      result = { ok: true, text };
    } catch {
      result = {
        ok: false,
        text:
          chosen.length < 2
            ? 'One share is a point on a polynomial. The key is the point at zero, and one point does not determine a line.'
            : 'The shares combined to a key, and it was the wrong key. AES-GCM refused the tag.',
      };
    }
    setOpened(result);

    const subject = await commit('Kamla Devi', saltRef.current.subject);
    const officer = await commit('Officer 47, Rampur station', saltRef.current.officer);
    const next = await appendAccess(chain, {
      action: result.ok ? 'granted' : 'refused',
      subjectCommit: subject,
      officerCommit: officer,
      reason,
      signers: chosen.map((c) => c.holder),
      cameraId: CAMERA_ID,
      clipT: 0,
      t: chain.length + 1,
    });
    setChain(next);
    setChainOk(await verifyAccessChain(next));

    town.record({
      kind: result.ok ? 'case' : 'attack',
      system: 'safety',
      label: result.ok
        ? 'Footage was opened, and the town knows who opened it'
        : 'Someone tried to open footage alone, and could not',
      detail: result.ok
        ? `Two of three shareholders combined: ${chosen.map((c) => c.holder).join(' and ')}. The access is entry #${next.length - 1} on the audit chain, under "${ACCESS_REASONS[reason]}".`
        : 'The attempt is on the audit chain as a refusal. A system that records only successful access cannot tell an officer who never looked from one who tried and was stopped.',
      at: { x: 6, y: 21 },
    });
  }, [sealedClip, shares, held, chain, reason, town]);

  /** Quietly rewrite a refusal into a grant, the way an insider actually would. */
  const tamper = useCallback(async () => {
    if (!chain.length) return;
    const idx = chain.findIndex((e) => e.action === 'refused');
    if (idx < 0) return;
    const edited = chain.map((e, i) => (i === idx ? { ...e, action: 'granted' as const } : e));
    setChain(edited);
    setChainOk(await verifyAccessChain(edited));
    town.record({
      kind: 'attack', system: 'safety',
      label: 'A refusal was edited into a grant, and it held',
      detail: `Entry #${idx} was rewritten. Its hash no longer matches its contents, and every entry after it is orphaned, so the edit announces itself.`,
      at: { x: 6, y: 21 },
    });
  }, [chain, town]);

  // The numbers belong to the frame on screen, not to the end of the clip.
  const latest = features[frame];
  const go = (k: Step) => setStep(k);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b1020] text-white">
      <style>{`
        @keyframes sf-pop { 0% { transform: scale(.97); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        .sf-pop { animation: sf-pop .4s ease-out; }
      `}</style>

      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0b1020]/95 px-6 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl">🚓</span>
          <div className="min-w-0">
            <div className="truncate font-semibold tracking-wide">AI Safety Command, Rampur</div>
            <div className="truncate text-xs text-white/50">
              {CAMERA_ID} · {CAMERA_PLACE} · frame differencing in your browser · no face recognition anywhere in this system
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden items-center gap-1 xl:flex">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <button
                  onClick={() => go(s.key)}
                  className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] ${
                    i === stepIdx ? 'border-amber-400 bg-amber-500 font-semibold text-black'
                      : i < stepIdx ? 'border-emerald-500/40 bg-emerald-600/30 text-emerald-300'
                        : 'border-white/15 text-white/40'}`}
                >{s.label}</button>
                {i < STEPS.length - 1 && <div className="h-px w-2 bg-white/20" />}
              </React.Fragment>
            ))}
          </div>
          <button onClick={onClose} className="whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
            ← Back to town
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr_340px]">
        <div className="min-h-[460px]">

          {step === 'arrive' && (
            <div className="sf-pop">
              <h2 className="mb-2 text-3xl font-bold">A camera on the market road</h2>
              <p className="mb-6 max-w-2xl text-white/60">
                Kamla Devi walks past this pole most days. She has never agreed to it and cannot
                switch it off, and in almost every town that ships this technology those two facts
                are the end of the conversation. This building is an argument that they should be
                the beginning of it, because the question worth engineering is not whether the
                camera sees her. It is who can look, and whether she can find out that they did.
              </p>

              <div className="mb-6">
                <ArrivalScene autoPlay citizenName="Kamla Devi" variant="panchayat"
                  caption="walking to the panchayat, past the pole on the market road"
                  arrivedLabel="Under camera 07" />
              </div>

              <div className="mb-6 rounded-xl border border-rose-400/25 bg-rose-500/10 p-4">
                <div className="mb-1 font-semibold text-rose-200">What this building refuses to do</div>
                <p className="text-sm leading-relaxed text-white/60">
                  There is no face recognition here, and that is a decision rather than an
                  omission. The documented failures of the technology in policing are wrongful
                  arrests of real people, and a system confident enough to name a suspect is
                  confident enough to be wrong about one. The price of the refusal is real and
                  worth saying plainly: this network will tell you that something happened here,
                  at this time. It will never tell you who did it.
                </p>
              </div>

              <button onClick={() => go('watch')}
                className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-black hover:bg-amber-400">
                See what the pole actually sends →
              </button>
            </div>
          )}

          {(step === 'watch' || step === 'incident') && (
            <div className="sf-pop">
              <h2 className="mb-2 text-3xl font-bold">
                {step === 'watch' ? 'Eight numbers, and nothing else' : 'When a responder is sent'}
              </h2>
              <p className="mb-5 max-w-2xl text-white/60">
                {step === 'watch'
                  ? 'The panel on the left is a real canvas with a real person drawn on it, face and all. The panel on the right is the difference between two frames, which is the only thing this pole computes. Everything the control room will ever know about this moment is in the row of numbers below them.'
                  : 'The rules are readable, and they have to agree in pairs. One indicator is how a dropped bag becomes an armed response, so try that one before you try the collapse.'}
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                {SCENARIOS.map((s) => (
                  <button key={s.key} onClick={() => runClip(s.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      scenario === s.key ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-white/15 text-white/60 hover:bg-white/10'}`}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <CameraPole scenario={scenario} frame={frame} onClip={onClip} showDiff />
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => runClip(scenario)}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
                    {playing ? 'Running…' : 'Replay the clip'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: FRAMES_PER_CLIP }, (_, i) => (
                      <button key={i} onClick={() => { setPlaying(false); setFrame(i); }}
                        className={`h-1.5 w-6 rounded-full ${i <= frame ? 'bg-amber-400' : 'bg-white/15'}`}
                        aria-label={`Frame ${i + 1}`} />
                    ))}
                  </div>
                  <span className="text-[11px] text-white/40">frame {frame + 1} of {FRAMES_PER_CLIP}</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                  {SCENARIOS.find((s) => s.key === scenario)?.blurb}
                </p>
              </div>

              {latest && (
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Num label="motion" value={latest.motionEnergy.toFixed(4)} hint="share of pixels changed" />
                  <Num label="regions" value={String(latest.occupancy)} hint="an estimate, not a count" />
                  <Num label="shape" value={latest.aspect.toFixed(2)} hint="wide over tall" />
                  <Num label="jerk" value={latest.jerk.toFixed(4)} hint="change since last frame" />
                  <Num label="centre x" value={latest.cx.toFixed(3)} />
                  <Num label="centre y" value={latest.cy.toFixed(3)} />
                  <Num label="drift" value={latest.drift.toFixed(4)} hint="frame widths travelled" />
                  <Num label="at" value={`t+${latest.t}`} />
                </div>
              )}

              {step === 'watch' && (
                <>
                  <div className="mb-5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                    <div className="mb-1 font-semibold text-emerald-200">Why this is the safeguard</div>
                    <p className="text-sm leading-relaxed text-white/60">
                      A network that transmits footage can be repurposed by anyone who later gains
                      access to it. A network that transmits these eight numbers cannot, because
                      the information needed to identify a person was never captured into the
                      message in the first place. The guarantee is in the shape of the data rather
                      than in a policy document, which means it survives a change of government.
                    </p>
                  </div>
                  <button onClick={() => { go('incident'); runClip('bag'); }}
                    className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-black hover:bg-amber-400">
                    Now watch it decide →
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'incident' && (
            <div className="sf-pop">
              <div className={`mb-4 rounded-xl border p-4 ${
                assessment.dispatch ? 'border-rose-400/40 bg-rose-500/10'
                  : assessment.severity > 0 ? 'border-amber-400/30 bg-amber-500/10'
                    : 'border-white/12 bg-white/5'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold">
                    {assessment.dispatch ? 'Responder dispatched'
                      : assessment.severity > 0 ? 'Logged, nobody sent'
                        : 'Nothing to report'}
                  </div>
                  <div className="font-mono text-[11px] text-white/45">
                    {assessment.kind} · severity {assessment.severity} of 3
                  </div>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/55">{assessment.basis}</p>
              </div>

              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-xs uppercase tracking-wider text-white/40">
                  Rules that fired {complete ? '' : '(the clip is still running)'}
                </div>
                {assessment.fired.length === 0 ? (
                  <div className="text-xs text-white/35">None. No threshold was crossed.</div>
                ) : (
                  <ul className="space-y-2">
                    {assessment.fired.map((f) => (
                      <li key={f.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                        <div className="font-mono text-[10px] text-amber-300/80">{f.id}</div>
                        <div className="text-xs text-white/70">{f.says}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-white/40">{f.because}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-1 font-semibold">Why there is no model here</div>
                <p className="text-xs leading-relaxed text-white/50">
                  This is the layer that decides whether armed people are sent to a location, and
                  a system that cannot explain that decision in a sentence has no business making
                  it. Every rule above is a comparison you can read, with the numbers that fired
                  it. It is the same position the panchayat takes on its five gates, and the same
                  reason: a wrong answer here is not an inconvenience, it is a person.
                </p>
              </div>

              <button onClick={() => go('dispatch')} disabled={!assessment.dispatch}
                className={`rounded-lg px-5 py-2.5 font-semibold ${
                  assessment.dispatch ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'cursor-not-allowed bg-white/10 text-white/30'}`}>
                {assessment.dispatch ? 'Send the nearest responder →' : 'Run the collapse to dispatch someone'}
              </button>
            </div>
          )}

          {step === 'dispatch' && route && (
            <div className="sf-pop">
              <h2 className="mb-2 text-3xl font-bold">The nearest, and provably so</h2>
              <p className="mb-5 max-w-2xl text-white/60">
                A star search over the town streets, with straight-line distance as the heuristic.
                That choice is not decoration: an admissible heuristic is what makes this the
                shortest route rather than merely a good one, and the screen is claiming
                &quot;nearest&quot;, so it has to be true.
              </p>

              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <ol className="space-y-1.5">
                  {route.path.map((id, i) => {
                    const node = ROADS.nodes.find((n) => n.id === id);
                    return (
                      <li key={id} className="flex items-center gap-3 text-sm">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                          i === 0 ? 'bg-sky-500 text-black'
                            : i === route.path.length - 1 ? 'bg-rose-500 text-black' : 'bg-white/15'}`}>
                          {i + 1}
                        </span>
                        <span className="text-white/75">{node?.label ?? id}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-3 flex gap-4 border-t border-white/10 pt-3 font-mono text-xs text-cyan-300">
                  <span>{Math.round(route.metres)} m</span>
                  <span>{Math.round(route.seconds)} s at 30 km/h</span>
                </div>
              </div>

              <button onClick={() => go('request')}
                className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-black hover:bg-amber-400">
                The responder wants the footage →
              </button>
            </div>
          )}

          {step === 'request' && (
            <div className="sf-pop">
              <h2 className="mb-2 text-3xl font-bold">Two of three, or it stays shut</h2>
              <p className="mb-5 max-w-2xl text-white/60">
                The clip is encrypted under a real AES-GCM key, and that key was split three ways
                by Shamir secret sharing over GF(256) the moment this screen opened. Nobody in
                this town holds it. Pick who is in the room and try.
              </p>

              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                {SHAREHOLDERS.map((h) => (
                  <button key={h.id} onClick={() => { toggleHolder(h.id); setOpened(null); }}
                    className={`rounded-xl border p-3 text-left transition ${
                      held.includes(h.id) ? 'border-emerald-400/50 bg-emerald-500/15'
                        : 'border-white/12 bg-white/5 hover:bg-white/10'}`}>
                    <div className="text-xl">{h.icon}</div>
                    <div className="text-sm font-semibold text-white/85">{h.label}</div>
                    <div className="mt-1 font-mono text-[9px] leading-tight text-white/35">
                      {held.includes(h.id) ? 'share presented' : 'not in the room'}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">
                  Reason, from a closed list
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ACCESS_REASONS) as AccessReason[]).map((r) => (
                    <button key={r} onClick={() => setReason(r)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                        reason === r ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/15 text-white/55 hover:bg-white/10'}`}>
                      {ACCESS_REASONS[r]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                  Free text is not a reason. A category no auditor can test is how an access log
                  becomes decoration, which is why this list is closed and short.
                </p>
              </div>

              <button onClick={attemptOpen} disabled={!sealedClip}
                className="mb-4 rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-black hover:bg-amber-400 disabled:bg-white/10 disabled:text-white/30">
                Attempt to open the clip
              </button>

              {opened && (
                <div className={`sf-pop mb-5 rounded-xl border p-4 ${
                  opened.ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'}`}>
                  <div className={`mb-1 font-semibold ${opened.ok ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {opened.ok ? 'Opened' : 'Refused by the arithmetic'}
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed text-white/60">{opened.text}</p>
                  {!opened.ok && (
                    <p className="mt-2 text-xs leading-relaxed text-white/50">
                      Nothing in this code checked a permission and decided to say no. The shares
                      presented did not reconstruct the key, so there was no key to refuse with.
                      An administrator cannot change that, because there is no setting.
                    </p>
                  )}
                </div>
              )}

              <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                <div className="mb-1 font-semibold text-amber-200">What it costs, in minutes</div>
                <p className="text-xs leading-relaxed text-white/55">
                  A magistrate has to be reachable at three in the morning for this clip to open
                  at three in the morning. That is the real price of the design and it is paid by
                  the person on the ground, not by the architecture. A town that finds the wait
                  intolerable can lower the threshold to one, and it will have chosen speed over
                  oversight deliberately rather than discovered it later.
                </p>
              </div>

              <button onClick={() => go('log')}
                className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-black hover:bg-amber-400">
                See what the attempt left behind →
              </button>
            </div>
          )}

          {step === 'log' && (
            <div className="sf-pop">
              <h2 className="mb-2 text-3xl font-bold">Who looked, and who tried</h2>
              <p className="mb-5 max-w-2xl text-white/60">
                Every attempt above is on this chain, refusals included. That is the load-bearing
                choice: a log that records only successful access cannot tell an officer who never
                looked from one who tried four times and was stopped, and the second is the one an
                oversight body needs to see.
              </p>

              {chain.length === 0 ? (
                <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/40">
                  Nothing yet. Go back a step and try to open the clip, with one shareholder and
                  then with two.
                </div>
              ) : (
                <div className="mb-4 space-y-2">
                  {chain.map((e) => {
                    const broken = chainOk?.brokenAt.includes(e.index);
                    return (
                      <div key={e.index}
                        className={`rounded-xl border p-3 ${
                          broken ? 'border-rose-500/50 bg-rose-500/10'
                            : e.action === 'granted' ? 'border-emerald-400/30 bg-emerald-500/10'
                              : 'border-white/12 bg-white/5'}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="text-sm font-semibold">
                            #{e.index} {e.action === 'granted' ? 'Opened' : 'Refused'}
                            {broken && <span className="ml-2 text-xs font-normal text-rose-300">chain broken here</span>}
                          </div>
                          <div className="font-mono text-[10px] text-white/40">
                            {e.signers.length ? e.signers.join(' + ') : 'no shares presented'}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-white/55">{ACCESS_REASONS[e.reason]}</div>
                        <div className="mt-1.5 grid gap-0.5 font-mono text-[9px] leading-relaxed text-white/35">
                          <div>subject {e.subjectCommit.slice(0, 24)}…</div>
                          <div>officer {e.officerCommit.slice(0, 24)}…</div>
                          <div>hash    {e.hash.slice(0, 24)}…</div>
                          <div>prev    {e.prevHash.slice(0, 24)}…</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {chainOk && (
                <div className={`mb-4 rounded-xl border p-3 text-sm ${
                  chainOk.ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}>
                  {chainOk.ok
                    ? 'Chain verifies. Every hash matches its contents and every link matches the entry before it.'
                    : `Chain broken at [${chainOk.brokenAt.join(', ')}]. The edited entry and every entry after it are orphaned.`}
                </div>
              )}

              <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-1 font-semibold">Nobody is named on this log</div>
                <p className="mb-3 text-xs leading-relaxed text-white/50">
                  A public audit trail that names people is a public register of who is under
                  surveillance, which is the thing it was built to prevent. Every identity here is
                  a salted hash. Kamla, holding her own salt, can prove which entries are about
                  her. Nobody else can even enumerate them.
                </p>
                <button onClick={tamper} disabled={!chain.some((e) => e.action === 'refused')}
                  className="rounded-md bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:bg-white/10 disabled:text-white/30">
                  Try it: quietly turn a refusal into a grant
                </button>
                {!chain.some((e) => e.action === 'refused') && (
                  <p className="mt-2 text-[11px] text-white/30">
                    {chain.length === 0
                      ? 'Make a refused attempt first, with one shareholder only.'
                      : 'There is no refusal left to rewrite. That is what the edit above did, and the chain is still carrying the evidence of it.'}
                  </p>
                )}
              </div>

              <button onClick={() => go('chain')}
                className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-black hover:bg-amber-400">
                So does this need a blockchain? →
              </button>
            </div>
          )}

          {step === 'chain' && (
            <div className="sf-pop">
              <h2 className="mb-2 text-3xl font-bold">Does this one actually need a chain?</h2>
              <p className="mb-5 max-w-2xl text-white/60">
                Three of the four systems built before this one answer no, and say so on their own
                screens. This is the seven-question test from the same doctrine, run against the
                access log rather than against the footage, because they are two different
                problems and only one of them is about agreement between parties.
              </p>

              <ol className="mb-5 space-y-2">
                {CHAIN_TEST.map((q) => (
                  <li key={q.n} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                        q.verdict === 'yes' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'}`}>
                        {q.verdict === 'yes' ? '✓' : '!'}
                      </span>
                      <div>
                        <div className="text-sm text-white/80">{q.n}. {q.question}</div>
                        <div className="mt-1 text-xs leading-relaxed text-white/50">{q.why}</div>
                        {q.verdict === 'by design' && (
                          <div className="mt-1.5 inline-block rounded-full border border-amber-400/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                            passes only because it was designed to
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <div className="mb-1 text-lg font-bold text-amber-200">{CHAIN_VERDICT.headline}</div>
                <p className="text-sm leading-relaxed text-white/60">{CHAIN_VERDICT.detail}</p>
              </div>

              <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-1 font-semibold">The part the chain does not fix</div>
                <p className="text-xs leading-relaxed text-white/50">
                  This log proves who looked. It cannot prove they should have been allowed to,
                  and it cannot stop a magistrate who signs whatever is put in front of him. That
                  is governance, and no amount of hashing moves it. What it removes is the quiet
                  version of the abuse, where the viewing happens and the record of it does not
                  survive the week.
                </p>
              </div>

              <button onClick={onClose}
                className="rounded-lg bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/20">
                ← Back to town
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <IntentCard onOpen={onShowIntent} />

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 font-semibold">What&apos;s real in this demo?</div>
            <ul className="space-y-1.5 text-xs leading-relaxed text-white/50">
              <li>👁 <b className="text-white/80">The detection</b>: real frame differencing over the canvas above, computed on the actual pixels in your browser. No model, no download.</li>
              <li>🔑 <b className="text-white/80">The split key</b>: real Shamir secret sharing over GF(256), splitting a real AES-GCM key. One share genuinely cannot decrypt.</li>
              <li>⛓ <b className="text-white/80">The access log</b>: SHA-256 chained, the same way the voting centre chains blocks.</li>
              <li>🗺 <b className="text-white/80">The route</b>: A star over the town graph, and the verifier checks it against brute force.</li>
              <li>🎭 <b className="text-white/80">Not real</b>: the street is drawn rather than filmed, the clip behind the encryption is a written description, and the keys live for as long as this tab does.</li>
            </ul>
          </div>

          <WhatItUses
            uses={'Frame differencing · Shamir over GF(256) · AES-GCM · SHA-256 access chain'}
            needsChain
            why={'The access log is the second thing in this town to earn one, after the voting centre. Several parties write to it, they do not trust each other, and there is no operator all of them would accept, because the police cannot run the log that audits the police. The footage itself needs no chain, only encryption and a split key.'}
          />
          <WhatItCosts points={[
            'No face recognition means no suspect. This network tells you an incident happened here at this time, and never who did it.',
            'A two-of-three key means a genuine emergency waits for a second signer. Oversight is paid for in minutes, by the person on the ground.',
            'The rules are thresholds, so they can be wrong. A false positive here is an armed response to somebody innocent, which is why two rules have to agree.',
            'The log proves who looked, never whether they should have. That stays governance, and cryptography does not touch it.',
          ]} />

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="mb-1 font-semibold text-amber-300">Honest caveat</div>
            <p className="text-xs leading-relaxed text-white/50">
              A real deployment needs the detector running on hardware at the pole with
              attestation, because a camera that can be replaced with one that lies makes every
              guarantee downstream cosmetic. It needs the shareholders to be genuinely
              independent, which is an institutional question this prototype cannot answer. And
              the drawn street here is kind to the detector in a way a monsoon night would not
              be.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 font-semibold">Verify it yourself</div>
            <p className="text-xs leading-relaxed text-white/50">
              Every property on this screen is asserted by
              <span className="font-mono text-white/70"> npm run verify-safety</span>, which runs
              against this exact module: that one share reconstructs nothing, that a forged share
              fails in the cryptography rather than a permission check, that a dropped bag does
              not dispatch anybody, that editing a refusal breaks the chain, and that the payload
              has no field able to carry an image.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
