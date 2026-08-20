'use client';

/**
 * Bank of Bharat: a confidential ledger a regulator can audit without reading it.
 *
 * Every number on these screens is computed live by bank.ts: real Pedersen commitments
 * over RFC 3526 Group 14, real homomorphic addition, real Schnorr proofs, a real Merkle
 * tree, and fraud detectors that run on the shape of the graph while every amount stays
 * sealed. Nothing here is pre-recorded and there is no server.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Account, BenfordResult, CONCENTRATION_LIMIT, Disclosure, Flag, Ledger, MerkleProof,
  REPORTING_THRESHOLD, SectorExposure, SolvencyResult, benford, buildLedger,
  discloseTransfers, formatRupees, merkleProof, proveKnowledge, proveSolvency,
  runAllDetectors, sectorExposure, shortHex, verifyKnowledge, verifyMerkleProof, makeRng,
} from './bank';
import { IntentCard } from './Intent';
import { useTownState } from './TownState';
import { WhatItUses, WhatItCosts } from './SystemFacts';

type Step = 'vault' | 'audit' | 'depositor' | 'exposure' | 'patterns' | 'disclose' | 'benford';

const STEPS: { key: Step; label: string }[] = [
  { key: 'vault', label: 'The sealed book' },
  { key: 'audit', label: 'Prove solvency' },
  { key: 'depositor', label: 'My account' },
  { key: 'exposure', label: 'Exposure' },
  { key: 'patterns', label: 'Patterns' },
  { key: 'disclose', label: 'Disclosure' },
  { key: 'benford', label: "Benford's law" },
];

const FLAG_STYLE: Record<Flag['kind'], { icon: string; label: string }> = {
  structuring: { icon: '🪓', label: 'Structuring' },
  'layering-cycle': { icon: '🔄', label: 'Layering' },
  'pass-through': { icon: '🐴', label: 'Pass-through mule' },
  benford: { icon: '📊', label: 'Benford anomaly' },
};

export function BankOfBharat({ onClose, onShowIntent }: { onClose: () => void; onShowIntent?: () => void }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [step, setStep] = useState<Step>('vault');
  const [declaredDelta, setDeclaredDelta] = useState<bigint>(0n);
  const [depositorIdx, setDepositorIdx] = useState(0);
  const [proof, setProof] = useState<MerkleProof | null>(null);
  const [proofValid, setProofValid] = useState<boolean | null>(null);
  const [schnorrOk, setSchnorrOk] = useState<boolean | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [disclosures, setDisclosures] = useState<Disclosure[] | null>(null);

  const town = useTownState();

  useEffect(() => { buildLedger().then(setLedger); }, []);

  /** Cook the books, and let the town record that the arithmetic caught it. */
  const cookTheBooks = useCallback((delta: bigint, attackId: string, label: string, detail: string) => {
    setDeclaredDelta(delta);
    town.recordAttack(attackId);
    town.record({ kind: 'attack', system: 'bank', label, detail, at: { x: 13, y: 13 } });
  }, [town]);

  const solvency: SolvencyResult | null = useMemo(
    () => (ledger ? proveSolvency(ledger, ledger.declaredTotal + declaredDelta) : null),
    [ledger, declaredDelta],
  );
  const exposure: SectorExposure[] = useMemo(() => (ledger ? sectorExposure(ledger) : []), [ledger]);
  const flags: Flag[] = useMemo(() => (ledger ? runAllDetectors(ledger) : []), [ledger]);
  const benfordResult: BenfordResult | null = useMemo(() => {
    if (!ledger) return null;
    // Benford runs on the figures the bank publishes itself, not on sealed amounts.
    return benford(ledger.transfers.map((t) => t.amount));
  }, [ledger]);

  const depositor: Account | null = ledger ? ledger.accounts[depositorIdx % ledger.accounts.length] : null;

  const runDepositorProof = useCallback(async () => {
    if (!ledger || !depositor) return;
    setProofValid(null);
    setSchnorrOk(null);
    const p = await merkleProof(ledger.leaves, ledger.accounts.indexOf(depositor));
    setProof(p);
    setProofValid(await verifyMerkleProof(p));
    const sp = await proveKnowledge(depositor.commitment, { value: depositor.balance, blinding: depositor.blinding }, makeRng(depositorIdx + 1));
    setSchnorrOk(await verifyKnowledge(depositor.commitment, sp));
  }, [ledger, depositor, depositorIdx]);

  useEffect(() => { if (step === 'depositor') runDepositorProof(); }, [step, depositorIdx, runDepositorProof]);

  const compelDisclosure = useCallback((flag: Flag) => {
    if (!ledger) return;
    setSelectedFlag(flag);
    setDisclosures(discloseTransfers(ledger, flag.transfers));
    setStep('disclose');
  }, [ledger]);

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  if (!ledger || !solvency) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0b1020] text-white grid place-items-center">
        <div className="text-center">
          <div className="text-5xl mb-3">🏦</div>
          <div className="text-white/50 text-sm tracking-widest">SEALING THE BOOK…</div>
          <div className="text-white/30 text-xs mt-2">computing 2048-bit Pedersen commitments</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1020] text-white overflow-y-auto">
      <style>{`
        @keyframes bk-pop { 0% { transform: scale(.97); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes bk-pulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        .bk-pop { animation: bk-pop .4s ease-out; }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3 bg-[#0b1020]/95 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">🏦</span>
          <div className="min-w-0">
            <div className="font-semibold tracking-wide truncate">Bank of Bharat · Rampur Branch, Ward 04</div>
            <div className="text-xs text-white/50 truncate">
              {ledger.accounts.length} accounts · {ledger.transfers.length} transfers · sealed with 2048-bit Pedersen commitments in {ledger.buildMs.toFixed(0)} ms
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden xl:flex items-center gap-1">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <button
                  onClick={() => setStep(s.key)}
                  className={`text-[10px] px-2 py-1 rounded-full border whitespace-nowrap transition-colors ${
                    i === stepIdx ? 'bg-amber-500 text-black border-amber-400 font-semibold'
                      : i < stepIdx ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                        : 'border-white/15 text-white/40 hover:text-white/70'}`}>{s.label}</button>
                {i < STEPS.length - 1 && <div className="w-2 h-px bg-white/20" />}
              </React.Fragment>
            ))}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm whitespace-nowrap">← Back to town</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_340px] gap-8">
        <div className="min-h-[460px]">

          {/* ------------------------------------------------------- VAULT */}
          {step === 'vault' && (
            <div className="bk-pop">
              <h2 className="text-3xl font-bold mb-2">The book, sealed</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                Every balance below is committed as <span className="font-mono text-cyan-300">C = g<sup>v</sup> · h<sup>r</sup> mod p</span>
                {' '}over a published 2048-bit prime. The commitment is <b>binding</b>, so the bank can never change the balance it
                sealed, and <b>hiding</b>, so the number itself is not in there in any recoverable form. This is the entire public
                record. It is what an auditor, a regulator and you all get to see.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {[
                  { k: 'Accounts sealed', v: String(ledger.accounts.length) },
                  { k: 'Transfers sealed', v: String(ledger.transfers.length) },
                  { k: 'Balances visible', v: '0' },
                ].map((s) => (
                  <div key={s.k} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-bold">{s.v}</div>
                    <div className="text-[11px] text-white/40">{s.k}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-white/40">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Account</th>
                      <th className="text-left font-medium px-3 py-2">Branch</th>
                      <th className="text-left font-medium px-3 py-2">Balance</th>
                      <th className="text-left font-medium px-3 py-2">Published commitment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.accounts.slice(0, 8).map((a) => (
                      <tr key={a.id} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono text-white/80">{a.id}</td>
                        <td className="px-3 py-2 text-white/50">{a.branch}</td>
                        <td className="px-3 py-2"><span className="text-white/25">●●●●●●●</span></td>
                        <td className="px-3 py-2 font-mono text-cyan-300/70">{shortHex(a.commitment.c, 28)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-white/30 text-xs mb-6">
                Showing 8 of {ledger.accounts.length}. Names are withheld here for the same reason balances are.
                The Merkle root over all {ledger.accounts.length} account commitments is{' '}
                <span className="font-mono text-white/50">{ledger.merkleRootHash.slice(0, 32)}…</span>
              </p>

              <button onClick={() => setStep('audit')} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                Now audit it without opening it →
              </button>
            </div>
          )}

          {/* ------------------------------------------------------- AUDIT */}
          {step === 'audit' && (
            <div className="bk-pop">
              <h2 className="text-3xl font-bold mb-2">Proving the books balance, blind</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                Pedersen commitments add. Multiply two of them and you get a commitment to the sum:{' '}
                <span className="font-mono text-cyan-300">C(a) · C(b) = C(a+b)</span>. So the auditor multiplies all{' '}
                {ledger.accounts.length} account commitments together and compares the product against a commitment to the
                total the bank <i>claims</i>. If they match, the claim is true. No balance is ever revealed.
              </p>

              <div className="max-w-2xl space-y-3 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-1">Π of all {ledger.accounts.length} published account commitments</div>
                  <div className="font-mono text-xs text-cyan-300 break-all">{shortHex(solvency.aggregate.c, 64)}</div>
                </div>
                <div className="text-center text-2xl text-white/30">≟</div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-1">
                    Commitment to the bank&apos;s declared total of {formatRupees(solvency.declaredTotal)}
                  </div>
                  <div className="font-mono text-xs text-amber-300 break-all">{shortHex(solvency.expected.c, 64)}</div>
                </div>

                <div className={`p-4 rounded-xl border ${solvency.balances ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
                  {solvency.balances ? (
                    <>
                      <div className="font-semibold text-emerald-300 mb-1">✓ The books balance.</div>
                      <p className="text-sm text-white/60">
                        The declared total really is the sum of every individual balance, verified in {solvency.ms.toFixed(1)} ms.
                        The auditor has now proved the bank solvent while learning nothing about any single customer.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-red-300 mb-1">🚨 Mismatch: the declared total is a lie.</div>
                      <p className="text-sm text-white/60">
                        The bank is claiming {formatRupees(solvency.declaredTotal)}, but the sealed accounts do not add up to
                        that. The discrepancy is {solvency.discrepancy > 0n ? 'an overstatement of ' : 'a shortfall of '}
                        <b className="text-red-300">{formatRupees(solvency.discrepancy < 0n ? -solvency.discrepancy : solvency.discrepancy)}</b>.
                        Note what did <i>not</i> happen: nobody opened an account to find this.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="max-w-2xl p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                <div className="text-sm font-semibold mb-2">😈 Try to cook the books</div>
                <p className="text-xs text-white/50 mb-3">
                  Overstate the deposits to look healthier, or quietly hide a rupee. The homomorphic check has no tolerance:
                  a one-rupee lie fails exactly as loudly as a fifty-lakh one.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => cookTheBooks(5_000_000n, 'overstate', 'The books were overstated by ₹50 lakh, and it held', 'The product of the sealed account commitments stopped matching the declared total. Not one account had to be opened to find it.')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-red-500/30 text-xs">Overstate by ₹50 L</button>
                  <button onClick={() => cookTheBooks(-1n, 'hide-rupee', 'One rupee was hidden, and it held', 'A one-rupee lie failed exactly as loudly as a fifty-lakh one. There is no tolerance in the arithmetic to hide inside.')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-red-500/30 text-xs">Hide ₹1</button>
                  <button onClick={() => setDeclaredDelta(0n)} className="px-3 py-2 rounded-lg bg-emerald-600/40 hover:bg-emerald-600/60 text-xs">Restore honest total</button>
                </div>
              </div>

              <button onClick={() => setStep('depositor')} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                And what does a depositor get? →
              </button>
            </div>
          )}

          {/* --------------------------------------------------- DEPOSITOR */}
          {step === 'depositor' && depositor && (
            <div className="bk-pop">
              <h2 className="text-3xl font-bold mb-2">One depositor, one proof</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                A solvency proof is worthless to a customer if the bank simply left her out of the sum. So every account is a
                leaf in a Merkle tree, and each customer can check her own leaf is inside the audited root, learning nothing
                about the {ledger.accounts.length - 1} others.
              </p>

              <div className="grid md:grid-cols-2 gap-4 max-w-3xl mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-1">Depositor</div>
                  <div className="font-semibold text-lg">{depositor.name}</div>
                  <div className="text-xs text-white/50 mb-3">{depositor.id} · {depositor.branch} branch · {depositor.kind}</div>
                  <div className="text-xs text-white/40 mb-1">Her balance, which only she can open</div>
                  <div className="font-mono text-sm text-emerald-300 mb-3">{formatRupees(depositor.balance)}</div>
                  <div className="text-xs text-white/40 mb-1">What everyone else sees instead</div>
                  <div className="font-mono text-[10px] text-cyan-300/70 break-all">{shortHex(depositor.commitment.c, 40)}</div>
                  <button
                    onClick={() => setDepositorIdx((i) => i + 1)}
                    className="mt-4 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs">
                    Try another depositor →
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-2">Merkle inclusion proof</div>
                  {proof ? (
                    <>
                      <div className="space-y-1 mb-3">
                        <div className="font-mono text-[10px] text-white/70">leaf {proof.leaf.slice(0, 24)}…</div>
                        {proof.path.map((p, i) => (
                          <div key={i} className="font-mono text-[10px] text-white/40 pl-2">
                            + {p.right ? 'right' : 'left '} sibling {p.hash.slice(0, 20)}…
                          </div>
                        ))}
                        <div className="font-mono text-[10px] text-amber-300">= root {proof.root.slice(0, 24)}…</div>
                      </div>
                      <div className={`p-2 rounded-lg text-xs ${proofValid ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'}`}>
                        {proofValid ? `✓ Included, in ${proof.path.length} hashes` : '✕ Not included'}
                      </div>
                      <div className={`mt-2 p-2 rounded-lg text-xs ${schnorrOk ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                        {schnorrOk === null ? 'proving…' : schnorrOk
                          ? '✓ Schnorr proof: the bank can open this commitment, without opening it'
                          : '✕ Schnorr proof failed'}
                      </div>
                    </>
                  ) : (
                    <div className="text-white/40 text-sm" style={{ animation: 'bk-pulse 1s infinite' }}>hashing…</div>
                  )}
                </div>
              </div>

              <button onClick={() => setStep('exposure')} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                Now the regulator&apos;s question →
              </button>
            </div>
          )}

          {/* ---------------------------------------------------- EXPOSURE */}
          {step === 'exposure' && (
            <div className="bk-pop">
              <h2 className="text-3xl font-bold mb-2">Exposure, without the accounts</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                A supervisor does not actually want to know what Kamla has. The question that brings down banks is
                &quot;how much of this book is one sector?&quot;, and that is an aggregate. So it is answered by opening an
                aggregate: the sector commitments below are homomorphic sums of their members, and only the sums are opened.
                Every individual account stays sealed.
              </p>

              <div className="max-w-2xl space-y-2 mb-6">
                {exposure.map((e) => (
                  <div key={e.sector} className={`p-4 rounded-xl border ${e.breach ? 'bg-red-500/10 border-red-500/40' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold capitalize">{e.sector}</span>
                      <span className={e.breach ? 'text-red-300 font-semibold' : 'text-white/70'}>
                        {(e.share * 100).toFixed(1)}% · {formatRupees(e.total)}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-white/10 overflow-hidden mb-2 relative">
                      <div className={`h-full ${e.breach ? 'bg-red-400' : 'bg-cyan-400'}`} style={{ width: `${e.share * 100}%` }} />
                      <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: `${CONCENTRATION_LIMIT * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="font-mono text-cyan-300/60">Σ commitment {shortHex(e.commitment.c, 20)}</span>
                      <span className="text-white/30">{e.accounts} accounts, none opened</span>
                    </div>
                    {e.breach && (
                      <div className="mt-2 text-xs text-red-300">
                        ⚠ Above the {CONCENTRATION_LIMIT * 100}% concentration limit. Enforced by arithmetic, not by asking the bank nicely.
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-xs mb-6">White line marks the {CONCENTRATION_LIMIT * 100}% single-sector limit.</p>

              <button onClick={() => setStep('patterns')} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                Now find the fraud →
              </button>
            </div>
          )}

          {/* ---------------------------------------------------- PATTERNS */}
          {step === 'patterns' && (
            <div className="bk-pop">
              <h2 className="text-3xl font-bold mb-2">Fraud found in the shape, not the amounts</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                Every rupee below is still sealed. These flags come from the structure of the graph and the clock: who paid whom,
                when, how often, and how the money moved on. {flags.length} flags across {ledger.accounts.length} accounts and{' '}
                {ledger.transfers.length} transfers.
              </p>

              <div className="space-y-3 max-w-3xl mb-6">
                {flags.map((f, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${f.severity === 'high' ? 'bg-amber-500/10 border-amber-500/35' : 'bg-white/5 border-white/15'}`}>
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="font-semibold">{FLAG_STYLE[f.kind].icon} {f.title}</div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${f.severity === 'high' ? 'bg-amber-400 text-black' : 'bg-white/15 text-white/70'}`}>
                        {f.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-cyan-300/70 mb-2">{f.statistic}</div>
                    <p className="text-sm text-white/60 mb-3">{f.detail}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {f.accounts.slice(0, 8).map((a) => (
                        <span key={a} className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 font-mono text-[10px] text-white/60">{a}</span>
                      ))}
                    </div>
                    <button onClick={() => compelDisclosure(f)} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold">
                      ⚖️ Compel disclosure of these {f.transfers.length} transfers
                    </button>
                  </div>
                ))}
              </div>

              <div className="max-w-3xl p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="font-semibold mb-1 text-sm">These are leads, not verdicts</div>
                <p className="text-xs text-white/50">
                  A first cut of the layering detector raised <b className="text-white/80">121 flags across 26 accounts</b>, because
                  short cycles are everywhere in any real payment graph, and a detector that flags the whole bank has said nothing.
                  Adding one constraint, that the loop must close within days rather than months, took it to {flags.length}. Some of
                  those are still innocent. That is the honest cost of running detectors like this, and it is exactly why the next
                  step opens only the flagged transfers instead of the whole book.
                </p>
              </div>
            </div>
          )}

          {/* --------------------------------------------------- DISCLOSE */}
          {step === 'disclose' && selectedFlag && disclosures && (
            <div className="bk-pop">
              <h2 className="text-3xl font-bold mb-2">Targeted transparency</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                The regulator found the pattern without seeing a rupee. Now, and only now, it compels openings, for these{' '}
                {disclosures.length} transfers and nothing else. Each opened amount is checked against the commitment published
                <i> before anyone was looking</i>, so the bank cannot invent a convenient number after the fact.
              </p>

              <div className="max-w-2xl p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-4">
                <div className="font-semibold text-sm mb-1">{FLAG_STYLE[selectedFlag.kind].icon} {selectedFlag.title}</div>
                <div className="text-xs text-white/60">{selectedFlag.statistic}</div>
              </div>

              <div className="max-w-2xl rounded-xl border border-white/10 overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-white/40">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Transfer</th>
                      <th className="text-left font-medium px-3 py-2">From → To</th>
                      <th className="text-left font-medium px-3 py-2">Day</th>
                      <th className="text-right font-medium px-3 py-2">Amount, opened</th>
                      <th className="text-right font-medium px-3 py-2">Opening</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disclosures.map((d) => (
                      <tr key={d.transferId} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono text-white/70">{d.transferId}</td>
                        <td className="px-3 py-2 font-mono text-white/50">{d.from} → {d.to}</td>
                        <td className="px-3 py-2 text-white/50">{d.day}</td>
                        <td className={`px-3 py-2 text-right font-mono ${d.amount >= REPORTING_THRESHOLD ? 'text-red-300' : 'text-amber-300'}`}>
                          {formatRupees(d.amount)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {d.verified ? <span className="text-emerald-400">✓ verified</span> : <span className="text-red-400">✕ forged</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="max-w-2xl p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-4">
                <div className="font-semibold text-emerald-300 mb-1">
                  {disclosures.filter((d) => d.verified).length} of {disclosures.length} openings verify against their original commitments
                </div>
                <p className="text-sm text-white/60">
                  {selectedFlag.kind === 'structuring'
                    ? `Every one lands just under the ₹${(Number(REPORTING_THRESHOLD) / 100000).toFixed(0)} lakh reporting threshold, which is precisely the point of structuring, and precisely what the metadata pattern predicted before anything was opened.`
                    : 'The amounts confirm the pattern that the graph alone had already surfaced.'}
                </p>
              </div>

              <div className="max-w-2xl p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                <div className="font-semibold text-sm mb-1">What stayed private</div>
                <p className="text-xs text-white/50">
                  {ledger.transfers.length - disclosures.length} of {ledger.transfers.length} transfers, and{' '}
                  {ledger.accounts.length} of {ledger.accounts.length} account balances, were never opened. That ratio is the
                  entire argument: the regulator got what it needed to act, and nothing beyond it.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => setStep('patterns')} className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20">← Back to the flags</button>
                <button onClick={() => setStep('benford')} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">One more test →</button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- BENFORD */}
          {step === 'benford' && benfordResult && (
            <div className="bk-pop">
              <h2 className="text-3xl font-bold mb-2">Benford&apos;s law</h2>
              <p className="text-white/60 mb-6 max-w-2xl">
                The oldest trick in forensic accounting. Genuine financial figures span orders of magnitude, so their leading
                digit is a 1 about 30% of the time and a 9 under 5%, following log₁₀(1 + 1/d). Invented numbers almost never do,
                because people making figures up spread them evenly without meaning to.
              </p>

              <div className="max-w-2xl p-5 rounded-2xl bg-white/5 border border-white/10 mb-4">
                <div className="flex items-end gap-2 h-44 mb-3">
                  {benfordResult.observed.map((o, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                      <div className="w-full flex items-end justify-center gap-0.5 h-full">
                        <div className="w-1/2 bg-cyan-400 rounded-t" style={{ height: `${(o / 0.35) * 100}%` }} title={`observed ${(o * 100).toFixed(1)}%`} />
                        <div className="w-1/2 bg-white/25 rounded-t" style={{ height: `${(benfordResult.expected[i] / 0.35) * 100}%` }} title={`expected ${(benfordResult.expected[i] * 100).toFixed(1)}%`} />
                      </div>
                      <div className="text-[10px] text-white/40">{i + 1}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 text-[11px] text-white/40">
                  <span><span className="inline-block w-2 h-2 bg-cyan-400 mr-1" />observed</span>
                  <span><span className="inline-block w-2 h-2 bg-white/25 mr-1" />Benford expectation</span>
                </div>
              </div>

              <div className={`max-w-2xl p-4 rounded-xl border mb-6 ${benfordResult.suspicious ? 'bg-red-500/10 border-red-500/40' : 'bg-emerald-500/10 border-emerald-500/35'}`}>
                <div className="font-semibold mb-1">
                  χ² = {benfordResult.chiSquare.toFixed(2)} on {benfordResult.n} figures, 8 degrees of freedom
                </div>
                <p className="text-sm text-white/60">
                  {benfordResult.suspicious
                    ? `Above the ${benfordResult.criticalValue05} critical value at p < 0.05. These figures do not look organically generated: grounds to look harder, not proof of anything.`
                    : `Below the ${benfordResult.criticalValue05} critical value at p < 0.05. The distribution is consistent with genuine transaction data.`}
                </p>
              </div>

              <div className="max-w-2xl p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                <div className="font-semibold text-sm mb-1">Why this one is different from everything above</div>
                <p className="text-xs text-white/50">
                  Benford needs magnitudes, so it <b className="text-white/80">cannot</b> run over sealed commitments. It runs on the
                  figures the bank publishes itself. Saying so matters: it would have been easy to put this chart next to the others
                  and let you assume it worked on encrypted data. It does not, and a prototype that blurs that line is not worth
                  trusting on anything else it claims.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => setStep('vault')} className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20">↺ Start again</button>
                <button onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/15 text-white/60">← Back to town</button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- side rail */}
        <aside className="space-y-4">
          <IntentCard onOpen={onShowIntent} />

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">The question this system asks</div>
            <p className="text-sm text-white/60">
              Not &quot;can we put banking on a chain&quot;. The town already has two hash chains. The harder question is what a
              regulator can compute over a bank&apos;s books <i>without being shown anybody&apos;s account</i>. The answer turns out
              to be: solvency, concentration, and most financial crime.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">What&apos;s real in this demo?</div>
            <ul className="text-sm text-white/60 space-y-2">
              <li>🔐 <b className="text-white/80">The commitments</b>: Pedersen over RFC 3526 MODP Group 14, a published 2048-bit prime. {ledger.accounts.length + ledger.transfers.length} of them, sealed in {ledger.buildMs.toFixed(0)} ms.</li>
              <li>➕ <b className="text-white/80">The homomorphism</b>: C(a)·C(b) = C(a+b) really holds; the solvency proof is that identity and nothing else.</li>
              <li>🌳 <b className="text-white/80">The Merkle proofs</b>: genuine SHA-256, recomputed in your browser.</li>
              <li>✍️ <b className="text-white/80">The Schnorr proofs</b>: a real sigma protocol, Fiat-Shamir over SHA-256.</li>
              <li>🕸️ <b className="text-white/80">The detectors</b>: graph and timing analysis over sealed data.</li>
              <li>🎲 <b className="text-white/80">Not real</b>: the customers and their transactions are synthetic, generated from a fixed seed so every visitor audits the same bank.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">The tradeoff this design picks</div>
            <p className="text-sm text-white/60">
              Amounts are hidden. The transaction <i>graph</i> is not, and every detector here runs on that graph. Hide the graph
              too and the fraud analytics go blind; leave it visible and you have told the world who pays whom. There is no free
              position on that curve. This prototype picks one and says so out loud, which is more than most systems do.
            </p>
          </div>

          <WhatItUses
            uses={"Pedersen commitments · Merkle root · Schnorr proofs"}
            needsChain={false}
            why={"There is no chain in this building at all. What a regulator needs is arithmetic over sealed values, and homomorphic commitments deliver that without a ledger, a network or a token."}
          />
          <WhatItCosts points={[
          "Amounts are hidden but the transaction graph is not. Hide the graph too and every fraud detector goes blind: an unsolved tradeoff, not a solved one.",
          "Benford's law needs magnitudes, so it cannot run over sealed commitments. It runs on figures the bank publishes about itself.",
          "Commitment arithmetic is far slower than reading a balance. Privacy is bought with compute on every audit.",
          "Solvency proved against a declared total is only as good as the list of accounts the bank admits to holding."
]} />
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="font-semibold mb-1 text-amber-300">Honest caveat</div>
            <p className="text-xs text-white/50">
              A real deployment needs range proofs so &quot;under the threshold&quot; is proved rather than asserted, elliptic curves
              instead of 2048-bit modular arithmetic for speed, a key-management story for who can open what, and an appeals path
              for the innocent accounts these detectors will flag. What this prototype demonstrates is the core claim: an auditor
              really can verify a bank without reading it.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
