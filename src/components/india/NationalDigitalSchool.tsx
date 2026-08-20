'use client';

/**
 * National Digital School — a certificate that proves itself.
 *
 * Every hash, every signature and every proof on these screens is computed live by school.ts
 * using Web Crypto: real ECDSA over P-256, a real IPFS CIDv1, a real Merkle tree. There is no
 * server, no key to configure, and nothing pre-recorded.
 *
 * The argument the screen is making is not "records should be digital" — everyone agrees with
 * that and it changes nothing. It is that verification today means telephoning a university
 * that may not answer, and that the employer who only needs "did she graduate" ends up
 * holding every mark she ever got. Both of those are choices, and both can be unmade.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Certificate, Check, Presentation, RevocationEntry, School, STUDENTS, StudentRecord,
  appendRevocation, createSchool, issue, present, timedVerify,
} from './school';
import { IntentCard } from './Intent';
import { ArrivalScene } from './ArrivalScene';
import { useTownState } from './TownState';

type Step = 'arrive' | 'issue' | 'verify' | 'forge' | 'disclose' | 'revoke';

const STEPS: { key: Step; label: string }[] = [
  { key: 'arrive', label: 'Results day' },
  { key: 'issue', label: 'Issue' },
  { key: 'verify', label: 'Verify' },
  { key: 'forge', label: 'Forge it' },
  { key: 'disclose', label: 'Show less' },
  { key: 'revoke', label: 'Revoke' },
];

const SCHOOL_NAME = 'National Digital School, Rampur';

/** The fields a graduate would normally be asked for, versus everything on the certificate. */
/**
 * The fields a forger would actually want to improve, with what they would change them to.
 * A field already at its target is left out — offering "Passed with distinction → Passed
 * with distinction" is not a forgery, it is a typo.
 */
const FORGEABLE = (cert: Certificate) =>
  cert.fields
    .filter((f) => f.key.startsWith('mark:') || f.key === 'cgpa' || f.key === 'result')
    .map((field) => ({
      field,
      to: field.key === 'result' ? 'Passed with distinction' : field.key === 'cgpa' ? '9.9' : '99',
    }))
    .filter(({ field, to }) => field.value !== to);

const MINIMAL_KEYS = ['name', 'qualification', 'year', 'result'];

function CheckRow({ check }: { check: Check }) {
  return (
    <div className={`rounded-xl border p-3 ${
      check.ok ? 'border-emerald-400/35 bg-emerald-500/[0.07]' : 'border-red-500/45 bg-red-500/10'
    }`}>
      <div className="flex items-start gap-2">
        <span className={check.ok ? 'text-emerald-400' : 'text-red-400'} aria-hidden>
          {check.ok ? '✓' : '✕'}
        </span>
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${check.ok ? 'text-white/90' : 'text-red-200'}`}>
            {check.label}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{check.proves}</p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/60">{check.detail}</p>
        </div>
      </div>
    </div>
  );
}

export function NationalDigitalSchool({
  onClose, onShowIntent,
}: {
  onClose: () => void;
  onShowIntent?: () => void;
}) {
  const town = useTownState();
  const [school, setSchool] = useState<School | null>(null);
  const [step, setStep] = useState<Step>('arrive');
  const [studentIdx, setStudentIdx] = useState(0);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [issuing, setIssuing] = useState(false);

  const [checks, setChecks] = useState<Check[] | null>(null);
  const [verifyMs, setVerifyMs] = useState(0);
  const [shown, setShown] = useState<string[]>(MINIMAL_KEYS);
  const [forgedField, setForgedField] = useState<string | null>(null);
  const [forgedValue, setForgedValue] = useState('99');
  const [revocations, setRevocations] = useState<RevocationEntry[]>([]);

  const student: StudentRecord = STUDENTS[studentIdx % STUDENTS.length];

  /**
   * Each step is a screen, not a section, so the reader has to start at its top. Without
   * this, arriving at "verify" from the bottom of "issue" drops you into the middle of the
   * checks with the headline off screen.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [step]);

  // One keypair per visit, generated here. There is nowhere else for it to live.
  useEffect(() => {
    let cancelled = false;
    createSchool(SCHOOL_NAME).then((s) => { if (!cancelled) setSchool(s); });
    return () => { cancelled = true; };
  }, []);

  const issueFor = useCallback(async (rec: StudentRecord) => {
    if (!school) return;
    setIssuing(true);
    setChecks(null);
    setForgedField(null);
    const c = await issue(school, rec);
    setCert(c);
    setIssuing(false);
    town.record({
      kind: 'case', system: 'school',
      label: `${rec.name}'s degree was issued and sealed`,
      detail: `${c.fields.length} fields hashed into a Merkle tree, the root signed with the school's ECDSA key, and the certificate given a real IPFS address — ${c.cid.slice(0, 18)}…`,
      at: { x: 6, y: 6 },
    });
    return c;
  }, [school, town]);

  /** Run the employer's check over whatever presentation is currently on screen. */
  const runVerify = useCallback(async (p: Presentation) => {
    if (!school) return;
    const out = await timedVerify(p, school, revocations);
    setChecks(out.checks);
    setVerifyMs(out.ms);
    return out;
  }, [school, revocations]);

  const goIssue = useCallback(async () => {
    setStep('issue');
    await issueFor(student);
  }, [issueFor, student]);

  const goVerify = useCallback(async () => {
    if (!school || !cert) return;
    setStep('verify');
    setForgedField(null);
    const p = await present(cert, cert.fields.map((f) => f.key), school.publicKeyId);
    await runVerify(p);
  }, [school, cert, runVerify]);

  const runForgery = useCallback(async (key: string, value: string) => {
    if (!school || !cert) return;
    setForgedField(key);
    setForgedValue(value);
    const p = await present(cert, cert.fields.map((f) => f.key), school.publicKeyId);
    // Exactly what a forger can do: change the paper. The proofs and the signature they were
    // handed are untouched, because those are the parts they cannot produce.
    const tampered: Presentation = {
      ...p,
      disclosed: p.disclosed.map((d) =>
        d.field.key === key ? { ...d, field: { ...d.field, value } } : d),
    };
    const out = await runVerify(tampered);
    if (out && !out.ok) {
      town.recordAttack('forge-certificate');
      town.record({
        kind: 'attack', system: 'school',
        label: 'A marksheet was altered — and it held',
        detail: 'One field was edited. Its Merkle proof stopped reaching the signed root, so the certificate stopped verifying without anyone telephoning the school.',
        at: { x: 6, y: 6 },
      });
    }
  }, [school, cert, runVerify, town]);

  const restoreHonest = useCallback(async () => {
    if (!school || !cert) return;
    setForgedField(null);
    const p = await present(cert, cert.fields.map((f) => f.key), school.publicKeyId);
    await runVerify(p);
  }, [school, cert, runVerify]);

  const runDisclosure = useCallback(async (keys: string[]) => {
    if (!school || !cert) return;
    setShown(keys);
    setForgedField(null);
    const p = await present(cert, keys, school.publicKeyId);
    await runVerify(p);
  }, [school, cert, runVerify]);

  /** The screen that carries the whole argument, and until now nothing set the step to it. */
  const goDisclose = useCallback(async () => {
    setStep('disclose');
    await runDisclosure(MINIMAL_KEYS);
  }, [runDisclosure]);

  const doRevoke = useCallback(async () => {
    if (!school || !cert) return;
    const next = await appendRevocation(revocations, cert.cid, 'Awarded on forged prerequisites');
    setRevocations(next);
    const p = await present(cert, shown.length ? shown : MINIMAL_KEYS, school.publicKeyId);
    const out = await timedVerify(p, school, next);
    setChecks(out.checks);
    setVerifyMs(out.ms);
    town.record({
      kind: 'attack', system: 'school',
      label: 'A degree was cancelled, and stayed cancelled',
      detail: 'The signature on it still verifies — signatures do not expire. The chained revocation register is what stops it being presented.',
      at: { x: 6, y: 6 },
    });
  }, [school, cert, revocations, shown, town]);

  /** The two screens that show a chosen subset rather than the whole certificate. */
  const DISCLOSING = step === 'disclose' || step === 'revoke';
  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const sensitiveShown = useMemo(
    () => (cert ? cert.fields.filter((f) => shown.includes(f.key) && f.sensitive).length : 0),
    [cert, shown],
  );

  if (!school) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b1020] text-white">
        <div className="text-center">
          <div className="mb-3 text-5xl">🏫</div>
          <div className="text-sm tracking-widest text-white/50">GENERATING THE SCHOOL’S KEYS…</div>
          <div className="mt-2 text-xs text-white/30">ECDSA P-256, in your browser</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="fixed inset-0 z-50 overflow-y-auto bg-[#0b1020] text-white">
      <style>{`
        @keyframes sc-pop { 0% { transform: scale(.97); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes sc-pulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        .sc-pop { animation: sc-pop .4s ease-out; }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0b1020]/95 px-6 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl">🏫</span>
          <div className="min-w-0">
            <div className="truncate font-semibold tracking-wide">{SCHOOL_NAME}</div>
            <div className="truncate text-xs text-white/50">
              Issuing key {school.publicKeyId.slice(0, 12)}… · ECDSA P-256 generated in your browser · no server, no key to configure
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden items-center gap-1 xl:flex">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] ${
                  i === stepIdx ? 'border-amber-400 bg-amber-500 font-semibold text-black'
                    : i < stepIdx ? 'border-emerald-500/40 bg-emerald-600/30 text-emerald-300'
                      : 'border-white/15 text-white/40'}`}>{s.label}</div>
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

          {/* ----------------------------------------------------------- ARRIVE */}
          {step === 'arrive' && (
            <div className="sc-pop">
              <h2 className="mb-2 text-3xl font-bold">Results day</h2>
              <p className="mb-6 max-w-2xl text-white/60">
                Anjali has finished her degree. In most versions of this story the paper she is
                handed is the weakest object in her life: a photocopy an employer cannot check
                without telephoning a university that may not answer, and which she must show in
                full — every mark, every subject — to prove a single fact.
              </p>

              <div className="mb-6">
                <ArrivalScene
                  key={studentIdx}
                  autoPlay
                  variant="school"
                  citizenName={student.name}
                  paletteIndex={studentIdx + 2}
                  arrivedLabel="At the results board"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-0.5 text-xs text-white/40">Student record</div>
                  <div className="font-semibold">{student.name}</div>
                  <div className="mb-3 text-xs text-white/50">{student.qualification}</div>
                  <dl className="space-y-1 text-[11px] text-white/50">
                    <div className="flex justify-between gap-2"><dt>Roll</dt><dd className="text-white/80">{student.rollNo}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Year</dt><dd className="text-white/80">{student.year}</dd></div>
                    <div className="flex justify-between gap-2"><dt>CGPA</dt><dd className="text-white/80">{student.cgpa}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Result</dt><dd className="text-white/80">{student.result}</dd></div>
                  </dl>
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-white/30">Marks</div>
                    {student.marks.map((m) => (
                      <div key={m.subject} className="flex justify-between gap-2 text-[11px]">
                        <span className="text-white/50">{m.subject}</span>
                        <span className="text-white/80">{m.score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
                    <div className="mb-1 font-semibold text-amber-200">What has to become true</div>
                    <ul className="space-y-1.5 text-sm text-white/60">
                      <li>· An employer can check it in seconds, offline, without calling anybody.</li>
                      <li>· Changing one mark has to break it — not be hard, <i>impossible</i>.</li>
                      <li>· She can prove she has the degree <b className="text-white/80">without showing her marks</b>.</li>
                      <li>· A degree cancelled later has to stop verifying, even though signatures never expire.</li>
                    </ul>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {STUDENTS.map((s, i) => (
                      <button key={s.id} onClick={() => { setStudentIdx(i); setCert(null); setChecks(null); }}
                        className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                          i === studentIdx ? 'border-amber-400 bg-amber-500 font-semibold text-black'
                            : 'border-white/15 bg-white/5 text-white/70 hover:border-amber-400/50'}`}>
                        <div className="font-semibold">{s.name}</div>
                        <div className={i === studentIdx ? 'text-black/60' : 'text-white/40'}>{s.qualification}</div>
                      </button>
                    ))}
                  </div>

                  <button onClick={goIssue}
                    className="rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400">
                    Issue her certificate →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ ISSUE */}
          {step === 'issue' && (
            <div className="sc-pop">
              <h2 className="mb-2 text-3xl font-bold">Issued, and sealed</h2>
              <p className="mb-6 max-w-2xl text-white/60">
                Each field is salted and hashed on its own, the hashes are folded into a Merkle
                tree, and the school signs <i>the root</i> — not the document. Signing the root
                is what makes the fourth promise possible: she can later prove one field belongs
                to this certificate without revealing the other ten.
              </p>

              {issuing || !cert ? (
                <div className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-sm text-white/50" style={{ animation: 'sc-pulse .7s infinite' }}>
                    🔏 Hashing fields, building the tree, signing the root…
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl">
                  <div className="mb-4 overflow-hidden rounded-xl border border-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/5 text-white/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Field</th>
                          <th className="px-3 py-2 text-left font-medium">Value</th>
                          <th className="px-3 py-2 text-left font-medium">Salt</th>
                          <th className="px-3 py-2 text-left font-medium">Leaf hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cert.fields.map((f, i) => (
                          <tr key={f.key} className="border-t border-white/5">
                            <td className="px-3 py-1.5 text-white/70">
                              {f.label}
                              {f.sensitive && <span className="ml-1.5 text-[9px] text-amber-300/70">private</span>}
                            </td>
                            <td className="px-3 py-1.5 text-white/85">{f.value}</td>
                            <td className="px-3 py-1.5 font-mono text-[10px] text-white/30">{cert.salts[f.key].slice(0, 10)}…</td>
                            <td className="px-3 py-1.5 font-mono text-[10px] text-cyan-300/70">{cert.leaves[i].slice(0, 16)}…</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="mb-4 text-xs text-white/40">
                    The salt is not decoration. Without it, “CGPA 8.9” is one of a hundred guesses,
                    and anyone holding a leaf hash could brute-force the value it hides — which
                    would make the selective disclosure two screens from here a lie.
                  </p>

                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">Merkle root</div>
                      <div className="break-all font-mono text-[11px] text-cyan-300">{cert.root}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">Content address (IPFS CIDv1)</div>
                      <div className="break-all font-mono text-[11px] text-emerald-300">{cert.cid}</div>
                      <div className="mt-1 text-[10px] text-white/35">
                        Derived from the root, so the certificate cannot change and keep its address.
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">School’s signature over the root</div>
                    <div className="break-all font-mono text-[11px] text-amber-300/80">{cert.signature}</div>
                  </div>

                  <button onClick={goVerify}
                    className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400">
                    Now hand it to an employer →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------- VERIFY */}
          {(step === 'verify' || step === 'forge' || step === 'disclose' || step === 'revoke') && cert && (
            <div className="sc-pop">
              <h2 className="mb-2 text-3xl font-bold">
                {step === 'verify' ? 'Checked in milliseconds, by anyone'
                  : step === 'forge' ? 'Try to change a mark'
                    : step === 'disclose' ? 'Prove the degree, show nothing else'
                      : 'Cancelling a degree that was already signed'}
              </h2>
              <p className="mb-6 max-w-2xl text-white/60">
                {step === 'verify' && 'Four checks, each ruling out a different fraud. All an employer needs is the certificate she hands them and the public key the school publishes — no call, no portal, no login.'}
                {step === 'forge' && 'You are the forger. Edit any field on the certificate; the signature and the proofs stay exactly as the school issued them, because those are the parts you cannot produce.'}
                {step === 'disclose' && 'She is applying for a job that needs to know she has the degree. Choose what the employer sees. Everything you leave off is genuinely not in what they receive — they hold a hash, not a hidden value.'}
                {step === 'revoke' && 'A signature does not stop being valid because a degree was cancelled. That is the awkward part of signed credentials, and it needs its own answer.'}
              </p>

              {/* what is being presented */}
              <div className="mb-5 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-white/85">What the employer receives</span>
                  <span className="font-mono text-[11px] text-white/40">
                    {`${DISCLOSING ? shown.length : cert.fields.length} of ${cert.fields.length} fields`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cert.fields.map((f) => {
                    const visible = DISCLOSING ? shown.includes(f.key) : true;
                    const isForged = forgedField === f.key;
                    return (
                      <span key={f.key}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                          isForged ? 'border-red-500/60 bg-red-500/15 text-red-200'
                            : visible ? 'border-white/15 bg-white/5 text-white/75'
                              : 'border-white/10 bg-transparent text-white/25 line-through'}`}>
                        {f.label}
                        {visible && <b className="ml-1.5 text-white/95">{isForged ? forgedValue : f.value}</b>}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* the checks */}
              {checks && (
                <div className="mb-5 max-w-3xl">
                  <div className="mb-2 flex flex-wrap items-baseline gap-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                      checks.every((c) => c.ok) ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
                      {checks.every((c) => c.ok) ? 'VALID' : 'REJECTED'}
                    </span>
                    <span className="font-mono text-xs text-white/45">
                      four checks in {verifyMs.toFixed(1)} ms, offline
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {checks.map((c) => <CheckRow key={c.id} check={c} />)}
                  </div>
                </div>
              )}

              {/* per-step controls */}
              {step === 'verify' && (
                <button onClick={() => setStep('forge')}
                  className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400">
                  😈 Now try to forge it →
                </button>
              )}

              {step === 'forge' && (
                <div className="max-w-3xl">
                  <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                    <div className="mb-2 text-sm font-semibold text-red-300">Rewrite a field</div>
                    <div className="flex flex-wrap gap-2">
                      {FORGEABLE(cert).map(({ field, to }) => (
                        <button key={field.key}
                          onClick={() => runForgery(field.key, to)}
                          className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-red-500/30">
                          {field.label}: {field.value} → {to}
                        </button>
                      ))}
                    </div>
                  </div>
                  {forgedField && (
                    <p className="mb-4 text-sm text-white/60">
                      Notice which check failed. The school&apos;s <b className="text-white/85">signature still
                      verifies</b> — the forger never touched the root, and could not have produced a
                      new one. What catches this is the Merkle proof: the edited field no longer hashes
                      into the root the school signed.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={restoreHonest} className="rounded-xl bg-white/10 px-5 py-3 text-sm hover:bg-white/20">
                      ↩︎ Restore the honest certificate
                    </button>
                    <button onClick={goDisclose}
                      className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400">
                      Now show an employer less →
                    </button>
                  </div>
                </div>
              )}

              {step === 'disclose' && (
                <div className="max-w-3xl">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-2 text-sm font-semibold text-white/85">Choose what to reveal</div>
                    <div className="flex flex-wrap gap-1.5">
                      {cert.fields.map((f) => {
                        const on = shown.includes(f.key);
                        return (
                          <button key={f.key}
                            onClick={() => runDisclosure(on ? shown.filter((k) => k !== f.key) : [...shown, f.key])}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                              on ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                                : 'border-white/15 bg-white/5 text-white/45 hover:text-white'}`}>
                            {on ? '👁 ' : '🙈 '}{f.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => runDisclosure(MINIMAL_KEYS)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
                        Just enough for a job application
                      </button>
                      <button onClick={() => runDisclosure(cert.fields.map((f) => f.key))} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
                        Everything, the way a photocopy does
                      </button>
                    </div>
                  </div>

                  <p className="mb-4 text-sm text-white/60">
                    Still valid, with{' '}
                    <b className="text-white/85">{sensitiveShown} private field{sensitiveShown === 1 ? '' : 's'}</b>{' '}
                    disclosed out of {cert.fields.filter((f) => f.sensitive).length}. A photocopy cannot
                    do this: paper is all-or-nothing, so every employer who ever asks whether you
                    graduated also learns what you got in Physics.
                  </p>

                  <button onClick={() => setStep('revoke')}
                    className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400">
                    And if the degree is later cancelled? →
                  </button>
                </div>
              )}

              {step === 'revoke' && (
                <div className="max-w-3xl">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-2 text-sm font-semibold text-white/85">
                      The revocation register · {revocations.length} entr{revocations.length === 1 ? 'y' : 'ies'}
                    </div>
                    {revocations.length === 0 ? (
                      <p className="text-sm text-white/45">
                        Empty. A certificate is valid until this register says otherwise — and the
                        register has to be as tamper-evident as the certificates, or it just becomes
                        the new place to lie.
                      </p>
                    ) : (
                      <ol className="space-y-2">
                        {revocations.map((r) => (
                          <li key={r.hash} className="border-l-2 border-red-500/40 pl-3">
                            <div className="text-sm text-white/80">#{r.index} · {r.reason}</div>
                            <div className="break-all font-mono text-[10px] text-white/35">{r.cid}</div>
                            <div className="break-all font-mono text-[10px] text-cyan-300/60">hash {r.hash.slice(0, 32)}…</div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <p className="mb-4 text-sm text-white/60">
                    Watch what happens to the checks: the signature keeps verifying, because a
                    signature is a statement about the past and the past did not change. Only the
                    fourth check moves. That is the honest shape of the problem — revocation is a
                    liveness question, and it cannot be answered by cryptography alone.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={doRevoke} disabled={revocations.length > 0}
                      className="rounded-xl bg-red-500/80 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40">
                      Revoke this degree
                    </button>
                    <button onClick={onClose}
                      className="rounded-xl bg-white/10 px-5 py-3 text-sm hover:bg-white/20">
                      ← Back to town
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------- side rail */}
        <aside className="space-y-4">
          <IntentCard onOpen={onShowIntent} />

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 font-semibold">The problem being solved</div>
            <p className="text-sm text-white/60">
              Verifying an Indian certificate today means telephoning an institution that may not
              answer, so most employers simply do not — which is precisely why forged degrees
              work. The other half is quieter: to prove one fact you hand over everything, forever.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 font-semibold">What&apos;s real in this demo?</div>
            <ul className="space-y-2 text-sm text-white/60">
              <li>🔑 <b className="text-white/80">The signatures</b> — ECDSA P-256 through Web Crypto. The keypair is generated in your browser when this screen opens.</li>
              <li>🌳 <b className="text-white/80">The Merkle tree</b> — genuine SHA-256, one salted leaf per field, and real inclusion proofs.</li>
              <li>📦 <b className="text-white/80">The address</b> — a real IPFS CIDv1: base32 over raw codec plus a sha2-256 multihash. Any IPFS tool would agree.</li>
              <li>⛓ <b className="text-white/80">The revocation register</b> — SHA-256 chained, the same way the voting centre chains blocks.</li>
              <li>🎓 <b className="text-white/80">Not real</b> — the students and their marks are invented, and the school&apos;s key lives for as long as this tab does.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="mb-1 font-semibold text-amber-300">Honest caveat</div>
            <p className="text-xs leading-relaxed text-white/50">
              This proves a certificate is authentic and unaltered. It cannot prove the school was
              honest when it issued one — a corrupt institution signing a real key still produces a
              perfectly valid degree. That is a governance problem, and no amount of cryptography
              moves it. What this does remove is the several million forgeries that are just
              photocopies with a number changed.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 font-semibold">Verify it yourself</div>
            <p className="text-xs leading-relaxed text-white/50">
              Every property on this screen is asserted by a script in the repo —
              <span className="font-mono text-white/70"> npm run verify-school</span> — which runs
              against this exact module: forgery, key substitution, field-moving, salt guessing,
              selective disclosure and revocation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
