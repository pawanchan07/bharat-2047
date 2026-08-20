'use client';

/**
 * The two controls every AI surface in the town shares: which language you are speaking,
 * and whether the town's brain is awake.
 *
 * Both are written so that the *off* states are designed rather than apologised for. A
 * device with no WebGPU gets a clear explanation and a working page; a visitor on mobile
 * data is told the size before anything is fetched.
 */

import React from 'react';
import { LANGUAGES } from './languages';
import { useTownAI } from './TownAI';

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useTownAI();
  return (
    <div>
      {!compact && (
        <div className="text-xs uppercase tracking-widest text-white/35 mb-2">
          Speak to the town in
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map((l) => {
          const active = l.code === language;
          return (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              aria-pressed={active}
              title={l.english}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-amber-500 border-amber-400 text-black font-semibold'
                  : 'bg-white/5 border-white/15 text-white/70 hover:border-amber-400/50 hover:text-white'
              }`}
            >
              {l.native}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A one-line badge for headers: what the brain is doing right now. */
export function BrainBadge() {
  const { status, progress, model } = useTownAI();
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {model.label} model awake
      </span>
    );
  }
  if (status === 'downloading') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
        Waking… {Math.round(progress * 100)}%
      </span>
    );
  }
  return null;
}

/**
 * The opt-in. Nothing here downloads until the button is pressed, and the size is on the
 * button rather than buried in a tooltip.
 */
export function AwakenBrain({ reason }: { reason?: string }) {
  const {
    status, progress, progressText, error, model, models, setModel, cachedIds,
    metered, gpuReason, awaken, cancel, sleep,
  } = useTownAI();

  const cached = cachedIds.includes(model.id);

  // ------------------------------------------------------------- unsupported
  if (status === 'unsupported') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-1 font-semibold text-white/80">The town&apos;s brain cannot run here 🧠</div>
        <p className="text-sm text-white/50">
          {gpuReason ?? 'This device has no WebGPU.'} The model runs on your own graphics card;
          there is no server to fall back to, by design.
        </p>
        <p className="mt-2 text-sm text-white/50">
          Nothing on this page is lost. The classifier, the rules and the routing gates are the
          parts that actually decide anything, and they run everywhere.
        </p>
      </div>
    );
  }

  // --------------------------------------------------------------- ready
  if (status === 'ready') {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 font-semibold text-emerald-300">The town&apos;s brain is awake 🧠</div>
            <p className="text-sm text-white/60">
              {model.label} · Qwen2.5 · Apache-2.0 · running on your graphics card. Nothing you say
              leaves this browser.
            </p>
          </div>
          <button
            onClick={sleep}
            className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
          >
            Put it to sleep
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ downloading
  if (status === 'downloading') {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="font-semibold text-amber-300">Waking the town&apos;s brain…</span>
          <span className="font-mono text-sm tabular-nums text-amber-200">{Math.round(progress * 100)}%</span>
        </div>
        <div
          className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Downloading the model"
        >
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-out"
            style={{
              width: `${Math.max(2, progress * 100)}%`,
              background: 'linear-gradient(90deg, #FF9933 0%, #fcd34d 60%, #138808 100%)',
            }}
          />
        </div>
        <p className="truncate text-xs text-white/45">{progressText || 'Fetching weights…'}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={cancel}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <span className="text-[11px] text-white/35">
            Cancelling keeps whatever arrived, and resuming later carries on from here.
          </span>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------- asleep / error
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-1 font-semibold text-white/85">Awaken the town&apos;s AI 🧠</div>
      <p className="mb-3 text-sm text-white/50">
        {reason ?? 'Optional. An open-weights model downloads once and then runs entirely on your own machine: no key, no account, nothing sent anywhere.'}
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {models.map((m) => {
          const active = m.id === model.id;
          const have = cachedIds.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              aria-pressed={active}
              className={`rounded-xl border p-3 text-left transition-colors ${
                active
                  ? 'border-amber-400/60 bg-amber-500/10'
                  : 'border-white/12 bg-white/[0.02] hover:border-white/30'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-white/90">{m.label}</span>
                <span className={`font-mono text-xs ${have ? 'text-emerald-300' : 'text-white/45'}`}>
                  {have ? 'downloaded' : `${m.downloadMB} MB`}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">{m.blurb}</p>
            </button>
          );
        })}
      </div>

      {metered && !cached && (
        <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/[0.07] p-2.5 text-xs text-amber-200/90">
          You look to be on a slow or metered connection. {model.downloadMB} MB is a lot to spend
          there. The Light model, or skipping this entirely, may be the better call.
        </p>
      )}

      <button
        onClick={awaken}
        className="w-full rounded-xl bg-amber-500 px-5 py-3 font-bold text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400"
      >
        {cached ? `Awaken the town's AI 🧠 · already downloaded` : `Awaken the town's AI 🧠 · ${model.downloadMB} MB`}
      </button>

      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        What it is allowed to do is deliberately narrow. The classifier, the eligibility rules
        and the routing gates still decide every case. They are auditable and they are the
        actual claim. The model gives a second reading beside them and puts the verdict into
        your language. Where the two disagree, you see the disagreement and the engine wins.
      </p>
    </div>
  );
}
