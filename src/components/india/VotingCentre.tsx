'use client';

/**
 * Digital Voting Centre — a working blockchain voting demo.
 * Every hash is real SHA-256 (Web Crypto). Mining is real proof-of-work.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  VoteBlock, createGenesisBlock, mineBlock, makeVoterToken,
  verifyChain, tally, DIFFICULTY_PREFIX, sha256,
} from './blockchain';
import { IntentCard } from './Intent';
import { ArrivalScene, CitizenPortrait, useWalkToBooth } from './ArrivalScene';

const CANDIDATES = [
  { id: 'pragati', name: 'Pragati Party', icon: '🌾', color: '#f59e0b' },
  { id: 'janshakti', name: 'Jan Shakti', icon: '🔆', color: '#ef4444' },
  { id: 'navbharat', name: 'Nav Bharat', icon: '🚀', color: '#3b82f6' },
  { id: 'haritdal', name: 'Harit Dal', icon: '🌳', color: '#22c55e' },
];

const CITIZENS = [
  { name: 'Asha Devi', age: 34, village: 'Rampur' },
  { name: 'Ravi Kumar', age: 52, village: 'Rampur' },
  { name: 'Meena Kumari', age: 27, village: 'Basantpur' },
  { name: 'Arjun Singh', age: 41, village: 'Rampur' },
  { name: 'Lakshmi Bai', age: 63, village: 'Basantpur' },
  { name: 'Kiran Patel', age: 29, village: 'Rampur' },
];

type Step = 'arrive' | 'identity' | 'ballot' | 'seal' | 'mine' | 'chain' | 'results';

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'arrive', label: 'Arrive' },
  { key: 'identity', label: 'Identity' },
  { key: 'ballot', label: 'Ballot' },
  { key: 'seal', label: 'Seal' },
  { key: 'mine', label: 'Mine' },
  { key: 'chain', label: 'Chain' },
  { key: 'results', label: 'Results' },
];

export function VotingCentre({ onClose, onShowIntent }: { onClose: () => void; onShowIntent?: () => void }) {
  const [step, setStep] = useState<Step>('arrive');
  const [chain, setChain] = useState<VoteBlock[]>([]);
  const [citizenIdx, setCitizenIdx] = useState(0);
  const [voterToken, setVoterToken] = useState('');
  const [scanPct, setScanPct] = useState(0);
  const [choice, setChoice] = useState<typeof CANDIDATES[0] | null>(null);
  const [sealHash, setSealHash] = useState('');
  const [miningNonce, setMiningNonce] = useState(0);
  const [miningHash, setMiningHash] = useState('');
  const [mined, setMined] = useState(false);
  const [chainCheck, setChainCheck] = useState<{ valid: boolean; brokenAt: number[] }>({ valid: true, brokenAt: [] });
  const [tamperTarget, setTamperTarget] = useState<number | null>(null);
  const [votesAlreadyCast, setVotesAlreadyCast] = useState<Set<string>>(new Set());
  const [rollTokens, setRollTokens] = useState<Record<string, string>>({});
  const chainRef = useRef<HTMLDivElement>(null);
  /**
   * The vote each block honestly recorded, kept so "restore the honest chain" puts the real
   * result back. Re-mining an attacker's edit would produce a valid-looking chain carrying
   * the forged vote, which is the opposite of the lesson this screen exists to teach.
   */
  const honestVotesRef = useRef<Map<number, string>>(new Map());

  const citizen = CITIZENS[citizenIdx % CITIZENS.length];

  // Boot the chain with a genesis block
  useEffect(() => {
    createGenesisBlock().then((g) => setChain([g]));
  }, []);

  // Derive every voter's anonymous token up front, so the electoral roll can be checked
  // against the public ledger before anyone is let anywhere near a ballot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        CITIZENS.map(async (c) => [c.name, await makeVoterToken(`${c.name}-${c.village}`)] as const),
      );
      if (!cancelled) setRollTokens(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, []);

  // scroll chain view to the end when it grows
  useEffect(() => {
    chainRef.current?.scrollTo({ left: chainRef.current.scrollWidth, behavior: 'smooth' });
  }, [chain.length]);

  const startIdentity = useCallback(async () => {
    setStep('identity');
    setScanPct(0);
    const token = await makeVoterToken(`${citizen.name}-${citizen.village}`);
    // animate the scan
    let p = 0;
    const iv = setInterval(() => {
      p += 4;
      setScanPct(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(iv);
        setVoterToken(token);
        setTimeout(() => setStep('ballot'), 900);
      }
    }, 60);
  }, [citizen]);

  const castVote = useCallback(async (cand: typeof CANDIDATES[0]) => {
    setChoice(cand);
    setStep('seal');
    const payload = `${voterToken} → ${cand.name}`;
    const h = await sha256(payload);
    // reveal the hash slowly for drama
    for (let i = 8; i <= 64; i += 8) {
      await new Promise((r) => setTimeout(r, 120));
      setSealHash(h.slice(0, i));
    }
    setTimeout(() => beginMining(cand), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterToken, chain]);

  const beginMining = useCallback(async (cand: typeof CANDIDATES[0]) => {
    setStep('mine');
    setMined(false);
    const prev = chain[chain.length - 1];
    const block = await mineBlock(
      {
        index: prev.index + 1,
        timestamp: Date.now(),
        voterToken,
        candidate: cand.id,
        prevHash: prev.hash,
      },
      (nonce, hash) => { setMiningNonce(nonce); setMiningHash(hash); },
    );
    setMined(true);
    setMiningHash(block.hash);
    setTimeout(() => {
      setChain((c) => [...c, block]);
      setVotesAlreadyCast((s) => new Set(s).add(voterToken));
      setStep('chain');
    }, 1200);
  }, [chain, voterToken]);

  // The walk to the booth. Its arrival is what advances the journey, so the step change is
  // the end of a movement rather than an unrelated jump.
  const walk = useWalkToBooth(startIdentity);

  const goToCitizen = useCallback((index: number) => {
    walk.reset();
    setCitizenIdx(((index % CITIZENS.length) + CITIZENS.length) % CITIZENS.length);
    setChoice(null);
    setSealHash('');
    setMiningNonce(0);
    setMiningHash('');
    setVoterToken('');
    setScanPct(0);
    setStep('arrive');
  }, [walk]);

  const nextVoter = useCallback(() => {
    goToCitizen(citizenIdx + 1);
  }, [goToCitizen, citizenIdx]);

  const tamperBlock = useCallback(async (idx: number, newCandidate: string) => {
    const copy = chain.map((b) => ({ ...b }));
    // Remember the real vote the first time this block is attacked.
    if (!honestVotesRef.current.has(copy[idx].index)) {
      honestVotesRef.current.set(copy[idx].index, copy[idx].candidate);
    }
    copy[idx].candidate = newCandidate;
    setChain(copy);
    setTamperTarget(null);
    const check = await verifyChain(copy);
    setChainCheck(check);
  }, [chain]);

  const repairChain = useCallback(async () => {
    const firstBroken = chainCheck.brokenAt[0];
    if (firstBroken === undefined || firstBroken < 1) return;

    // The honest network does not re-seal the attacker's edit — it discards it and rebuilds
    // from the last good block, so the votes that come back are the ones really cast.
    let fixed = chain.map((b) => {
      const honest = honestVotesRef.current.get(b.index);
      return honest !== undefined ? { ...b, candidate: honest } : { ...b };
    });
    for (let i = firstBroken; i < fixed.length; i++) {
      const prev = fixed[i - 1];
      const b = fixed[i];
      const remined = await mineBlock({
        index: b.index, timestamp: b.timestamp, voterToken: b.voterToken,
        candidate: b.candidate, prevHash: prev.hash,
      });
      fixed = fixed.map((x, j) => (j === i ? remined : x));
      setChain([...fixed]);
    }
    honestVotesRef.current.clear();
    const check = await verifyChain(fixed);
    setChainCheck(check);
  }, [chain, chainCheck]);

  const counts = tally(chain);
  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
  const stepIdx = STEP_LABELS.findIndex((s) => s.key === step);

  // The electoral roll, checked against the public ledger. A token that appears in a block
  // has voted; there is no path in this UI that offers that citizen a second ballot.
  const citizenToken = rollTokens[citizen.name] ?? '';
  const priorBlock = citizenToken ? chain.find((b) => b.index > 0 && b.voterToken === citizenToken) : undefined;
  const alreadyVoted = !!priorBlock || (!!citizenToken && votesAlreadyCast.has(citizenToken));
  const rollStatus = CITIZENS.map((c) => {
    const t = rollTokens[c.name];
    return { ...c, token: t, voted: !!t && votesAlreadyCast.has(t) };
  });
  const everyoneVoted = rollStatus.length > 0 && rollStatus.every((r) => r.voted);

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1020] text-white overflow-y-auto">
      <style>{`
        @keyframes vc-walk { 0% { transform: translateX(-140px); } 100% { transform: translateX(0); } }
        @keyframes vc-scan { 0% { top: 0; } 50% { top: calc(100% - 4px); } 100% { top: 0; } }
        @keyframes vc-pulse { 0%,100% { opacity: .4 } 50% { opacity: 1 } }
        @keyframes vc-pop { 0% { transform: scale(.97); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        /* No fill-mode: a throttled or background tab can leave an animation unstarted, and
           with 'both' the panel would sit on the 0% keyframe (opacity 0) — invisible content
           rather than an un-animated one. The resting style must be the visible one. */
        .vc-pop { animation: vc-pop .4s ease-out; }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-[#0b1020]/95 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗳️</span>
          <div>
            <div className="font-semibold tracking-wide">Digital Voting Centre — Ward 04, Rampur</div>
            <div className="text-xs text-white/50">General Election 2047 · Every step below is real cryptography running in your browser</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1">
            {STEP_LABELS.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`text-[11px] px-2 py-1 rounded-full border ${i === stepIdx ? 'bg-amber-500 text-black border-amber-400 font-semibold' : i < stepIdx ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300' : 'border-white/15 text-white/40'}`}>{s.label}</div>
                {i < STEP_LABELS.length - 1 && <div className="w-3 h-px bg-white/20" />}
              </React.Fragment>
            ))}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm">← Back to town</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_360px] gap-8">
        {/* ------- Main stage ------- */}
        <div className="min-h-[420px]">
          {step === 'arrive' && (
            <div className="vc-pop">
              <h2 className="text-3xl font-bold mb-2">A citizen arrives to vote</h2>
              <p className="text-white/60 mb-6 max-w-xl">In Bharat 2047, a vote is cast in a booth — but recorded on a public, tamper-evident blockchain that anyone can audit, while the voter stays anonymous.</p>

              <ArrivalScene phase={walk.phase} citizenName={citizen.name} paletteIndex={citizenIdx} />

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-0.5">Voter</div>
                  <div className="font-semibold">{citizen.name}</div>
                  <div className="text-xs text-white/50">{citizen.age} yrs · {citizen.village} village</div>
                  <div className="font-mono text-[10px] text-cyan-300/70 mt-1">{citizenToken || '…'}</div>
                </div>

                {alreadyVoted ? (
                  <div className="flex-1 min-w-[280px] p-4 rounded-xl bg-red-500/10 border border-red-500/40">
                    <div className="font-semibold text-red-300 mb-1">⛔ {citizen.name} has already voted.</div>
                    <p className="text-sm text-white/60">
                      Her token is already sealed into{' '}
                      <b className="text-white/80">block #{priorBlock?.index ?? '—'}</b> of the public chain, so the roll
                      check refuses her at the door. There is no second ballot to offer her — not here, and not
                      anywhere else in this booth.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={nextVoter} disabled={everyoneVoted}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-black text-sm font-semibold">
                        🚶 Next citizen →
                      </button>
                      <button onClick={() => setStep('chain')}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
                        🔗 View the chain
                      </button>
                    </div>
                    {everyoneVoted && (
                      <p className="text-[11px] text-white/40 mt-2">Every citizen on this roll has now voted.</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={walk.start}
                    disabled={walk.phase !== 'waiting'}
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 disabled:cursor-default text-black font-semibold text-lg shadow-lg shadow-amber-500/20 transition-colors">
                    {walk.phase === 'waiting' ? 'Enter the booth →' : 'Walking to the booth…'}
                  </button>
                )}
              </div>

              {/* The roll itself. Choosing a citizen decides who walks in next — it never
                  offers anyone a second vote; the ones already on the chain are refused. */}
              <div className="mt-8">
                <div className="text-xs uppercase tracking-widest text-white/35 mb-2">Electoral roll · Ward 04</div>
                <div className="flex flex-wrap gap-2">
                  {rollStatus.map((r, i) => (
                    <button key={r.name} onClick={() => goToCitizen(i)}
                      className={`px-3 py-2 rounded-xl border text-left text-xs transition-colors
                        ${i === citizenIdx
                          ? 'bg-amber-500 border-amber-400 text-black font-semibold'
                          : r.voted
                            ? 'bg-white/[0.03] border-white/10 text-white/40 hover:border-white/25'
                            : 'bg-white/5 border-white/15 text-white/80 hover:border-amber-400/50'}`}>
                      <div className="font-semibold">{r.name}</div>
                      <div className={i === citizenIdx ? 'text-black/60' : 'text-white/40'}>
                        {r.voted ? '✓ voted — cannot vote again' : 'not yet voted'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'identity' && (
            <div className="vc-pop">
              <h2 className="text-3xl font-bold mb-2">Step 1 · Identity, without exposure</h2>
              <p className="text-white/60 mb-6 max-w-xl">Biometric check confirms <b>{citizen.name}</b> is a registered voter. The identity is then converted into a one-way anonymous token — the chain never learns <i>who</i> the voter is.</p>
              <div className="flex gap-8 items-center">
                <div className="relative w-40 h-48 rounded-2xl border-2 border-cyan-400/40 bg-cyan-400/5 flex items-center justify-center overflow-hidden">
                  <CitizenPortrait paletteIndex={citizenIdx} className="h-full w-auto" />
                  <div className="absolute left-0 right-0 h-1 bg-cyan-300 shadow-[0_0_18px_4px_rgba(103,232,249,.8)]" style={{ animation: 'vc-scan 1.6s linear infinite' }} />
                </div>
                <div className="flex-1 max-w-sm">
                  <div className="flex justify-between text-xs text-white/50 mb-1"><span>Biometric match</span><span>{scanPct}%</span></div>
                  <div className="h-2 rounded bg-white/10 overflow-hidden mb-4">
                    <div className="h-full bg-cyan-400 transition-all" style={{ width: `${scanPct}%` }} />
                  </div>
                  {scanPct >= 100 ? (
                    <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-sm vc-pop">
                      <div className="text-emerald-300 font-semibold mb-1">✓ Eligible voter confirmed</div>
                      <div className="text-white/60 text-xs">Anonymous token issued:</div>
                      <div className="font-mono text-cyan-300 text-sm mt-1">{voterToken || '…'}</div>
                      <div className="text-white/40 text-[11px] mt-2">token = SHA-256(identity + national salt) — irreversible</div>
                    </div>
                  ) : (
                    <div className="text-white/40 text-sm" style={{ animation: 'vc-pulse 1.2s infinite' }}>Scanning…</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'ballot' && (
            <div className="vc-pop">
              <h2 className="text-3xl font-bold mb-2">Step 2 · The secret ballot</h2>
              <p className="text-white/60 mb-6 max-w-xl">Token <span className="font-mono text-cyan-300">{voterToken}</span> may now vote. The booth is offline-isolated; only the sealed vote will leave it.</p>
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                {CANDIDATES.map((c) => (
                  <button key={c.id} onClick={() => castVote(c)}
                    className="group p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/60 hover:bg-white/10 text-left transition-all">
                    <div className="text-4xl mb-2">{c.icon}</div>
                    <div className="font-semibold text-lg">{c.name}</div>
                    <div className="text-xs text-white/40 mt-1 group-hover:text-amber-300">Press to cast vote</div>
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-4">All parties are fictional, for this prototype.</p>
            </div>
          )}

          {step === 'seal' && choice && (
            <div className="vc-pop">
              <h2 className="text-3xl font-bold mb-2">Step 3 · Sealing the vote</h2>
              <p className="text-white/60 mb-6 max-w-xl">The vote is fed through SHA-256 — a one-way cryptographic function. Change even one letter and the fingerprint changes completely.</p>
              <div className="max-w-xl space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/40 mb-1">Plain vote</div>
                  <div className="font-mono">{voterToken} → <span style={{ color: choice.color }}>{choice.icon} {choice.name}</span></div>
                </div>
                <div className="text-center text-2xl text-white/30">↓ SHA-256 ↓</div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="text-xs text-white/40 mb-1">Cryptographic fingerprint</div>
                  <div className="font-mono text-emerald-300 break-all text-sm min-h-[40px]">{sealHash}<span style={{ animation: 'vc-pulse .8s infinite' }}>▌</span></div>
                </div>
              </div>
            </div>
          )}

          {step === 'mine' && choice && (
            <div className="vc-pop">
              <h2 className="text-3xl font-bold mb-2">Step 4 · Mining the block <span className="text-amber-400">⛏️</span></h2>
              <p className="text-white/60 mb-6 max-w-xl">
                The network races to find a <b>nonce</b> that makes the block&apos;s hash start with <span className="font-mono text-amber-300">{DIFFICULTY_PREFIX}</span>.
                This work is what makes rewriting history astronomically expensive. Watch it happen for real:
              </p>
              <div className="max-w-xl p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-sm">Nonce attempts</span>
                  <span className="font-mono text-2xl text-amber-300">{miningNonce.toLocaleString()}</span>
                </div>
                <div>
                  <div className="text-white/50 text-sm mb-1">Current hash</div>
                  <div className="font-mono text-xs break-all p-2 rounded bg-black/40">
                    <span className={miningHash.startsWith(DIFFICULTY_PREFIX) ? 'text-emerald-400 font-bold' : 'text-red-400'}>{miningHash.slice(0, 3)}</span>
                    <span className="text-white/60">{miningHash.slice(3)}</span>
                  </div>
                </div>
                {mined ? (
                  <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold vc-pop">
                    ✓ Block mined! Hash begins with {DIFFICULTY_PREFIX} — proof-of-work complete.
                  </div>
                ) : (
                  <div className="text-white/40 text-sm" style={{ animation: 'vc-pulse .6s infinite' }}>⚡ Searching for a valid nonce…</div>
                )}
              </div>
            </div>
          )}

          {(step === 'chain' || step === 'results') && (
            <div className="vc-pop">
              <h2 className="text-3xl font-bold mb-2">{step === 'chain' ? 'Step 5 · Welded into the chain' : 'Live results & public audit'}</h2>
              <p className="text-white/60 mb-4 max-w-2xl">
                Each block stores the previous block&apos;s hash — tamper with any vote and every later link shatters.
                <b className="text-amber-300"> Try it:</b> click a block below and change its vote.
              </p>

              {/* The chain */}
              <div ref={chainRef} className="flex items-stretch gap-0 overflow-x-auto pb-4">
                {chain.map((b, i) => {
                  const broken = chainCheck.brokenAt.includes(i);
                  const cand = CANDIDATES.find((c) => c.id === b.candidate);
                  return (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <div className={`self-center px-1 text-xl ${chainCheck.brokenAt.includes(i) ? 'text-red-500' : 'text-emerald-400'}`}>
                          {chainCheck.brokenAt.includes(i) ? '⛓️‍💥' : '🔗'}
                        </div>
                      )}
                      <button
                        onClick={() => i > 0 && setTamperTarget(tamperTarget === i ? null : i)}
                        className={`vc-pop flex-shrink-0 w-44 p-3 rounded-xl border text-left transition-all ${broken ? 'bg-red-500/10 border-red-500/60 shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/15 hover:border-amber-400/50'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-white/70">{i === 0 ? 'GENESIS' : `BLOCK #${b.index}`}</span>
                          {broken ? <span className="text-red-400 text-xs font-bold">INVALID</span> : <span className="text-emerald-400 text-xs">✓</span>}
                        </div>
                        {i === 0 ? (
                          <div className="text-[11px] text-white/40">Election opened<br />Ward 04 · 2047</div>
                        ) : (
                          <>
                            <div className="text-sm">{cand?.icon} {cand?.name ?? b.candidate}</div>
                            <div className="font-mono text-[9px] text-white/40 mt-1">by {b.voterToken}</div>
                          </>
                        )}
                        <div className="font-mono text-[9px] text-cyan-300/70 mt-2 truncate">hash {b.hash.slice(0, 16)}…</div>
                        <div className="font-mono text-[9px] text-white/30 truncate">prev {b.prevHash.slice(0, 16)}…</div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Tamper editor */}
              {tamperTarget !== null && (
                <div className="vc-pop mt-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 max-w-xl">
                  <div className="text-sm font-semibold text-red-300 mb-2">😈 Attack Block #{chain[tamperTarget].index}: rewrite the vote to…</div>
                  <div className="flex gap-2 flex-wrap">
                    {CANDIDATES.filter((c) => c.id !== chain[tamperTarget].candidate).map((c) => (
                      <button key={c.id} onClick={() => tamperBlock(tamperTarget, c.id)}
                        className="px-3 py-2 rounded-lg bg-white/10 hover:bg-red-500/30 text-sm">{c.icon} {c.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {!chainCheck.valid && (
                <div className="vc-pop mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/40 max-w-2xl">
                  <div className="font-semibold text-red-300 mb-1">🚨 Tampering detected — instantly.</div>
                  <p className="text-sm text-white/60">The edited block&apos;s hash no longer matches its contents, and every later block points to a hash that no longer exists. Every auditor in the country sees this copy is fake. On the real network, thousands of honest nodes simply ignore it.</p>
                  <button onClick={repairChain} className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold">Restore honest chain (re-verify & re-mine)</button>
                </div>
              )}

              {/* Tally + actions */}
              <div className="mt-6 grid md:grid-cols-2 gap-6 max-w-3xl">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-sm font-semibold mb-3 text-white/70">📊 Live public tally — {totalVotes} vote{totalVotes === 1 ? '' : 's'}</div>
                  {CANDIDATES.map((c) => {
                    const n = counts[c.id] || 0;
                    const pct = totalVotes ? Math.round((n / totalVotes) * 100) : 0;
                    return (
                      <div key={c.id} className="mb-2">
                        <div className="flex justify-between text-xs mb-0.5"><span>{c.icon} {c.name}</span><span className="text-white/50">{n} · {pct}%</span></div>
                        <div className="h-2 rounded bg-white/10 overflow-hidden"><div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: c.color }} /></div>
                      </div>
                    );
                  })}
                  <div className="text-[11px] text-white/30 mt-2">Anyone can recount — the ledger is public, the voters are anonymous.</div>
                </div>
                <div className="flex flex-col gap-3 justify-center">
                  <button onClick={nextVoter} className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold">🚶 Next citizen votes →</button>
                  <button onClick={() => setStep('results')} className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20">📊 View results & audit</button>
                  <button onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/15 text-white/60">← Back to town</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ------- Side rail: why it matters ------- */}
        <aside className="space-y-4">
          <IntentCard onOpen={onShowIntent} />

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">Why blockchain voting?</div>
            <ul className="text-sm text-white/60 space-y-2">
              <li>🔒 <b className="text-white/80">Tamper-evident</b> — one changed vote breaks every later block, publicly.</li>
              <li>🕵️ <b className="text-white/80">Anonymous</b> — the chain stores one-way tokens, never identities.</li>
              <li>🚫 <b className="text-white/80">No double voting</b> — a token that has voted is rejected forever.</li>
              <li>🧾 <b className="text-white/80">Anyone can audit</b> — the count is recomputable by every citizen.</li>
              <li>⚡ <b className="text-white/80">Instant results</b> — tallying is reading the public ledger.</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="font-semibold mb-2">What&apos;s real in this demo?</div>
            <p className="text-sm text-white/60">Every hash is genuine SHA-256 computed by your browser. Mining really searches for a nonce with a {DIFFICULTY_PREFIX}-prefixed hash. The tamper demo really re-verifies the chain block by block.</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="font-semibold mb-1 text-amber-300">Honest caveat</div>
            <p className="text-xs text-white/50">Real national elections also need coercion-resistance, verified voter rolls, and offline fallbacks — this prototype shows the integrity layer, the part blockchain does best.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
