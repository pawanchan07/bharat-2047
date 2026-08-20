'use client';

/**
 * "Take the tour": the camera flies the town while it tells you what you are looking at.
 *
 * Subtitles are not an accessibility afterthought here, they are the fallback rung: a device
 * with no voice for the chosen language still gets the whole tour by reading it. So the
 * subtitle is always on screen and the narration is the optional layer, not the reverse.
 *
 * Translation is the model's job when it is awake. When it is not, the tour runs in English
 * and says so rather than pretending.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { languageFor } from './languages';
import { useTownAI } from './TownAI';
import { useSpeaking } from './useSpeech';

export interface TourStop {
  /** Landmark to fly to, or null to pull back and look at the whole town. */
  landmarkId: string | null;
  title: string;
  narration: string;
}

export const TOUR: TourStop[] = [
  {
    landmarkId: null,
    title: 'Rampur, Ward 04',
    narration:
      'This is Rampur in 2047. It is not a picture of a town, it is a working one. Every building you can see the name of opens a civic system that actually runs, right here in your browser. Nothing is a video, and nothing is waiting on a server.',
  },
  {
    landmarkId: 'voting',
    title: 'The Digital Voting Centre',
    narration:
      'A citizen votes here. Her identity becomes a one-way token, so the record knows a valid person voted but never who. The vote is sealed with real cryptography and mined with real proof of work, and you can watch the numbers race. Then you can try to rewrite a vote, and watch the whole chain after it break.',
  },
  {
    landmarkId: 'panchayat',
    title: 'The AI Panchayat Kendra',
    narration:
      'This is the grievance desk. A villager speaks her problem out loud, in her own language, because most welfare in India is not refused, it is lost in a form nobody could fill. A classifier trained in your browser reads her, rules check her real record, and five gates decide whether software may act alone. Most of the time, it may not.',
  },
  {
    landmarkId: 'bank',
    title: 'The Bank of Bharat',
    narration:
      'The bank asks a harder question than putting money on a chain. What can a regulator prove about a bank without being shown a single account? It turns out: that it is solvent, where it is over-exposed, and most of its financial crime. Every balance stays sealed while all of that is computed.',
  },
  {
    landmarkId: 'school',
    title: 'The National Digital School',
    narration:
      'A degree here proves itself. The school signs it with a real key, the certificate gets a real content address, and every field hangs off a Merkle tree, so a graduate can prove she has the degree while showing you three fields and hiding the rest. Change one mark and it stops verifying, in front of you.',
  },
  {
    landmarkId: null,
    title: 'The buildings still greyed out',
    narration:
      'Six more systems are planned, and they are deliberately not pretended at. Cameras whose every viewing is itself logged, waste bins that call for themselves, transport a family can plan a day around, and claims that cannot quietly vanish. One at a time, each built to the standard of the four that work.',
  },
  {
    landmarkId: null,
    title: 'Why it is built this way',
    narration:
      'Every mechanism here runs for real because an argument about how India should work is worth more when you can check it than when you can only look at it. It is open source, it needs no keys, and it runs entirely on your own machine. Go and click something.',
  },
];

/** Roughly how long a subtitle needs to be readable when there is no voice to pace it. */
const readMs = (text: string) => Math.max(4200, Math.min(15000, text.split(/\s+/).length * 330));

export function GuidedTour({
  onFocus, onClose,
}: {
  onFocus: (landmarkId: string | null) => void;
  onClose: () => void;
}) {
  const townAI = useTownAI();
  const speaking = useSpeaking();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lang = languageFor(townAI.language);
  const stop = TOUR[index];
  const voice = speaking.voiceFor(townAI.language);
  const needsTranslation = townAI.language !== 'en-IN';
  const spokenText = translations[index] ?? stop.narration;
  const translated = needsTranslation && translations[index] !== undefined;

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const go = useCallback((next: number) => {
    clearTimer();
    speaking.cancel();
    if (next < 0 || next >= TOUR.length) { onClose(); return; }
    setIndex(next);
  }, [speaking, onClose]);

  // Fly the camera whenever the stop changes.
  useEffect(() => { onFocus(stop.landmarkId); }, [index, stop.landmarkId, onFocus]);

  // Translate ahead of the visitor when a model is awake, so a stop is rarely waiting.
  useEffect(() => {
    if (!needsTranslation || !townAI.awake) return;
    let cancelled = false;
    const wanted = [index, index + 1].filter((i) => i < TOUR.length && translations[i] === undefined);
    if (wanted.length === 0) return;
    if (wanted.includes(index)) setTranslating(true);

    (async () => {
      for (const i of wanted) {
        const out = await townAI.ask([
          {
            role: 'system',
            content:
              `Translate the visitor's tour narration into ${lang.english} (${lang.native}). ` +
              `Keep it warm and spoken, the same length, and reply with the translation only, with ` +
              `no preamble, no quotes, no English.`,
          },
          { role: 'user', content: TOUR[i].narration },
        ], { maxTokens: 300, temperature: 0.3 });

        if (cancelled) return;
        const cleaned = out?.replace(/^["'\s]+|["'\s]+$/g, '').trim();
        // A reply still in Latin script means the model did not switch language; English is
        // more use than a confident-sounding wrong answer.
        const ok = !!cleaned && (cleaned.match(/[^\x00-\x7F]/g)?.length ?? 0) > cleaned.length * 0.3;
        if (ok) setTranslations((t) => ({ ...t, [i]: cleaned! }));
        if (i === index) setTranslating(false);
      }
    })().catch(() => setTranslating(false));

    return () => { cancelled = true; };
  }, [index, needsTranslation, townAI, lang, translations]);

  // Narrate the current stop, and move on when it finishes, or when a reader would have.
  useEffect(() => {
    if (paused || translating) return;
    clearTimer();
    if (voice) speaking.speak(spokenText, translated ? townAI.language : 'en-IN');
    timerRef.current = setTimeout(() => setIndex((i) => (i + 1 < TOUR.length ? i + 1 : i)), readMs(spokenText));
    return clearTimer;
    // Re-narrating on every render would stutter; this fires once per stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, translating, spokenText, translated, voice]);

  useEffect(() => () => { clearTimer(); speaking.cancel(); }, [speaking]);

  const last = index === TOUR.length - 1;
  const progress = useMemo(() => ((index + 1) / TOUR.length) * 100, [index]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0b1020]/95 p-5 shadow-2xl backdrop-blur">
        <div className="mb-3 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#FF9933,#fcd34d,#138808)' }}
          />
        </div>

        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/35">
            Stop {index + 1} of {TOUR.length}
          </span>
          {needsTranslation && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
              translated
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/15 text-white/40'
            }`}>
              {translating
                ? `translating into ${lang.native}…`
                : translated
                  ? `in ${lang.native}`
                  : townAI.awake ? 'English · translation unavailable' : 'English · wake the AI for your language'}
            </span>
          )}
          {!voice && (
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/40">
              no voice installed · read along
            </span>
          )}
        </div>

        <h3 className="mb-1.5 text-xl font-bold text-white">{stop.title}</h3>
        <p className="mb-4 text-[15px] leading-relaxed text-white/80">{spokenText}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            ← Back
          </button>
          <button
            onClick={() => { setPaused((p) => !p); if (!paused) speaking.cancel(); }}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={() => go(index + 1)}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            {last ? 'Finish' : 'Next →'}
          </button>
          <button
            onClick={() => { clearTimer(); speaking.cancel(); onClose(); }}
            className="ml-auto rounded-lg px-3 py-2 text-sm text-white/45 hover:text-white"
          >
            Skip the tour
          </button>
        </div>
      </div>
    </div>
  );
}
