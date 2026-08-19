'use client';

/**
 * The intent behind Bharat 2047, stated in the prototype rather than left implicit.
 *
 * The vision's rule is "state the intent, everywhere": this is not a neutral tech demo,
 * it is an argument about how India should work in 2047, made both aesthetically and
 * technically. This screen is the long form of that argument. Every system's side rail
 * carries a short version that opens it.
 */

import React from 'react';

export const REPO_URL = 'https://github.com/pawanchan07/bharat-2047';

type Status = 'live' | 'next' | 'planned';

const ROADMAP: { n: number; name: string; status: Status; line: string }[] = [
  { n: 1, name: 'Digital Voting Centre', status: 'live', line: 'A vote sealed with real SHA-256, mined with real proof-of-work, and a tamper attack you can actually perform.' },
  { n: 2, name: 'AI Panchayat Kendra', status: 'live', line: 'Any problem, in any language, understood by a classifier trained in your browser — and handed to a human the moment it should be.' },
  { n: 3, name: 'Bank of Bharat', status: 'next', line: 'Every transaction on an auditable ledger. Regulators see the books in real time; no loan quietly vanishes.' },
  { n: 4, name: 'Education records', status: 'planned', line: 'Marksheets and degrees anchored to decentralized storage. Any employer verifies one in seconds; nobody forges one.' },
  { n: 5, name: 'AI Safety Command', status: 'planned', line: 'Cameras that detect an incident and dispatch the nearest responder — and log every single access to the footage on an audit chain.' },
  { n: 6, name: 'Smart Waste Network', status: 'planned', line: 'Bins that call the municipality before they overflow, and thermal sensors that raise an alarm when something alive is inside one.' },
  { n: 7, name: 'Smart Mobility Hub', status: 'planned', line: 'Buses and trains a family can plan a day around. One ticket, live positions, routes that answer demand.' },
  { n: 8, name: 'Health & insurance', status: 'planned', line: 'AI triage for villages, records the patient owns, and claims settled where they cannot silently disappear.' },
  { n: 9, name: 'Internet & digital rights', status: 'planned', line: 'Public connectivity, digital identity, and what a citizen is actually owed over their own data.' },
  { n: 10, name: 'Policy transparency', status: 'planned', line: 'How a budget is proposed, argued, voted and tracked — visible to the people paying for it.' },
];

const STATUS_CHIP: Record<Status, { label: string; cls: string }> = {
  live: { label: 'LIVE', cls: 'bg-emerald-400 text-black' },
  next: { label: 'NEXT', cls: 'bg-amber-400 text-black' },
  planned: { label: 'PLANNED', cls: 'bg-white/10 text-white/60' },
};

const PRINCIPLES = [
  {
    icon: '⚙️',
    title: 'It has to actually run',
    body: 'Not a mockup, not a video, not a click-through. The mechanism executes in your browser while you watch — real hashing, real mining, a real classifier really trained on real data. If a system cannot be made to genuinely work, it does not get built yet.',
  },
  {
    icon: '🫱',
    title: 'It has to say what is not real',
    body: 'Every system carries a panel naming exactly which layer is genuine and which is staged, and an honest caveat listing what a real deployment would still need. A prototype that oversells itself is worth nothing to the argument it is trying to make.',
  },
  {
    icon: '🚶‍♀️',
    title: 'It has to be about a person',
    body: 'Kamla Devi, 67, whose pension stopped because a bank field nobody checked was empty. Every journey follows a named citizen with a real record, because a civic system is only ever as good as what it does for the person standing in front of it.',
  },
];

export function Intent({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-[#070c1a] text-white overflow-y-auto">
      <style>{`
        @keyframes it-rise { 0% { transform: translateY(14px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        .it-rise { animation: it-rise .55s cubic-bezier(.2,.7,.3,1); }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-[#070c1a]/95 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🇮🇳</span>
          <div className="text-sm font-semibold tracking-wide">
            The intent behind <span className="text-amber-400">Bharat 2047</span>
          </div>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm">
          ← Back to town
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* ---------------------------------------------------------- hero */}
        <div className="it-rise">
          <div className="text-[11px] tracking-[0.25em] text-amber-400/80 mb-5">A WORKING ARGUMENT, NOT A MOOD BOARD</div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.08] tracking-tight mb-6">
            This is how I want to see<br />
            <span className="text-amber-400">Bharat in 2047</span> — and I would<br />
            rather show you than tell you.
          </h1>

          {/* A tricolour rule. One small nod, used once. */}
          <div className="flex h-1 w-40 rounded-full overflow-hidden mb-8">
            <div className="flex-1 bg-[#FF9933]" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-[#138808]" />
          </div>

          <div className="space-y-5 text-lg text-white/70 leading-relaxed max-w-3xl">
            <p>
              India in 2047 will not be decided by whether we can imagine better civic systems. We can.
              Everyone can. It will be decided by whether anyone can show, concretely, that the better
              version <span className="text-white">works</span> — that it is buildable, auditable, and
              honest about where it fails.
            </p>
            <p>
              So this is a town you can walk around, where the civic systems are not drawings. Click the
              polling booth and cast a vote that is really hashed and really mined, then try to rig the
              chain and watch it break in front of you. Walk into the panchayat and describe a problem in
              Hindi, Hinglish or English, and watch a classifier that was trained in your browser a moment
              ago show its working, tell you how confident it is, and refuse to act when it should not.
            </p>
            <p>
              The aesthetic argument and the technical argument are the same argument. A civic system that
              is unpleasant to use is not neutral — it is a system that quietly excludes people. So this is
              built to be beautiful <i>and</i> to be correct, and neither one is allowed to excuse the other.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3 text-sm">
            <div className="w-9 h-9 rounded-full bg-amber-400 text-black grid place-items-center font-bold">P</div>
            <div>
              <div className="font-semibold">Pawanchander Komuravelli</div>
              <div className="text-white/40">Product manager and builder · aspiring AI PM</div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- the standard */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold mb-2">The standard every system is held to</h2>
          <p className="text-white/50 mb-8 max-w-2xl">
            The voting centre set these three rules by being built first. Nothing joins the town without meeting them.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="text-3xl mb-3">{p.icon}</div>
                <div className="font-semibold mb-2">{p.title}</div>
                <p className="text-sm text-white/55 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- roadmap */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold mb-2">The town, as it is meant to end up</h2>
          <p className="text-white/50 mb-8 max-w-2xl">
            One system at a time, at full depth, until the answer to &ldquo;how should this work in India?&rdquo;
            is <span className="text-white/80">click the building and see</span>. Two are finished. The rest are
            the plan, published so you can hold me to it.
          </p>
          <div className="space-y-2">
            {ROADMAP.map((r) => (
              <div
                key={r.n}
                className={`flex gap-4 p-4 rounded-xl border transition-colors ${
                  r.status === 'live'
                    ? 'bg-emerald-400/[0.07] border-emerald-400/25'
                    : 'bg-white/[0.03] border-white/8 hover:border-white/20'
                }`}
              >
                <div className={`shrink-0 w-8 h-8 rounded-lg grid place-items-center text-sm font-bold ${
                  r.status === 'live' ? 'bg-emerald-400 text-black' : 'bg-white/8 text-white/40'
                }`}>
                  {r.n}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold">{r.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_CHIP[r.status].cls}`}>
                      {STATUS_CHIP[r.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed">{r.line}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- what it isn't */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold mb-2">What this is not</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="p-5 rounded-2xl bg-red-500/[0.07] border border-red-500/20">
              <div className="font-semibold mb-2 text-red-300">Not a policy proposal</div>
              <p className="text-sm text-white/55 leading-relaxed">
                Real reform needs law, budgets, procurement, unions, elections and the patience to survive all
                of them. I am not pretending a prototype substitutes for any of that. I am arguing about what
                the built thing at the end should look like.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-red-500/[0.07] border border-red-500/20">
              <div className="font-semibold mb-2 text-red-300">Not a claim that technology fixes governance</div>
              <p className="text-sm text-white/55 leading-relaxed">
                It mostly does not. Which is exactly why the most important screen in this whole town is the
                one where the AI stops and hands the decision to an elected human — and says out loud why.
              </p>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- open source */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold mb-2">Open, so you can check it</h2>
          <p className="text-white/60 leading-relaxed max-w-3xl mb-6">
            Every claim on these screens is checkable, because the source is public. The training corpus is
            120 readable lines you can disagree with. The eligibility rules are a list you can audit. The
            accuracy number has a button that recomputes it on your machine. Nothing is behind an API where
            you would have to take my word for it.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-amber-400/50 transition-colors block"
            >
              <div className="font-semibold mb-1">Read the source →</div>
              <p className="text-sm text-white/50">
                github.com/pawanchan07/bharat-2047 — the whole town, both engines, and this sentence.
              </p>
            </a>
            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="font-semibold mb-1">Standing on open source</div>
              <p className="text-sm text-white/50">
                The living isometric world is{' '}
                <a href="https://github.com/amilich/isometric-city" target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">
                  IsoCity
                </a>
                , used under its MIT licence. The cryptography is the browser&apos;s own Web Crypto. The
                classifier is written from scratch and kept small enough to read.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-20 pt-8 border-t border-white/10 flex flex-wrap gap-3 items-center justify-between">
          <p className="text-white/35 text-sm max-w-lg">
            Built by one person, in the open, one system at a time. If you think a system here is wrong,
            the repo takes issues.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0"
          >
            Go explore the town →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The short version, for a system's side rail. Same argument, four lines,
 * with a way through to the long form.
 */
export function IntentCard({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/15 to-transparent border border-amber-500/25">
      <div className="flex h-0.5 w-16 rounded-full overflow-hidden mb-3">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>
      <div className="font-semibold mb-1">Why this exists</div>
      <p className="text-sm text-white/60 leading-relaxed">
        This is how I want to see Bharat in 2047 — argued technically, not just drawn. Which is why this
        system really runs in front of you instead of being a screenshot.
      </p>
      {onOpen && (
        <button onClick={onOpen} className="mt-3 text-sm text-amber-300 hover:text-amber-200 font-medium">
          Read the full intent →
        </button>
      )}
    </div>
  );
}
