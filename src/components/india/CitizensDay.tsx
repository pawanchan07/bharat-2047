'use client';

/**
 * A day in the life of one citizen.
 *
 * The town has three working systems and, until now, no reason to think of them as one
 * person's life. This walks Kamla Devi — or whoever you pick — from dawn to dusk through
 * all three: the desk in the morning, the bank at midday, the booth in the evening. The
 * light moves with her, because a day that never changes is not a day.
 *
 * It is a frame around the systems, not a replacement for them: each chapter offers to walk
 * in, and what happens inside is the real thing, recorded by the town like any other visit.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { PEOPLE, accountForPerson, useTownState } from './TownState';
import { useTownAI } from './ai/TownAI';
import { SpeakButton } from './ai/VoiceInput';

export type DaySystem = 'panchayat' | 'bank' | 'voting' | null;

interface Chapter {
  /** Hour of the day, for the light. */
  hour: number;
  clock: string;
  title: string;
  /** Which building the camera looks at. */
  landmarkId: string | null;
  /** Which system this chapter invites you into. */
  system: DaySystem;
  enter?: string;
  text: (name: string, account: string) => string;
}

const CHAPTERS: Chapter[] = [
  {
    hour: 6, clock: '06:10', title: 'Before the queue forms',
    landmarkId: null, system: null,
    text: (name) =>
      `${name} is already awake. In most versions of this story the day ends with her being told to come back on Thursday — and coming back on Thursday, and then again the Thursday after. Watch what a different set of decisions does to the same day.`,
  },
  {
    hour: 10, clock: '10:00', title: 'The panchayat, first thing',
    landmarkId: 'panchayat', system: 'panchayat',
    enter: 'Walk in with her',
    text: (name) =>
      `She cannot fill a form, so she says the problem out loud. The desk hears her in her own language, checks her actual record rather than asking her to prove it, and — because the finding is adverse — refuses to decide it alone. ${name} leaves with a case number instead of an instruction to come back.`,
  },
  {
    hour: 14, clock: '14:00', title: 'The bank, after the heat',
    landmarkId: 'bank', system: 'bank',
    enter: 'Look at the books with her',
    text: (name, account) =>
      `Her pension lands in ${account} at this bank — when it lands. Nobody here can read her balance, including the regulator auditing the place while she stands in it. That is not a courtesy; it is the arithmetic. Solvency, exposure and most of the fraud are provable without her account ever being opened.`,
  },
  {
    hour: 18, clock: '18:30', title: 'The booth, before it closes',
    landmarkId: 'voting', system: 'voting',
    enter: 'Vote with her',
    text: (name) =>
      `Polling closes at seven. ${name} votes, and the record will know a valid citizen voted and never that it was her. If anybody rewrites it afterwards, every block built on top of the lie says so on its face — no auditor has to be trusted, and no one has to be literate to be counted.`,
  },
  {
    hour: 21, clock: '21:00', title: 'The same day, differently',
    landmarkId: null, system: null,
    text: (name) =>
      `Three systems, one day, and not one of them asked ${name} to read, to travel twice, or to trust an official's word. That is the whole argument of this town. Everything you just watched runs for real — go and take any of it apart.`,
  },
];

export function CitizensDay({
  onFocus, onEnter, onClose,
}: {
  onFocus: (landmarkId: string | null) => void;
  onEnter: (system: Exclude<DaySystem, null>) => void;
  onClose: () => void;
}) {
  const { setHourOverride } = useGame();
  const townAI = useTownAI();
  const town = useTownState();
  const [personIdx, setPersonIdx] = useState(0);
  const [index, setIndex] = useState(0);

  const person = PEOPLE[personIdx];
  const account = accountForPerson(person.id);
  const chapter = CHAPTERS[index];
  const body = chapter.text(person.name, account);

  // The light follows the story, and is handed back when the story ends.
  useEffect(() => { setHourOverride(chapter.hour); }, [chapter.hour, setHourOverride]);
  useEffect(() => () => { setHourOverride(null); }, [setHourOverride]);
  useEffect(() => { onFocus(chapter.landmarkId); }, [index, chapter.landmarkId, onFocus]);

  const close = useCallback(() => { setHourOverride(null); onClose(); }, [setHourOverride, onClose]);

  const done = town.forPerson(person.id);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0b1020]/96 p-5 shadow-2xl backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-500 px-2.5 py-1 font-mono text-xs font-bold text-black">
            {chapter.clock}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/35">
            A day with {person.name} · {index + 1} of {CHAPTERS.length}
          </span>
          {done.length > 0 && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              {done.length} thing{done.length === 1 ? '' : 's'} done today
            </span>
          )}
        </div>

        <h3 className="mb-1.5 text-xl font-bold text-white">{chapter.title}</h3>
        <p className="mb-4 text-[15px] leading-relaxed text-white/80">{body}</p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chapter.system && chapter.enter && (
            <button
              onClick={() => onEnter(chapter.system as Exclude<DaySystem, null>)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              {chapter.enter} →
            </button>
          )}
          <button
            onClick={() => (index + 1 < CHAPTERS.length ? setIndex(index + 1) : close())}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              chapter.system
                ? 'border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                : 'bg-amber-500 text-black hover:bg-amber-400'
            }`}
          >
            {index + 1 < CHAPTERS.length ? 'Later that day →' : 'Finish'}
          </button>
          <button
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            ← Back
          </button>
          <SpeakButton text={body} language={townAI.language} label="Hear it" />
          <button onClick={close} className="ml-auto rounded-lg px-3 py-2 text-sm text-white/45 hover:text-white">
            Leave her to it
          </button>
        </div>

        {/* Who you are following. Changing person restarts the day, which is the point. */}
        <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-white/25">Follow</span>
          {PEOPLE.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setPersonIdx(i); setIndex(0); }}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                i === personIdx
                  ? 'border-amber-400 bg-amber-500 font-semibold text-black'
                  : 'border-white/15 bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
