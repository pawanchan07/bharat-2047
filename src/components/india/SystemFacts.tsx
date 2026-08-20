'use client';

/**
 * The two cards every system in this town has to be able to fill in.
 *
 * The town reads as "the blockchain project", and a visitor could reasonably walk out of it
 * believing the argument is that a chain fixes civic systems. It is not. Three of the four
 * built systems here do not use a blockchain at all; they use tamper-evidence, which costs a
 * hash function instead of a network.
 *
 * So each system now says two things it never said before, in the same shape so they can be
 * compared: what it *actually* runs on and whether that needed a chain, and what choosing it
 * costs the citizen. The capability was always on screen. The price was not.
 *
 * The doctrine these implement is in VISION.md, "The blockchain doctrine".
 */

import React from 'react';

export interface SystemFactsProps {
  /** The primitives, named honestly — "Merkle tree · ECDSA P-256", not "blockchain". */
  uses: string;
  /** True only when the system genuinely passes the seven-question test in VISION.md. */
  needsChain: boolean;
  /** Why it does or does not, in one or two sentences. */
  why: string;
}

/** What this system actually runs on — and whether it needed a chain to do it. */
export function WhatItUses({ uses, needsChain, why }: SystemFactsProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="font-semibold">What this actually uses</div>
        <span
          className={`h-fit shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold ${
            needsChain ? 'bg-amber-500 text-black' : 'border border-white/20 text-white/45'
          }`}
        >
          {needsChain ? 'NEEDS A CHAIN' : 'NO BLOCKCHAIN'}
        </span>
      </div>
      <div className="font-mono text-[11px] leading-relaxed text-cyan-300/70">{uses}</div>
      <p className="mt-2 text-xs leading-relaxed text-white/50">{why}</p>
    </div>
  );
}

/**
 * What the design costs, stated as plainly as what it buys. Every civic system trades
 * something away; a screen that only lists capabilities is selling rather than arguing.
 */
export function WhatItCosts({ points }: { points: string[] }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.03] p-4">
      <div className="mb-2 font-semibold text-white/80">What this costs you</div>
      <ul className="space-y-1.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-xs leading-relaxed text-white/50">
            <span className="shrink-0 text-white/25" aria-hidden>
              —
            </span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
