/**
 * A real, in-browser blockchain for the Bharat 2047 voting demo.
 * SHA-256 via Web Crypto. Proof-of-work mining with a visible nonce.
 */

export interface VoteBlock {
  index: number;
  timestamp: number;
  voterToken: string;   // anonymous voter token (never the identity)
  candidate: string;
  prevHash: string;
  nonce: number;
  hash: string;
}

export const DIFFICULTY_PREFIX = '000';

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function blockPayload(b: Omit<VoteBlock, 'hash'>): string {
  return `${b.index}|${b.timestamp}|${b.voterToken}|${b.candidate}|${b.prevHash}|${b.nonce}`;
}

export async function hashBlock(b: Omit<VoteBlock, 'hash'>): Promise<string> {
  return sha256(blockPayload(b));
}

/** Generate an anonymous voter token from an ID + salt (one-way). */
export async function makeVoterToken(voterId: string): Promise<string> {
  const h = await sha256(`BHARAT-EPIC-SALT-2047::${voterId}`);
  return `VTR-${h.slice(0, 12).toUpperCase()}`;
}

export async function createGenesisBlock(): Promise<VoteBlock> {
  const base: Omit<VoteBlock, 'hash'> = {
    index: 0,
    timestamp: 1735689600000,
    voterToken: 'GENESIS',
    candidate: 'ELECTION-2047-WARD-04',
    prevHash: '0'.repeat(64),
    nonce: 0,
  };
  const hash = await hashBlock(base);
  return { ...base, hash };
}

/**
 * Mine a block: find a nonce so the hash starts with DIFFICULTY_PREFIX.
 * onProgress fires every `reportEvery` attempts so the UI can animate.
 */
export async function mineBlock(
  partial: Omit<VoteBlock, 'hash' | 'nonce'>,
  onProgress?: (nonce: number, hash: string) => void,
  // Each report is also a yield back to the browser, and a yield costs far more than the
  // hashes between them — a hidden tab clamps timers to hundreds of milliseconds, which
  // turned a block into minutes. At this cadence the nonce counter still updates roughly
  // twenty times per block, so the race is still visible.
  reportEvery = 200
): Promise<VoteBlock> {
  let nonce = 0;
  while (true) {
    const candidateBlock = { ...partial, nonce };
    const hash = await hashBlock(candidateBlock);
    if (hash.startsWith(DIFFICULTY_PREFIX)) {
      onProgress?.(nonce, hash);
      return { ...candidateBlock, hash };
    }
    if (nonce % reportEvery === 0) {
      onProgress?.(nonce, hash);
      // Yield to the browser so the animation stays smooth
      await new Promise((r) => setTimeout(r, 0));
    }
    nonce++;
  }
}

export interface ChainCheck {
  valid: boolean;
  brokenAt: number[]; // indexes of invalid blocks
}

/**
 * Re-verify the whole chain: recompute hashes + check links + difficulty.
 *
 * Two details matter for this to mean what the screen says it means. Each link is checked
 * against what the previous block *actually hashes to*, not against the hash it claims to
 * have — otherwise editing a vote would only ever flag the block you edited, because its
 * stale hash field still satisfies its successor. And once a block is invalid, every block
 * built on top of it is invalid too: they descend from something no honest node would
 * accept. That is why one changed vote shatters the rest of the chain.
 */
export async function verifyChain(chain: VoteBlock[]): Promise<ChainCheck> {
  const brokenAt: number[] = [];
  let prevRecomputed: string | null = null;
  let broken = false;

  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    const recomputed = await hashBlock({
      index: b.index, timestamp: b.timestamp, voterToken: b.voterToken,
      candidate: b.candidate, prevHash: b.prevHash, nonce: b.nonce,
    });
    const hashOk = recomputed === b.hash;
    const powOk = i === 0 || b.hash.startsWith(DIFFICULTY_PREFIX);
    const linkOk = i === 0 || b.prevHash === prevRecomputed;

    if (!(hashOk && powOk && linkOk)) broken = true;
    if (broken) brokenAt.push(i);

    prevRecomputed = recomputed;
  }

  return { valid: brokenAt.length === 0, brokenAt };
}

export function tally(chain: VoteBlock[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of chain) {
    if (b.index === 0) continue;
    counts[b.candidate] = (counts[b.candidate] || 0) + 1;
  }
  return counts;
}
