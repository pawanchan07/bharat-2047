'use client';

/**
 * "Does this need a blockchain?": the seven-question test, run against the visitor's own
 * problem instead of against mine.
 *
 * This is the most contrarian screen in the town and the reason it exists. Anyone can build
 * a thing and then explain why the thing was necessary. The harder, more useful claim is
 * knowing when not to: for almost every case a visitor brings, the honest answer here is
 * "a database with an append-only audit log", and the tool says so plainly rather than
 * steering them toward the technology this project is best known for.
 *
 * The verdicts are not a score. Each gate rules out a *different* architecture, so the tool
 * reports the first decisive failure, the one that actually settles it, and names the
 * cheaper thing that would win instead. The doctrine behind it is in VISION.md.
 */

import React, { useMemo, useState } from 'react';

type Answer = 'yes' | 'no' | null;

interface Gate {
  id: string;
  question: string;
  /** What a "no" here actually means, shown once the visitor has answered. */
  hint: string;
}

const GATES: Gate[] = [
  {
    id: 'multiWriter',
    question: 'Does more than one party write to this record?',
    hint: 'One writer means there is no disagreement to resolve, and nothing for a consensus protocol to do.',
  },
  {
    id: 'distrust',
    question: 'Do those parties actually distrust each other?',
    hint: 'Parties who trust each other can share a database. Consensus is expensive precisely because it survives bad faith.',
  },
  {
    id: 'noOperator',
    question: 'Is there no third party all of them would accept as the operator?',
    hint: 'If a regulator, a registrar or a bank is acceptable to everyone, use them, and make them auditable.',
  },
  {
    id: 'laterCheck',
    question: 'Must someone check this later who was not there when it was written?',
    hint: 'If the only readers were present at the write, they already know what happened.',
  },
  {
    id: 'quietEditFatal',
    question: 'Would a quiet edit to it be catastrophic?',
    hint: 'If an undetected change is survivable, you are paying for tamper-evidence you do not need.',
  },
  {
    id: 'throughputOk',
    question: 'Can you live with the write throughput and the irreversibility?',
    hint: 'No chain does the volume India runs, and none of them will. Irreversible also means no chargeback.',
  },
  {
    id: 'noPersonalData',
    question: 'Can the record itself hold no personal data at all?',
    hint: 'A record that cannot forget is incompatible with the right to erasure under the DPDP Act.',
  },
];

type Answers = Record<string, Answer>;

interface Verdict {
  headline: string;
  build: string;
  body: string;
  tone: 'chain' | 'anchor' | 'evidence' | 'database' | 'incomplete';
  /** Which system in this town already made the same call. */
  precedent?: string;
}

/**
 * The gates fail in order of how decisively they settle the question, not in the order they
 * are asked. A single writer ends the argument no matter what the other six say.
 */
function decide(a: Answers): Verdict {
  const unanswered = GATES.filter((g) => a[g.id] === null);
  if (unanswered.length > 0) {
    return {
      tone: 'incomplete',
      headline: `${unanswered.length} still to answer`,
      build: '',
      body: 'A chain earns its cost only when all seven hold. One honest "no" is enough to settle it, so the answer usually arrives before the last question.',
    };
  }

  const no = (id: string) => a[id] === 'no';

  if (no('laterCheck') && no('quietEditFatal')) {
    return {
      tone: 'database',
      headline: 'A plain database',
      build: 'Postgres. Nothing else.',
      body: 'Nobody needs to check this after the fact and a quiet edit would not hurt. You do not even need an audit log, let alone a hash chain. Anything more is cost with no property attached to it.',
    };
  }

  if (no('multiWriter')) {
    return {
      tone: 'evidence',
      headline: 'Tamper-evidence, not a blockchain',
      build: 'A hash-chained append-only log. SHA-256 and a database column.',
      body: 'One party writes, so there is no disagreement for consensus to resolve. What you actually want is the property people mistake for blockchain: an outsider being able to prove the record was not quietly edited. That costs a hash function and no network at all.',
      precedent: 'The AI Panchayat Kendra does exactly this: every case decision chained to the last, one office writing.',
    };
  }

  if (no('distrust')) {
    return {
      tone: 'evidence',
      headline: 'A shared database with an audit log',
      build: 'One database, several writers, hash-chained history.',
      body: 'Several parties write, but they trust each other. Consensus protocols exist to survive bad faith; paying for one where there is none buys latency and energy in exchange for nothing. Keep the tamper-evident history so the trust stays checkable.',
    };
  }

  if (no('noOperator')) {
    return {
      tone: 'evidence',
      headline: 'Use the operator, and make them provable',
      build: 'The trusted party signs; everyone else verifies against a published key.',
      body: 'If everyone would accept a registrar, a regulator or a university as the operator, removing them is a solution to a problem you do not have. Have them sign what they assert, publish the key, and let anybody check it offline. That is a signature, not a ledger.',
      precedent: 'The National Digital School is this case: the university is trusted to issue, so the product is only that its signature is checkable by anyone, forever, with no call to it.',
    };
  }

  if (no('quietEditFatal') || no('laterCheck')) {
    return {
      tone: 'database',
      headline: 'A shared database',
      build: 'One store the parties agree on, with ordinary access control.',
      body: 'The multi-party, low-trust part is real, but nothing here turns on catching a silent change after the fact. That is the only thing the extra machinery buys you, so skip it until it is load-bearing.',
    };
  }

  if (no('throughputOk')) {
    return {
      tone: 'anchor',
      headline: 'Anchoring: the data off-chain, the proof on it',
      build: 'Batch the records, build a Merkle root, commit one root per interval.',
      body: 'The case is real but the volume or the irreversibility is not survivable at full fidelity. One on-chain write can cover millions of off-chain records, and each of them still gets an inclusion proof. India runs billions of payment transactions a month; this is the only architecture that meets that and stays honest about it.',
      precedent: 'The school demonstrates the same shape at document scale: eleven fields, one signed root.',
    };
  }

  if (no('noPersonalData')) {
    return {
      tone: 'anchor',
      headline: 'A chain, but never with the data on it',
      build: 'Salted hashes and commitments on the record; the values stay with the person.',
      body: 'Everything else passes, so the ledger is justified, and the moment personal data touches it you have built something incompatible with the right to erasure. Put salted hashes on the record and let the holder keep the salt. Destroying a salt makes a leaf unopenable, which is as close to deletion as an immutable record gets. Be honest that it is rendering-unreadable rather than deleting.',
      precedent: 'The bank and the school both do this: commitments and salted leaves on the record, values with the person.',
    };
  }

  return {
    tone: 'chain',
    headline: 'This one earns a chain',
    build: 'Decentralised consensus, and the governance question of who validates.',
    body: 'All seven hold, which is rare. Note what is left even so: the hardest part is now political rather than cryptographic, because whoever runs the validators is the security model. And a chain still proves only that nobody edited the record afterwards. It says nothing about whether it was true when written.',
    precedent: 'The Digital Voting Centre is the one system here that passes: candidates genuinely distrust each other and there is no operator all sides would accept.',
  };
}

/** Cases worth loading, chosen because the honest answer surprises people. */
const PRESETS: { name: string; note: string; answers: Answers }[] = [
  {
    name: 'A degree certificate',
    note: 'The obvious blockchain case, and it is not one',
    answers: { multiWriter: 'yes', distrust: 'yes', noOperator: 'no', laterCheck: 'yes', quietEditFatal: 'yes', throughputOk: 'yes', noPersonalData: 'no' },
  },
  {
    name: 'A national election',
    note: 'The rare case that passes',
    answers: { multiWriter: 'yes', distrust: 'yes', noOperator: 'yes', laterCheck: 'yes', quietEditFatal: 'yes', throughputOk: 'yes', noPersonalData: 'yes' },
  },
  {
    name: 'Land mutation records',
    note: 'Passes, but only for the part after adjudication',
    answers: { multiWriter: 'yes', distrust: 'yes', noOperator: 'yes', laterCheck: 'yes', quietEditFatal: 'yes', throughputOk: 'yes', noPersonalData: 'no' },
  },
  {
    name: 'Cross-border shipping, four firms',
    note: 'It passes, and the chain still cannot see the factory floor',
    answers: { multiWriter: 'yes', distrust: 'yes', noOperator: 'yes', laterCheck: 'yes', quietEditFatal: 'yes', throughputOk: 'yes', noPersonalData: 'yes' },
  },
  {
    name: 'A company expense log',
    note: 'What most "blockchain for X" pitches actually are',
    answers: { multiWriter: 'yes', distrust: 'no', noOperator: 'no', laterCheck: 'yes', quietEditFatal: 'yes', throughputOk: 'yes', noPersonalData: 'no' },
  },
  {
    name: 'Patient health records',
    note: 'The one where immutability is the danger',
    answers: { multiWriter: 'yes', distrust: 'yes', noOperator: 'yes', laterCheck: 'yes', quietEditFatal: 'yes', throughputOk: 'yes', noPersonalData: 'no' },
  },
];

const EMPTY: Answers = Object.fromEntries(GATES.map((g) => [g.id, null]));

const TONE: Record<Verdict['tone'], { ring: string; text: string; chip: string }> = {
  chain: { ring: 'border-amber-400/50 bg-amber-500/[0.12]', text: 'text-amber-200', chip: 'bg-amber-500 text-black' },
  anchor: { ring: 'border-cyan-400/40 bg-cyan-500/[0.09]', text: 'text-cyan-200', chip: 'bg-cyan-400 text-black' },
  evidence: { ring: 'border-emerald-400/40 bg-emerald-500/[0.09]', text: 'text-emerald-200', chip: 'bg-emerald-400 text-black' },
  database: { ring: 'border-white/20 bg-white/[0.05]', text: 'text-white/80', chip: 'bg-white/80 text-black' },
  incomplete: { ring: 'border-white/12 bg-white/[0.03]', text: 'text-white/60', chip: 'bg-white/20 text-white/70' },
};

export function ChainTest() {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [loaded, setLoaded] = useState<string | null>(null);

  const verdict = useMemo(() => decide(answers), [answers]);
  const passed = GATES.filter((g) => answers[g.id] === 'yes').length;
  const answered = GATES.filter((g) => answers[g.id] !== null).length;
  const tone = TONE[verdict.tone];

  const set = (id: string, v: Answer) => {
    setLoaded(null);
    setAnswers((prev) => ({ ...prev, [id]: prev[id] === v ? null : v }));
  };

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold">Does your case need a blockchain?</h3>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white/40">
          RUN IT YOURSELF
        </span>
      </div>
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-white/50">
        Answer for something you are actually thinking about building. It will usually tell you no,
        and name the cheaper thing that would beat it, which is the point. Load one of mine if you
        would rather see the reasoning first.
      </p>

      {/* ------------------------------------------------------------ presets */}
      <div className="mb-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => { setAnswers(p.answers); setLoaded(p.name); }}
            title={p.note}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              loaded === p.name
                ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                : 'border-white/12 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => { setAnswers(EMPTY); setLoaded(null); }}
          className="rounded-lg px-3 py-1.5 text-xs text-white/35 hover:text-white/70"
        >
          Clear
        </button>
      </div>
      {loaded && (
        <p className="-mt-3 mb-5 text-xs text-white/40">
          {PRESETS.find((p) => p.name === loaded)?.note}. Change any answer and the verdict moves with it.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- gates */}
        <div className="space-y-2">
          {GATES.map((g, i) => {
            const a = answers[g.id];
            return (
              <div
                key={g.id}
                className={`rounded-xl border p-3 transition-colors ${
                  a === 'no' ? 'border-red-500/35 bg-red-500/[0.07]'
                    : a === 'yes' ? 'border-emerald-400/30 bg-emerald-500/[0.06]'
                      : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-white/25">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-snug text-white/85">{g.question}</div>
                    {a === 'no' && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-red-200/70">{g.hint}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(['yes', 'no'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => set(g.id, v)}
                        aria-pressed={a === v}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors ${
                          a === v
                            ? v === 'yes' ? 'bg-emerald-400 text-black' : 'bg-red-500 text-white'
                            : 'border border-white/12 text-white/40 hover:border-white/30 hover:text-white/80'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* -------------------------------------------------------- verdict */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className={`rounded-2xl border p-5 ${tone.ring}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${tone.chip}`}>
                {verdict.tone === 'incomplete' ? 'IN PROGRESS' : verdict.tone === 'chain' ? 'NEEDS A CHAIN' : 'NO BLOCKCHAIN'}
              </span>
              <span className="font-mono text-[11px] text-white/35">
                {answered === GATES.length ? `${passed} of 7 gates passed` : `${answered} of 7 answered`}
              </span>
            </div>

            <div className={`mb-1 text-lg font-bold ${tone.text}`}>{verdict.headline}</div>
            {verdict.build && (
              <div className="mb-3 font-mono text-[11px] leading-relaxed text-white/45">{verdict.build}</div>
            )}
            <p className="text-sm leading-relaxed text-white/60">{verdict.body}</p>

            {verdict.precedent && (
              <p className="mt-3 border-t border-white/10 pt-3 text-[12px] leading-relaxed text-white/45">
                <span className="text-white/60">In this town: </span>
                {verdict.precedent}
              </p>
            )}
          </div>

          {answered === GATES.length && verdict.tone !== 'chain' && (
            <p className="mt-3 px-1 text-[12px] leading-relaxed text-white/35">
              This is the answer for three of the four systems in this town too. It is not a
              disappointing result. It is a cheaper, faster, more correctable system that keeps the
              one property you actually wanted.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
