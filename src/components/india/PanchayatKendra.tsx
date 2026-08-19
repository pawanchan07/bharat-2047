'use client';

/**
 * AI Panchayat Kendra — a working AI-assisted grievance desk.
 *
 * The classifier is trained in your browser when this screen opens, on the 80-line
 * corpus in panchayat.ts. Every confidence number, every eligibility check and every
 * routing decision on screen is computed live from what you type. Nothing is
 * pre-recorded and there is no API call.
 *
 * The product argument the screen is making: the interesting part of civic AI is not
 * the answer, it is the gate. Read the "Human review" step — the engine hands over
 * whenever it is unsure, out of vocabulary, missing evidence, or looking at a class of
 * case software has no business deciding.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AUTO_THRESHOLD, CITIZENS, CORPUS, Citizen, CaseDecision, CaseRecord, Classification,
  DECISION_LABEL, Draft, Entities, Finding, INTENTS, INTENT_IDS, IntentId, LooResult,
  Routing, SchemeVerdict, TrainedModel, caseId, classify, diagnose, draftApplication,
  evaluateSchemes, extractEntities, leaveOneOut, routeCase, sealCase, trainClassifier,
} from './panchayat';
import { IntentCard } from './Intent';
import { ArrivalScene } from './ArrivalScene';
import { useTownAI } from './ai/TownAI';
import { AwakenBrain, BrainBadge, LanguagePicker } from './ai/AiControls';
import { VoiceInput, SpeakButton } from './ai/VoiceInput';
import { languageFor } from './ai/languages';
import { SecondOpinion, secondOpinion, spokenVerdict, templateVerdict } from './ai/panchayatBrain';

type Step = 'arrive' | 'listen' | 'understand' | 'checks' | 'draft' | 'review' | 'route' | 'register';

const STEPS: { key: Step; label: string }[] = [
  { key: 'arrive', label: 'Arrive' },
  { key: 'listen', label: 'Listen' },
  { key: 'understand', label: 'Understand' },
  { key: 'checks', label: 'Check record' },
  { key: 'draft', label: 'Draft' },
  { key: 'review', label: 'Human review' },
  { key: 'route', label: 'Route & seal' },
  { key: 'register', label: 'Register' },
];

const PANCHAYAT_MEMBER = 'Shanti Devi (Ward Member, Rampur)';
const GENESIS = '0'.repeat(64);

const STATUS_DOT: Record<'pass' | 'fail' | 'unknown', string> = {
  pass: 'text-emerald-400',
  fail: 'text-red-400',
  unknown: 'text-amber-300',
};
const STATUS_GLYPH: Record<'pass' | 'fail' | 'unknown', string> = {
  pass: '✓', fail: '✕', unknown: '?',
};

export function PanchayatKendra({ onClose, onShowIntent }: { onClose: () => void; onShowIntent?: () => void }) {
  const [step, setStep] = useState<Step>('arrive');
  const [citizenIdx, setCitizenIdx] = useState(0);
  const [utterance, setUtterance] = useState(CITIZENS[0].opening);
  const [heard, setHeard] = useState('');
  const [cls, setCls] = useState<Classification | null>(null);
  const [entities, setEntities] = useState<Entities | null>(null);
  const [activeIntent, setActiveIntent] = useState<IntentId | null>(null);
  const [verdicts, setVerdicts] = useState<SchemeVerdict[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [routing, setRouting] = useState<Routing | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [sealing, setSealing] = useState(false);
  const [lastCase, setLastCase] = useState<CaseRecord | null>(null);
  const [showReclassify, setShowReclassify] = useState(false);
  const [loo, setLoo] = useState<LooResult | null>(null);
  const [looRunning, setLooRunning] = useState(false);
  const listenTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice, and the optional in-browser model. The desk works identically without either.
  const townAI = useTownAI();
  const [opinion, setOpinion] = useState<SecondOpinion | null>(null);
  const [opinionRunning, setOpinionRunning] = useState(false);
  const [verdictSpeech, setVerdictSpeech] = useState<{ text: string; fromModel: boolean } | null>(null);

  const citizen: Citizen = CITIZENS[citizenIdx % CITIZENS.length];

  // Trained once, when this screen opens. It is a real training pass over the corpus and
  // takes about a millisecond, so it belongs in render rather than in an effect that would
  // make the whole desk render twice before it can show anything.
  const model: TrainedModel = useMemo(() => trainClassifier(), []);

  useEffect(() => () => { if (listenTimer.current) clearInterval(listenTimer.current); }, []);

  /**
   * The receipt, as a sentence rather than a table. Built from the engine's own output, so
   * it exists whether or not a model is awake; the model only ever rewrites it into the
   * villager's language.
   */
  const verdictFacts = useMemo(() => {
    if (!lastCase) return null;
    const meta = INTENTS[lastCase.intent];
    const problem = findings.find((f) => f.status === 'problem');
    return {
      citizenName: lastCase.citizenName,
      intentLabel: meta.label,
      department: lastCase.department,
      officer: meta.officer,
      slaDays: lastCase.slaDays,
      needsHuman: lastCase.decision !== 'auto-routed',
      headline: problem ? `${problem.label}: ${problem.detail}` : 'Nothing in your record blocks it.',
      caseId: lastCase.id,
    };
  }, [lastCase, findings]);

  const baseVerdict = useMemo(
    () => (verdictFacts ? templateVerdict(verdictFacts) : ''),
    [verdictFacts],
  );

  useEffect(() => {
    if (!verdictFacts) return;
    let cancelled = false;
    // When the brain is asleep this resolves immediately with the desk's own wording.
    spokenVerdict(townAI.awake ? townAI.ask : async () => null, verdictFacts, townAI.language)
      .then((v) => { if (!cancelled) setVerdictSpeech(v); })
      .catch(() => { /* the template is already on screen */ });
    return () => { cancelled = true; };
  }, [verdictFacts, townAI.language, townAI.awake, townAI.ask]);

  /* ------------------------------------------------------------- transitions */

  const startListening = useCallback(() => {
    setStep('listen');
    setHeard('');
    setOpinion(null);
    setVerdictSpeech(null);
    const text = utterance.trim();

    // If the town's brain is awake, ask it to read the same sentence — in parallel, so its
    // answer is waiting by the time the classifier's working is on screen. It is a second
    // reading shown beside the engine, never a replacement for it.
    if (townAI.awake) {
      setOpinionRunning(true);
      secondOpinion(townAI.ask, text)
        .then(setOpinion)
        .catch(() => setOpinion(null))
        .finally(() => setOpinionRunning(false));
    }

    let i = 0;
    if (listenTimer.current) clearInterval(listenTimer.current);
    listenTimer.current = setInterval(() => {
      i += 1;
      setHeard(text.slice(0, i));
      if (i >= text.length) {
        if (listenTimer.current) clearInterval(listenTimer.current);
        const c = classify(model, text);
        setCls(c);
        setActiveIntent(c.intent);
        setEntities(extractEntities(text));
        setTimeout(() => setStep('understand'), 700);
      }
    }, 28);
  }, [model, utterance, townAI.awake, townAI.ask]);

  /** Re-run the checks, diagnosis and routing for whichever intent is currently active. */
  const runChecks = useCallback((intent: IntentId, classification: Classification) => {
    const e = entities ?? extractEntities(utterance);
    const v = evaluateSchemes(intent, citizen);
    const f = diagnose(intent, citizen, e);
    setVerdicts(v);
    setFindings(f);
    setRouting(routeCase(intent, classification, citizen, v, f));
    return { v, f, e };
  }, [citizen, entities, utterance]);

  const goToChecks = useCallback(() => {
    if (!cls || !activeIntent) return;
    runChecks(activeIntent, cls);
    setStep('checks');
  }, [cls, activeIntent, runChecks]);

  const goToDraft = useCallback(() => {
    if (!activeIntent || !entities) return;
    setDraft(draftApplication(citizen, activeIntent, entities, verdicts, findings));
    setStep('draft');
  }, [activeIntent, citizen, entities, verdicts, findings]);

  const reclassify = useCallback((intent: IntentId) => {
    if (!cls) return;
    setActiveIntent(intent);
    const { v, f, e } = runChecks(intent, cls);
    setDraft(draftApplication(citizen, intent, e, v, f));
    setShowReclassify(false);
  }, [cls, citizen, runChecks]);

  const decide = useCallback(async (decision: CaseDecision, note?: string) => {
    if (!cls || !activeIntent || !routing) return;
    setStep('route');
    setSealing(true);
    const prevHash = cases.length ? cases[cases.length - 1].hash : GENESIS;
    const sealed = await sealCase({
      id: caseId(cases.length + 1),
      citizenName: citizen.name,
      village: citizen.village,
      intent: activeIntent,
      confidence: cls.confidence,
      department: INTENTS[activeIntent].department,
      slaDays: INTENTS[activeIntent].slaDays,
      priority: routing.priority,
      decision,
      decidedBy: decision === 'auto-routed' ? 'AI Panchayat engine' : PANCHAYAT_MEMBER,
      status: decision === 'documents-requested' ? 'filed' : 'in-progress',
      filedAt: Date.now(),
      note,
      prevHash,
    });
    // let the seal animation breathe before the ticket lands
    await new Promise((r) => setTimeout(r, 900));
    setCases((c) => [...c, sealed]);
    setLastCase(sealed);
    setSealing(false);
  }, [cls, activeIntent, routing, cases, citizen]);

  const nextCitizen = useCallback(() => {
    const next = (citizenIdx + 1) % CITIZENS.length;
    setCitizenIdx(next);
    setUtterance(CITIZENS[next].opening);
    setHeard('');
    setCls(null);
    setEntities(null);
    setActiveIntent(null);
    setVerdicts([]);
    setFindings([]);
    setRouting(null);
    setDraft(null);
    setLastCase(null);
    setShowReclassify(false);
    setStep('arrive');
  }, [citizenIdx]);

  /* ------------------------------------------------------------------ derived */

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const meta = activeIntent ? INTENTS[activeIntent] : null;
  const confPct = cls ? Math.round(cls.confidence * 100) : 0;
  const confOk = cls ? cls.confidence >= AUTO_THRESHOLD : false;
  const unresolved = useMemo(
    () => verdicts.flatMap((v) => v.checks).filter((c) => c.status === 'unknown').length +
      findings.filter((f) => f.status === 'unknown' && f.blocking).length,
    [verdicts, findings],
  );
  const humanTouched = cases.filter((c) => c.decision !== 'auto-routed').length;

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1020] text-white overflow-y-auto">
      <style>{`
        @keyframes pk-pop { 0% { transform: scale(.96); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes pk-pulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        @keyframes pk-wave { 0%,100% { height: 6px } 50% { height: 26px } }
        /* No fill-mode: a background tab throttles animations, and with 'both' the
           panel would sit at the 0% keyframe (opacity 0) until the tab is looked at. */
        .pk-pop { animation: pk-pop .4s ease-out; }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3 bg-[#0b1020]/95 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">🏛️</span>
          <div className="min-w-0">
            <div className="font-semibold tracking-wide truncate">AI Panchayat Kendra — Gram Panchayat Rampur, Ward 04</div>
            <div className="text-xs text-white/50 truncate">
              {model
                ? `Naive Bayes classifier trained in your browser · ${CORPUS.length} examples · ${model.vocab.length} vocabulary terms · ${model.trainMs.toFixed(1)} ms`
                : 'Training the classifier…'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden xl:flex items-center gap-1">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`text-[10px] px-2 py-1 rounded-full border whitespace-nowrap ${
                  i === stepIdx
                    ? 'bg-amber-500 text-black border-amber-400 font-semibold'
                    : i < stepIdx
                      ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                      : 'border-white/15 text-white/40'}`}>{s.label}</div>
                {i < STEPS.length - 1 && <div className="w-2 h-px bg-white/20" />}
              </React.Fragment>
            ))}
          </div>
          <BrainBadge />
          <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm whitespace-nowrap">← Back to town</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_340px] gap-8">
        {/* ------------------------------------------------------- main stage */}
        <div className="min-h-[440px]">

          {/* ------------------------------------------------------- ARRIVE */}
          {step === 'arrive' && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">A villager walks into the panchayat</h2>
              <p className="text-white/60 mb-6 max-w-xl">
                Today she would tell a clerk, be sent to a block office, and come back three times.
                Here she says the problem once, in her own language, and the desk does the rest — up to
                the point where a human must decide.
              </p>

              <div className="mb-6">
                <ArrivalScene
                  key={citizenIdx}
                  autoPlay
                  variant="panchayat"
                  citizenName={citizen.name}
                  paletteIndex={citizenIdx}
                  arrivedLabel="At the panchayat desk"
                />
              </div>

              <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-0.5">Citizen record</div>
                  <div className="font-semibold">{citizen.name}</div>
                  <div className="text-xs text-white/50 mb-3">{citizen.hindi} · {citizen.age} yrs · {citizen.village}</div>
                  <dl className="text-[11px] space-y-1 text-white/50">
                    <div className="flex justify-between gap-2"><dt>Household</dt><dd className="text-white/80">{citizen.household}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Speaks</dt><dd className="text-white/80">{citizen.tongue}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Land</dt><dd className="text-white/80">{citizen.landHectares} ha</dd></div>
                    <div className="flex justify-between gap-2"><dt>Job card</dt><dd className="text-white/80">{citizen.jobCard ? 'Yes' : 'No'}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Bank a/c</dt><dd className="text-white/80">{citizen.bankAccount ? 'Yes' : 'No'}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Aadhaar-seeded</dt><dd className={citizen.aadhaarSeeded ? 'text-white/80' : 'text-red-300'}>{citizen.aadhaarSeeded ? 'Yes' : 'No'}</dd></div>
                    <div className="flex justify-between gap-2"><dt>House</dt><dd className="text-white/80">{citizen.houseType}</dd></div>
                    <div className="flex justify-between gap-2"><dt>SECC list</dt><dd className="text-white/80">{citizen.seccListed ? 'Listed' : 'Not listed'}</dd></div>
                  </dl>
                </div>

                <div>
                  <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
                    <div className="mb-1 font-semibold text-amber-200">You are the villager. Say it out loud.</div>
                    <p className="mb-3 text-sm text-white/55">
                      Press the microphone and speak your problem in your own language — the way
                      someone who cannot read or write a form would have to. Nothing is typed, and
                      nothing is lost.
                    </p>
                    <LanguagePicker />
                  </div>

                  <VoiceInput
                    language={townAI.language}
                    value={utterance}
                    onChange={setUtterance}
                    onSubmit={startListening}
                    submitLabel="Take this to the desk →"
                    hint={
                      <>
                        The classifier really re-runs on whatever ends up in that box, spoken or typed.
                        Try nonsense and watch the confidence collapse and the case get handed to a
                        human — that is the behaviour worth demonstrating.
                      </>
                    }
                  />

                  <div className="mt-5">
                    <AwakenBrain reason="Optional. With it awake, the desk gives a second reading of your problem beside the classifier's — and says the final answer back to you in your own language." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- LISTEN */}
          {step === 'listen' && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">Step 1 · Listening</h2>
              <p className="text-white/60 mb-6 max-w-xl">
                No form, no field, no English. She speaks; the desk transcribes. Script does not matter —
                Devanagari and Hinglish are normalised into the same features before anything is understood.
              </p>
              <div className="max-w-xl p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-end gap-1 h-8 mb-4">
                  {Array.from({ length: 26 }).map((_, i) => (
                    <div key={i} className="w-1.5 rounded-full bg-cyan-400/80"
                      style={{ animation: `pk-wave ${0.5 + (i % 5) * 0.14}s ease-in-out infinite`, animationDelay: `${i * 0.04}s` }} />
                  ))}
                </div>
                <div className="text-xs text-white/40 mb-1">Transcript · {citizen.tongue}</div>
                <div className="text-lg leading-relaxed min-h-[64px]">
                  {heard}<span style={{ animation: 'pk-pulse .8s infinite' }}>▌</span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- UNDERSTAND */}
          {step === 'understand' && cls && entities && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">Step 2 · Understanding — and showing its working</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                Ten possible case types. The classifier scores all ten, and the number it reports is
                deliberately pessimistic: the raw probability is discounted by the share of words it has
                never seen and by how little evidence it had.
              </p>

              {/* The model's reading, shown beside the engine's — never instead of it. */}
              {(opinionRunning || opinion) && (
                <div className={`mb-5 max-w-3xl rounded-2xl border p-4 ${
                  opinion && opinion.intent && opinion.intent !== cls.intent
                    ? 'border-amber-400/40 bg-amber-500/[0.07]'
                    : 'border-white/12 bg-white/[0.03]'
                }`}>
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white/85">
                    <span aria-hidden>🧠</span> The town’s AI read it too
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-normal text-white/45">
                      second opinion · not the decision
                    </span>
                  </div>

                  {opinionRunning && !opinion && (
                    <p className="text-sm text-white/45" style={{ animation: 'pk-pulse 1.2s infinite' }}>
                      Reading the complaint…
                    </p>
                  )}

                  {opinion && (
                    <>
                      <p className="text-sm text-white/70">
                        It says this is{' '}
                        <b className="text-white/90">
                          {opinion.intent ? `${INTENTS[opinion.intent].icon} ${INTENTS[opinion.intent].label}` : 'something not on the list'}
                        </b>
                        {' — “'}<span className="italic text-white/55">{opinion.because}</span>{'”'}
                      </p>
                      {opinion.intent === cls.intent && (
                        <p className="mt-2 text-xs text-emerald-300/90">
                          ✓ Both readers agree. That is worth something, but the classifier is still what
                          decides — it is the one whose corpus you can read and whose accuracy is measured.
                        </p>
                      )}
                      {opinion.intent && opinion.intent !== cls.intent && (
                        <p className="mt-2 text-xs text-amber-200/90">
                          ⚠ The two disagree. The classifier’s call stands and the case is routed on it,
                          because a 0.5-billion-parameter model’s opinion is not auditable and its accuracy
                          on this corpus is not measured. You are seeing the disagreement rather than a
                          quietly-picked winner — and if you think the AI is right, the human reviewer two
                          steps from here can reclassify it.
                        </p>
                      )}
                      {opinion.offList && (
                        <p className="mt-2 text-xs text-red-300/90">
                          ⚠ It answered with a case type that does not exist. This is exactly the failure
                          the ten fixed classes and the routing gates are there to absorb.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
                {/* the call */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-1">Classified as</div>
                  <div className="text-xl font-semibold mb-1">{INTENTS[cls.intent].icon} {INTENTS[cls.intent].label}</div>
                  <div className="text-xs text-white/40 mb-3">{INTENTS[cls.intent].hindi}</div>

                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/50">Calibrated confidence</span>
                    <span className={confOk ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>{confPct}%</span>
                  </div>
                  <div className="relative h-2 rounded bg-white/10 overflow-hidden mb-1">
                    <div className={`h-full transition-all duration-700 ${confOk ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${confPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: `${AUTO_THRESHOLD * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-white/35">
                    White line is the {Math.round(AUTO_THRESHOLD * 100)}% auto-route threshold.
                    {confOk ? ' Above it — the engine may proceed on its own.' : ' Below it — a human must confirm.'}
                  </div>

                  <div className="mt-3 text-[11px] text-white/40 space-y-0.5">
                    <div>{cls.tokens.length} tokens after normalisation · {cls.known.length} known · {cls.oov.length} unseen</div>
                    <div>Out-of-vocabulary rate {Math.round(cls.oovRate * 100)}%</div>
                  </div>
                  {cls.oov.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cls.oov.slice(0, 10).map((t, i) => (
                        <span key={`${t}-${i}`} className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-mono">{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* competing classes */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-2">All ten classes, scored</div>
                  {cls.ranked.slice(0, 5).map((r, i) => (
                    <div key={r.intent} className="mb-2">
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className={i === 0 ? 'text-white' : 'text-white/50'}>{INTENTS[r.intent].icon} {INTENTS[r.intent].label}</span>
                        <span className="text-white/40 font-mono">{(r.prob * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded bg-white/10 overflow-hidden">
                        <div className={`h-full ${i === 0 ? 'bg-amber-400' : 'bg-white/25'}`} style={{ width: `${r.prob * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="text-[10px] text-white/30 mt-2">Softmax over length-normalised log-likelihoods.</div>
                </div>

                {/* why */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-2">Words that decided it — log-odds against the runner-up</div>
                  {cls.evidence.length === 0 && <div className="text-white/40 text-sm">Nothing in the sentence is in the vocabulary.</div>}
                  {cls.evidence.map((e) => (
                    <div key={e.token} className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs w-24 truncate text-cyan-300">{e.token}</span>
                      <div className="flex-1 h-1.5 rounded bg-white/10 overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, Math.max(2, (e.logOdds / 3) * 100))}%` }} />
                      </div>
                      <span className="font-mono text-[10px] text-white/40 w-10 text-right">{e.logOdds >= 0 ? '+' : ''}{e.logOdds.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* entities */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-2">Facts pulled out of the sentence</div>
                  {entities.list.length === 0 && <div className="text-white/40 text-sm">No durations, amounts, documents or scheme names found.</div>}
                  {entities.list.map((e, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
                      <span className="text-white/50">{e.label}</span>
                      <span className="text-white/85">{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={goToChecks} className="mt-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                Check her record →
              </button>
            </div>
          )}

          {/* -------------------------------------------------------- CHECKS */}
          {step === 'checks' && meta && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">Step 3 · Checking the record</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                Every rule below is really evaluated against her record. Three outcomes, not two —
                and <b className="text-amber-300">unknown</b> is the honest one. A rule the data cannot answer is
                not quietly assumed to pass; it becomes a reason to involve a person.
              </p>

              {findings.length > 0 && (
                <div className="mb-6 max-w-3xl">
                  <div className="text-sm font-semibold text-white/70 mb-2">Probable root cause</div>
                  <div className="space-y-2">
                    {findings.map((f, i) => (
                      <div key={i} className={`p-3 rounded-xl border ${
                        f.status === 'problem' ? 'bg-red-500/10 border-red-500/35'
                          : f.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'}`}>
                        <div className="text-sm font-semibold mb-0.5">
                          {f.status === 'problem' ? '⚠️' : f.status === 'ok' ? '✓' : '?'} {f.label}
                        </div>
                        <div className="text-xs text-white/60">{f.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-sm font-semibold text-white/70 mb-2">Scheme eligibility</div>
              {verdicts.length === 0 && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm max-w-3xl">
                  No scheme eligibility applies to this case type — it is a service complaint, not an entitlement claim.
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
                {verdicts.map((v) => (
                  <div key={v.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-sm">{v.name}</div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        v.verdict === 'eligible' ? 'bg-emerald-500 text-black'
                          : v.verdict === 'not-eligible' ? 'bg-red-500 text-black'
                            : 'bg-amber-400 text-black'}`}>
                        {v.verdict === 'eligible' ? 'ELIGIBLE' : v.verdict === 'not-eligible' ? 'NOT ELIGIBLE' : 'NEEDS CHECKING'}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/35 mb-3">Ministry of {v.ministry}</div>
                    <ul className="space-y-1.5">
                      {v.checks.map((c) => (
                        <li key={c.id} className="text-xs">
                          <span className={`font-bold mr-1.5 ${STATUS_DOT[c.status]}`}>{STATUS_GLYPH[c.status]}</span>
                          <span className="text-white/80">{c.label}</span>
                          <div className="text-white/40 ml-5 text-[11px]">{c.detail}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button onClick={goToDraft} className="mt-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                Draft the application →
              </button>
            </div>
          )}

          {/* --------------------------------------------------------- DRAFT */}
          {step === 'draft' && draft && meta && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">Step 4 · The application, written for her</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                The barrier was never that she did not know her problem. It was that the office only accepts
                the problem in a shape she was never taught to write.
              </p>

              <div className="max-w-2xl p-5 rounded-2xl bg-[#0e1428] border border-white/15 mb-4">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Application · {meta.department}</div>
                <div className="font-semibold mb-3">{draft.subject}</div>
                {draft.body.map((p, i) => (
                  <p key={i} className="text-sm text-white/70 mb-2 leading-relaxed">{p}</p>
                ))}
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="text-xs text-white/40 mb-1">Annexures</div>
                  <div className="flex flex-wrap gap-1.5">
                    {draft.annexures.map((a) => (
                      <span key={a} className="px-2 py-0.5 rounded bg-white/8 border border-white/10 text-[11px] text-white/70">{a}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="max-w-2xl p-4 rounded-2xl bg-cyan-500/10 border border-cyan-400/25 mb-6">
                <div className="text-xs text-cyan-300 mb-1">And said back to her, in her register</div>
                <p className="text-sm text-white/80">{draft.spoken}</p>
                <p className="text-[10px] text-white/35 mt-2">
                  This sentence is templated from the engine&apos;s output, not generated by a language model.
                  In production this is the one layer that would call a real model — and the only one that could,
                  because it is the only layer where being wrong is not consequential.
                </p>
              </div>

              <button onClick={() => setStep('review')} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                Take it to the panchayat member →
              </button>
            </div>
          )}

          {/* -------------------------------------------------------- REVIEW */}
          {step === 'review' && routing && cls && meta && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">Step 5 · A human decides</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                This is the whole product. Everything before it was preparation; nothing leaves this building
                until an elected person puts their name on it — or until the engine has cleared five gates that
                say it does not need to.
              </p>

              <div className={`max-w-2xl p-5 rounded-2xl border mb-4 ${
                routing.autoRoutable ? 'bg-emerald-500/10 border-emerald-500/35' : 'bg-amber-500/10 border-amber-500/35'}`}>
                <div className="font-semibold mb-2">
                  {routing.autoRoutable
                    ? '✓ All five gates cleared — the engine may route this without a signature'
                    : `⚠️ ${routing.humanReasons.length} gate${routing.humanReasons.length === 1 ? '' : 's'} stopped the engine — a person must decide`}
                </div>
                {routing.autoRoutable ? (
                  <p className="text-sm text-white/60">
                    Confident, in-vocabulary, no unresolved check bearing on the decision, nothing being refused,
                    and a case class software is allowed to handle. It still lands in the public register with the
                    engine named as the decider — auto-routed is not the same as unaccountable.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {routing.humanReasons.map((r, i) => (
                      <li key={i} className="text-sm text-white/70 flex gap-2"><span className="text-amber-300">→</span><span>{r}</span></li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="max-w-2xl grid sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-2">The engine recommends</div>
                  <div className="font-semibold mb-1">{meta.icon} {meta.label}</div>
                  <div className="text-xs text-white/50 mb-3">{meta.blurb}</div>
                  <dl className="text-[11px] space-y-1 text-white/50">
                    <div className="flex justify-between gap-2"><dt>Route to</dt><dd className="text-white/85 text-right">{routing.department}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Owner</dt><dd className="text-white/85 text-right">{routing.officer}</dd></div>
                    <div className="flex justify-between gap-2"><dt>SLA</dt><dd className="text-white/85">{routing.slaDays} days</dd></div>
                    <div className="flex justify-between gap-2"><dt>Priority</dt><dd className={routing.priority === 'urgent' ? 'text-red-300' : routing.priority === 'high' ? 'text-amber-300' : 'text-white/85'}>{routing.priority}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Confidence</dt><dd className={confOk ? 'text-emerald-300' : 'text-amber-300'}>{confPct}%</dd></div>
                    <div className="flex justify-between gap-2"><dt>Unresolved checks</dt><dd className="text-white/85">{unresolved}</dd></div>
                  </dl>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-1">On the bench</div>
                  <div className="font-semibold mb-1">👩🏽‍⚖️ {PANCHAYAT_MEMBER}</div>
                  <p className="text-xs text-white/50 mb-3">
                    She sees the recommendation, the confidence, and every reason the engine stopped.
                    She is not asked to trust it — she is asked to decide, with the working shown.
                  </p>
                  <p className="text-[10px] text-white/35">
                    Whatever she picks is sealed into the public register under her name. An override is a first-class
                    outcome here, not a failure state — a system nobody can overrule is not accountable, it is just automated.
                  </p>
                </div>
              </div>

              {showReclassify && (
                <div className="max-w-2xl mb-4 p-4 rounded-xl bg-white/5 border border-white/15 pk-pop">
                  <div className="text-sm font-semibold mb-2">She disagrees. What is this case actually about?</div>
                  <div className="flex flex-wrap gap-2">
                    {INTENT_IDS.filter((i) => i !== activeIntent).map((i) => (
                      <button key={i} onClick={() => reclassify(i)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-500 hover:text-black text-xs transition-colors">
                        {INTENTS[i].icon} {INTENTS[i].label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-white/35 mt-3">
                    Picking one re-runs the eligibility checks, the diagnosis and the routing against the new class,
                    then redrafts the application. Her correction is the authority, not a suggestion.
                  </div>
                </div>
              )}

              <div className="max-w-2xl flex flex-wrap gap-3">
                {routing.autoRoutable ? (
                  <button onClick={() => decide('auto-routed')} className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
                    ⚡ Let the engine route it
                  </button>
                ) : (
                  <button onClick={() => decide('approved')} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                    ✍️ Approve &amp; route
                  </button>
                )}
                <button onClick={() => setShowReclassify((v) => !v)} className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20">
                  ↩️ Reclassify it
                </button>
                <button onClick={() => decide('documents-requested', 'Applicant asked to bring the missing annexures before the case moves.')}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20">
                  📄 Ask for documents first
                </button>
                <button onClick={() => decide('held-for-hearing', 'Both parties to be heard at the next Gram Sabha.')}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20">
                  ⚖️ Hold for a hearing
                </button>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- ROUTE */}
          {step === 'route' && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">Step 6 · Sealed into the public register</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                The decision — who decided, what they decided, and when — is hashed with SHA-256 together with
                the previous case&apos;s hash. Same tamper-evidence as the voting centre next door, pointed at the
                thing that actually gets rewritten in a panchayat: the record of who was helped and who was sent away.
              </p>

              {sealing || !lastCase ? (
                <div className="max-w-xl p-5 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-white/50 text-sm" style={{ animation: 'pk-pulse .7s infinite' }}>⛓️ Computing SHA-256 over the decision…</div>
                </div>
              ) : (
                <div className="max-w-2xl">
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 mb-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/40">Case receipt</div>
                        <div className="text-2xl font-bold font-mono">{lastCase.id}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        lastCase.decision === 'auto-routed' ? 'bg-emerald-500 text-black' : 'bg-amber-400 text-black'}`}>
                        {DECISION_LABEL[lastCase.decision].toUpperCase()}
                      </span>
                    </div>
                    <dl className="text-xs space-y-1.5 text-white/50">
                      <div className="flex justify-between gap-3"><dt>Applicant</dt><dd className="text-white/85">{lastCase.citizenName}, {lastCase.village}</dd></div>
                      <div className="flex justify-between gap-3"><dt>Case type</dt><dd className="text-white/85">{INTENTS[lastCase.intent].label}</dd></div>
                      <div className="flex justify-between gap-3"><dt>Routed to</dt><dd className="text-white/85 text-right">{lastCase.department}</dd></div>
                      <div className="flex justify-between gap-3"><dt>Decided by</dt><dd className="text-white/85 text-right">{lastCase.decidedBy}</dd></div>
                      <div className="flex justify-between gap-3"><dt>Resolve by</dt><dd className="text-white/85">{lastCase.slaDays} days from today</dd></div>
                      {lastCase.note && <div className="pt-1 text-white/60 italic">“{lastCase.note}”</div>}
                    </dl>
                    <div className="mt-3 pt-3 border-t border-white/10 font-mono text-[10px] space-y-0.5">
                      <div className="text-white/30 truncate">prev {lastCase.prevHash.slice(0, 40)}…</div>
                      <div className="text-cyan-300 truncate">hash {lastCase.hash.slice(0, 40)}…</div>
                    </div>
                  </div>
                  {/* Said back out loud. A receipt a villager cannot read is not a receipt. */}
                  <div className="mb-4 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.07] p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-cyan-200">🔊 What the desk says back</span>
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/45">
                        in {languageFor(townAI.language).native}
                      </span>
                      {verdictSpeech?.fromModel && (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                          phrased by the town’s AI
                        </span>
                      )}
                    </div>

                    <p className="mb-3 text-lg leading-relaxed text-white/90">
                      {verdictSpeech ? verdictSpeech.text : baseVerdict}
                    </p>

                    {(verdictSpeech || baseVerdict) && (
                      <div className="flex flex-wrap items-center gap-3">
                        <SpeakButton
                          text={verdictSpeech ? verdictSpeech.text : baseVerdict}
                          language={townAI.language}
                          autoPlay={!!verdictSpeech}
                          label="Say it again"
                        />
                        {verdictSpeech && !verdictSpeech.fromModel && townAI.language !== 'en-IN' && (
                          <span className="text-[11px] text-white/40">
                            {townAI.awake
                              ? 'The model’s reply came back in the wrong script, so this is the desk’s own wording.'
                              : 'Awaken the town’s AI on the first screen to hear this in your own language.'}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                      This is the one place a language model is allowed to speak here, and only after every
                      decision has already been made by rules you can read. It phrases the verdict; it does
                      not reach it.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 mb-6">
                    <b className="text-white/80">Escalation is automatic.</b> {INTENTS[lastCase.intent].label} carries a{' '}
                    {lastCase.slaDays}-day SLA. Unresolved past that, it escalates to the Block Development Officer and appears
                    on the public overdue board — no one has to know to complain, and no one has to be literate to be counted.
                  </div>
                  <button onClick={() => setStep('register')} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                    Open the public register →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------ REGISTER */}
          {step === 'register' && (
            <div className="pk-pop">
              <h2 className="text-3xl font-bold mb-2">The public register</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                Every case, every decider, every deadline — in the open. The measure that matters is not how many
                cases the AI closed. It is how many a human had to touch, and whether the ones it handled alone
                were the ones it should have.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mb-6 max-w-2xl">
                {[
                  { k: 'Cases filed', v: String(cases.length) },
                  { k: 'Needed a human', v: `${humanTouched} of ${cases.length}` },
                  { k: 'Median confidence', v: cases.length ? `${Math.round([...cases].sort((a, b) => a.confidence - b.confidence)[Math.floor(cases.length / 2)].confidence * 100)}%` : '—' },
                ].map((s) => (
                  <div key={s.k} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-bold">{s.v}</div>
                    <div className="text-[11px] text-white/40">{s.k}</div>
                  </div>
                ))}
              </div>

              <div className="max-w-3xl overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-white/40">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Case</th>
                      <th className="text-left font-medium px-3 py-2">Applicant</th>
                      <th className="text-left font-medium px-3 py-2">Type</th>
                      <th className="text-left font-medium px-3 py-2">Decided by</th>
                      <th className="text-left font-medium px-3 py-2">SLA</th>
                      <th className="text-left font-medium px-3 py-2">Seal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono text-white/80">{c.id}</td>
                        <td className="px-3 py-2 text-white/70">{c.citizenName}</td>
                        <td className="px-3 py-2 text-white/70">{INTENTS[c.intent].icon} {INTENTS[c.intent].label}</td>
                        <td className="px-3 py-2">
                          <span className={c.decision === 'auto-routed' ? 'text-emerald-300' : 'text-amber-300'}>
                            {c.decision === 'auto-routed' ? 'engine' : 'panchayat member'}
                          </span>
                          <div className="text-white/30 text-[10px]">{DECISION_LABEL[c.decision]}</div>
                        </td>
                        <td className="px-3 py-2 text-white/60">{c.slaDays}d · {c.priority}</td>
                        <td className="px-3 py-2 font-mono text-cyan-300/70">{c.hash.slice(0, 10)}…</td>
                      </tr>
                    ))}
                    {cases.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-white/30">No cases yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={nextCitizen} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">🚶 Next villager →</button>
                <button onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/15 text-white/60">← Back to town</button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- side rail */}
        <aside className="space-y-4">
          <IntentCard onOpen={onShowIntent} />

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">The problem being solved</div>
            <p className="text-sm text-white/60">
              Most welfare in India is not denied. It is <i>lost</i> — in a form nobody could fill, an office
              nobody named, and a bank field nobody checked. The desk is not there to be clever. It is there
              to make sure a real claim never dies of paperwork.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">What&apos;s real in this demo?</div>
            <ul className="text-sm text-white/60 space-y-2">
              <li>🧠 <b className="text-white/80">The classifier</b> — multinomial Naive Bayes, trained in your browser on {CORPUS.length} labelled examples when this screen opened{model ? `, in ${model.trainMs.toFixed(1)} ms` : ''}.</li>
              <li>🔤 <b className="text-white/80">The tokenizer</b> — Devanagari, Hinglish and English really do collapse into one feature space.</li>
              <li>📐 <b className="text-white/80">The rules</b> — every eligibility check is evaluated against the citizen record, with <i>unknown</i> as a real third outcome.</li>
              <li>🔒 <b className="text-white/80">The seal</b> — genuine SHA-256, chained case to case, shared with the voting centre.</li>
              <li>🎙️ <b className="text-white/80">The microphone</b> — your browser&apos;s own speech recognition. No key, and nothing uploaded by us; the button says whether your device recognised the audio locally or sent it to the browser&apos;s own service.</li>
              <li>💬 <b className="text-white/80">The spoken reply</b> — templated from the engine&apos;s output by default. Awaken the town&apos;s AI and an open-weights model rewrites that same verdict into your language, in your browser. It phrases the answer; it never reaches it.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">The five gates</div>
            <ul className="text-sm text-white/60 space-y-1.5">
              <li><b className="text-white/80">Confidence</b> — below {Math.round(AUTO_THRESHOLD * 100)}%, hand over.</li>
              <li><b className="text-white/80">Vocabulary</b> — too many unseen words, hand over.</li>
              <li><b className="text-white/80">Evidence</b> — an unresolved check that bears on the decision, hand over. An unknown the receiving officer is being sent to answer does not count, or the gate becomes a rubber stamp.</li>
              <li><b className="text-white/80">Adverse finding</b> — software may carry a claim forward; it may never be the thing that records a refusal.</li>
              <li><b className="text-white/80">Policy</b> — disputes never auto-decide, however confident.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-1">Held-out accuracy</div>
            <p className="text-xs text-white/50 mb-3">
              Leave-one-out cross-validation: retrain on {CORPUS.length - 1} examples, classify the one held back,
              {' '}{CORPUS.length} times over. It runs here, now, on your machine.
            </p>
            {loo ? (
              <div className="space-y-2">
                <div>
                  <div className="text-2xl font-bold">{(loo.accuracy * 100).toFixed(1)}%</div>
                  <div className="text-[11px] text-white/40">{loo.correct} of {loo.total} correct · {loo.ms.toFixed(0)} ms</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                  <div className="text-xs text-emerald-300 font-semibold">
                    {loo.missesCaughtByGate} of {loo.misses.length} mistakes were below the confidence gate
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">
                    {loo.missesCaughtByGate === loo.misses.length
                      ? 'Every misclassification was one the engine refused to act on alone. That number matters more than the accuracy — a model that is wrong and knows it is a different product from one that is wrong and confident.'
                      : `${loo.misses.length - loo.missesCaughtByGate} would have auto-routed while wrong. That is the number to design against.`}
                  </div>
                </div>
                {loo.misses.length > 0 && (
                  <details className="text-[11px] text-white/40">
                    <summary className="cursor-pointer hover:text-white/70">See what it got wrong</summary>
                    <ul className="mt-2 space-y-1.5">
                      {loo.misses.map((m, i) => (
                        <li key={i}>
                          <span className="text-white/60">“{m.text}”</span><br />
                          <span className="text-red-300">{INTENTS[m.got].label}</span>
                          <span className="text-white/30"> instead of </span>
                          <span className="text-emerald-300">{INTENTS[m.want].label}</span>
                          <span className="text-white/30"> · {(m.confidence * 100).toFixed(0)}%</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <button
                disabled={looRunning}
                onClick={() => {
                  setLooRunning(true);
                  // let the button paint its running state before the loop blocks the thread
                  setTimeout(() => { setLoo(leaveOneOut()); setLooRunning(false); }, 30);
                }}
                className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm">
                {looRunning ? 'Retraining ' + CORPUS.length + ' times…' : '▶ Run the validation'}
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="font-semibold mb-1 text-amber-300">Honest caveat</div>
            <p className="text-xs text-white/50">
              A real deployment needs speech in twenty-plus languages, a UI that works for someone who cannot read,
              an appeals path that does not run through the same office, and a live connection to NREGASoft, PFMS and
              the state land record — none of which is here. What this prototype argues is narrower and, I think,
              the part most civic-AI demos skip: where the machine must stop.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
