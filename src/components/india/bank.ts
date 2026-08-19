/**
 * Bank of Bharat — the confidential-ledger engine.
 *
 * The argument this system makes is deliberately *not* "put banking on a chain".
 * The voting centre and the panchayat already carry a hash chain; a third system
 * whose whole story is a chain would be the same trick a third time.
 *
 * The interesting question in banking is narrower and harder:
 *
 *     What can a regulator compute over a bank's books
 *     without being shown anybody's account?
 *
 * Quite a lot, it turns out, and all of it runs here with no server:
 *
 *  1. PEDERSEN COMMITMENTS over RFC 3526 MODP Group 14. Every balance and every
 *     transfer amount is sealed as C = g^v · h^r mod p. The commitment reveals
 *     nothing about v, but it is binding: the bank cannot change v afterwards.
 *
 *  2. HOMOMORPHIC ADDITION. C(a) · C(b) = C(a+b). This is the whole trick. An
 *     auditor multiplies every account commitment together and checks the product
 *     against the bank's declared total. If the books balance, it matches. If the
 *     bank has a hole, it cannot match — and the auditor never saw one balance.
 *
 *  3. SCHNORR PROOFS OF KNOWLEDGE (Fiat–Shamir, SHA-256). The bank proves it can
 *     actually open a commitment without opening it.
 *
 *  4. A MERKLE TREE over the account commitments, so any depositor can verify
 *     their own account was included in the audited total, without learning any
 *     other depositor's balance.
 *
 *  5. STRUCTURAL FRAUD ANALYTICS. Circular flows, pass-through mules and
 *     structuring are found from the *shape* of the transaction graph and its
 *     timing — with every amount still sealed. Benford's law runs on the figures
 *     the bank publishes itself.
 *
 *  6. SELECTIVE DISCLOSURE. Only once a pattern is found does the regulator
 *     compel an opening, and only for the flagged transfers. The opening is
 *     verified against the original commitment, so the bank cannot substitute
 *     convenient numbers after the fact. Targeted transparency instead of blanket
 *     surveillance — which is the actual product argument.
 *
 * The privacy/detectability tradeoff this design picks is stated honestly in the
 * UI: amounts are hidden, the transaction graph is not. Hiding the graph too would
 * defeat every detector in section 5. That tension is real and unsolved, and
 * pretending otherwise would be the dishonest version of this demo.
 */

import { sha256 } from './blockchain';

/* ------------------------------------------------------- group parameters */

/**
 * RFC 3526 MODP Group 14 — a published 2048-bit safe prime. Nothing up anyone's
 * sleeve: you can look it up. p = 2q + 1, so squaring any element lands it in the
 * prime-order-q subgroup, where the discrete log problem is the one we rely on.
 */
export const P = BigInt(
  '0x' +
    ('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
      '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
      '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
      'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
      '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
      '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
      'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718' +
      '3995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF'),
);

/** Order of the subgroup we work in. */
export const Q = (P - 1n) / 2n;

export function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/** Extended Euclid, for dividing commitments (i.e. subtracting committed values). */
export function modInverse(a: bigint, mod: bigint): bigint {
  let [oldR, r] = [((a % mod) + mod) % mod, mod];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  return ((oldS % mod) + mod) % mod;
}

/**
 * The two generators. Both are squares, so both live in the order-q subgroup.
 * h is chosen so that nobody — including whoever wrote this file — knows log_g(h);
 * if anyone did, they could open a commitment to any value they liked.
 */
export const G = modpow(2n, 2n, P);
export const H = modpow(
  BigInt('0x' + 'BHARAT2047'.split('').map((c) => c.charCodeAt(0).toString(16)).join('')) % P,
  2n,
  P,
);

/* ------------------------------------------------------------- randomness */

/** Seeded PRNG, so the demo town shows the same books to every visitor. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomScalar(rng: () => number): bigint {
  // 256 bits of blinding, assembled from the seeded stream.
  let x = 0n;
  for (let i = 0; i < 8; i++) x = (x << 32n) | BigInt(Math.floor(rng() * 4294967296));
  return x % Q;
}

/* --------------------------------------------------- Pedersen commitments */

export interface Commitment {
  /** g^v · h^r mod p */
  c: bigint;
}

export interface Opening {
  value: bigint;
  blinding: bigint;
}

export function commit(value: bigint, blinding: bigint): Commitment {
  return { c: (modpow(G, value, P) * modpow(H, blinding, P)) % P };
}

/** C(a) · C(b) = C(a + b). The property the whole audit rests on. */
export function addCommitments(a: Commitment, b: Commitment): Commitment {
  return { c: (a.c * b.c) % P };
}

export function sumCommitments(cs: Commitment[]): Commitment {
  return cs.reduce((acc, x) => addCommitments(acc, x), { c: 1n });
}

/** C(a) / C(b) = C(a − b). Used to check a declared total against the real one. */
export function subCommitments(a: Commitment, b: Commitment): Commitment {
  return { c: (a.c * modInverse(b.c, P)) % P };
}

export function verifyOpening(c: Commitment, opening: Opening): boolean {
  return commit(opening.value, opening.blinding).c === c.c;
}

export function shortHex(x: bigint, chars = 16): string {
  const hex = x.toString(16);
  return hex.length <= chars ? hex : `${hex.slice(0, chars)}…`;
}

/* -------------------------------------------- Schnorr proof of knowledge */

/**
 * Proves "I know (v, r) such that C = g^v h^r" without revealing either.
 * Standard sigma protocol made non-interactive with Fiat–Shamir over SHA-256.
 */
export interface SchnorrProof {
  commitmentT: bigint;
  challenge: bigint;
  responseV: bigint;
  responseR: bigint;
}

export async function proveKnowledge(
  c: Commitment,
  opening: Opening,
  rng: () => number,
): Promise<SchnorrProof> {
  const kv = randomScalar(rng);
  const kr = randomScalar(rng);
  const t = (modpow(G, kv, P) * modpow(H, kr, P)) % P;
  const challenge = await hashToScalar(`${c.c}|${t}`);
  return {
    commitmentT: t,
    challenge,
    responseV: (kv + challenge * opening.value) % Q,
    responseR: (kr + challenge * opening.blinding) % Q,
  };
}

export async function verifyKnowledge(c: Commitment, proof: SchnorrProof): Promise<boolean> {
  const expected = await hashToScalar(`${c.c}|${proof.commitmentT}`);
  if (expected !== proof.challenge) return false;
  const lhs = (modpow(G, proof.responseV, P) * modpow(H, proof.responseR, P)) % P;
  const rhs = (proof.commitmentT * modpow(c.c, proof.challenge, P)) % P;
  return lhs === rhs;
}

async function hashToScalar(text: string): Promise<bigint> {
  return BigInt('0x' + (await sha256(text))) % Q;
}

/* ------------------------------------------------------------ Merkle tree */

export interface MerkleProof {
  leafIndex: number;
  leaf: string;
  /** sibling hash and which side it sits on, bottom-up */
  path: { hash: string; right: boolean }[];
  root: string;
}

export async function merkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return '0'.repeat(64);
  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(await sha256(left + right));
    }
    level = next;
  }
  return level[0];
}

export async function merkleProof(leaves: string[], index: number): Promise<MerkleProof> {
  const path: { hash: string; right: boolean }[] = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      if (i === idx || i + 1 === idx) {
        const isLeftNode = idx === i;
        path.push({ hash: isLeftNode ? right : left, right: isLeftNode });
      }
      next.push(await sha256(left + right));
    }
    idx = Math.floor(idx / 2);
    level = next;
  }
  return { leafIndex: index, leaf: leaves[index], path, root: level[0] };
}

export async function verifyMerkleProof(proof: MerkleProof): Promise<boolean> {
  let hash = proof.leaf;
  for (const step of proof.path) {
    hash = step.right ? await sha256(hash + step.hash) : await sha256(step.hash + hash);
  }
  return hash === proof.root;
}

/* ------------------------------------------------------------- the ledger */

export type Sector = 'agriculture' | 'msme' | 'housing' | 'infrastructure' | 'retail';
export type AccountKind = 'household' | 'msme' | 'corporate' | 'shell';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  sector: Sector;
  branch: string;
  /** ground truth, in rupees — sealed in the published ledger, never displayed unopened */
  balance: bigint;
  blinding: bigint;
  commitment: Commitment;
  /** SHA-256 leaf published in the Merkle tree */
  leaf: string;
}

export interface Transfer {
  id: string;
  from: string;
  to: string;
  /** ground truth — sealed; the regulator only sees `commitment` until it compels an opening */
  amount: bigint;
  blinding: bigint;
  commitment: Commitment;
  day: number;
  /**
   * The bank attaches this when it declines to file a large-transaction report,
   * i.e. it asserts the amount is under the reporting threshold. The assertion is
   * metadata, not proof — which is exactly what makes it a detectable signal.
   */
  claimsUnderThreshold: boolean;
}

export const REPORTING_THRESHOLD = 1_000_000n; // ₹10 lakh

export interface Ledger {
  accounts: Account[];
  transfers: Transfer[];
  merkleRootHash: string;
  leaves: string[];
  /** what the bank tells the world its deposits add up to */
  declaredTotal: bigint;
  /** built in ms, measured — the demo shows the real cost of real crypto */
  buildMs: number;
}

const FIRST_NAMES = ['Asha', 'Ravi', 'Meena', 'Arjun', 'Lakshmi', 'Kiran', 'Sunita', 'Abdul',
  'Phoolwati', 'Jitender', 'Nasreen', 'Gopal', 'Rekha', 'Imran', 'Padma', 'Vikram'];
const SURNAMES = ['Devi', 'Kumar', 'Yadav', 'Singh', 'Bai', 'Patel', 'Rahman', 'Sharma'];
const BRANCHES = ['Rampur', 'Basantpur', 'Ward 04', 'Kishanganj'];
const SECTORS: Sector[] = ['agriculture', 'msme', 'housing', 'infrastructure', 'retail'];

/**
 * A synthetic but structurally honest set of books: mostly ordinary customers doing
 * ordinary things, plus three planted patterns a real AML desk looks for. The
 * detectors below have to find those three without drowning the ordinary accounts,
 * which is the only test that means anything.
 */
export async function buildLedger(seed = 20470815): Promise<Ledger> {
  const t0 = performance.now();
  const rng = makeRng(seed);
  const accounts: Account[] = [];

  const push = (id: string, name: string, kind: AccountKind, sector: Sector, branch: string, balance: bigint) => {
    const blinding = randomScalar(rng);
    accounts.push({ id, name, kind, sector, branch, balance, blinding, commitment: commit(balance, blinding), leaf: '' });
  };

  // Ordinary customers.
  for (let i = 0; i < 22; i++) {
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${SURNAMES[i % SURNAMES.length]}`;
    const kind: AccountKind = i % 7 === 0 ? 'msme' : i % 11 === 0 ? 'corporate' : 'household';
    const balance = BigInt(Math.floor(20_000 + rng() * (kind === 'household' ? 180_000 : 4_000_000)));
    push(`AC${String(i + 1).padStart(3, '0')}`, name, kind, SECTORS[i % SECTORS.length], BRANCHES[i % BRANCHES.length], balance);
  }

  // The planted set: three shells used by the structuring ring and the layering cycle.
  push('AC101', 'Sunrise Traders', 'shell', 'msme', 'Ward 04', 340_000n);
  push('AC102', 'Perfect Agro Exports', 'shell', 'agriculture', 'Ward 04', 512_000n);
  push('AC103', 'Meridian Holdings', 'shell', 'infrastructure', 'Kishanganj', 288_000n);
  // The mule: money lands and leaves the same day.
  push('AC104', 'R. Prasad', 'household', 'retail', 'Basantpur', 41_000n);

  const transfers: Transfer[] = [];
  let tn = 0;
  const addTransfer = (from: string, to: string, amount: bigint, day: number) => {
    const blinding = randomScalar(rng);
    transfers.push({
      id: `TX${String(++tn).padStart(4, '0')}`,
      from, to, amount, blinding,
      commitment: commit(amount, blinding),
      day,
      claimsUnderThreshold: amount < REPORTING_THRESHOLD,
    });
  };

  const ordinary = accounts.filter((a) => a.kind !== 'shell' && a.id !== 'AC104');

  // Background traffic: ordinary people paying ordinary people.
  for (let d = 1; d <= 30; d++) {
    const n = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const from = ordinary[Math.floor(rng() * ordinary.length)];
      let to = ordinary[Math.floor(rng() * ordinary.length)];
      if (to.id === from.id) to = ordinary[(ordinary.indexOf(from) + 3) % ordinary.length];
      // Naturally Benford-ish: log-uniform magnitudes, as real payment data is.
      const amount = BigInt(Math.floor(Math.pow(10, 3 + rng() * 3.2)));
      addTransfer(from.id, to.id, amount, d);
    }
  }

  // PLANT 1 — structuring. Eleven transfers deliberately parked just under the
  // ₹10 lakh reporting threshold, spread over four days and three counterparties.
  const structuringDays = [7, 8, 9, 10];
  for (let i = 0; i < 11; i++) {
    const to = ['AC101', 'AC102', 'AC103'][i % 3];
    const amount = REPORTING_THRESHOLD - BigInt(1000 + Math.floor(rng() * 40_000));
    addTransfer('AC004', to, amount, structuringDays[i % structuringDays.length]);
  }

  // PLANT 2 — layering. A closed loop that returns the money to where it started.
  addTransfer('AC101', 'AC102', 2_400_000n, 12);
  addTransfer('AC102', 'AC103', 2_380_000n, 13);
  addTransfer('AC103', 'AC101', 2_355_000n, 14);

  // PLANT 3 — a pass-through mule: many in, everything straight back out, same day.
  for (let i = 0; i < 6; i++) addTransfer(ordinary[i].id, 'AC104', BigInt(180_000 + i * 9_000), 21);
  addTransfer('AC104', 'AC103', 1_180_000n, 21);

  // Publish the account leaves and the Merkle root.
  for (const a of accounts) a.leaf = await sha256(`${a.id}|${a.commitment.c.toString(16)}`);
  const leaves = accounts.map((a) => a.leaf);
  const merkleRootHash = await merkleRoot(leaves);
  const declaredTotal = accounts.reduce((s, a) => s + a.balance, 0n);

  return { accounts, transfers, merkleRootHash, leaves, declaredTotal, buildMs: performance.now() - t0 };
}

/* -------------------------------------------------------- proof of solvency */

export interface SolvencyResult {
  /** the homomorphic product of every published account commitment */
  aggregate: Commitment;
  /** what a commitment to the bank's declared total, with the same blinding, must look like */
  expected: Commitment;
  balances: boolean;
  declaredTotal: bigint;
  /** non-zero only when the bank is lying; this is the size of the hole */
  discrepancy: bigint;
  ms: number;
}

/**
 * The audit. Multiply every account commitment together, then check the product
 * against a commitment to the declared total using the summed blinding factors.
 * Matching proves the declared total really is the sum of the individual balances —
 * and the auditor has not seen a single balance.
 */
export function proveSolvency(ledger: Ledger, declaredOverride?: bigint): SolvencyResult {
  const t0 = performance.now();
  const aggregate = sumCommitments(ledger.accounts.map((a) => a.commitment));
  const blindingSum = ledger.accounts.reduce((s, a) => (s + a.blinding) % Q, 0n);
  const declaredTotal = declaredOverride ?? ledger.declaredTotal;
  const expected = commit(declaredTotal, blindingSum);
  const trueTotal = ledger.accounts.reduce((s, a) => s + a.balance, 0n);
  return {
    aggregate,
    expected,
    balances: aggregate.c === expected.c,
    declaredTotal,
    discrepancy: declaredTotal - trueTotal,
    ms: performance.now() - t0,
  };
}

/* -------------------------------------------- exposure, without the accounts */

export interface SectorExposure {
  sector: Sector;
  accounts: number;
  /** homomorphic sum over the sector — the regulator opens only this, never a member */
  commitment: Commitment;
  total: bigint;
  share: number;
  /** concentration limit: no single sector above this share of the book */
  breach: boolean;
}

export const CONCENTRATION_LIMIT = 0.35;

/**
 * The regulator's real question is not "what does Kamla have" but "is this bank
 * over-exposed to one sector". That is an aggregate, so it can be answered by
 * opening an aggregate — every individual account stays sealed.
 */
export function sectorExposure(ledger: Ledger): SectorExposure[] {
  const total = ledger.accounts.reduce((s, a) => s + a.balance, 0n);
  return SECTORS.map((sector) => {
    const members = ledger.accounts.filter((a) => a.sector === sector);
    const sum = members.reduce((s, a) => s + a.balance, 0n);
    const share = total === 0n ? 0 : Number((sum * 10000n) / total) / 10000;
    return {
      sector,
      accounts: members.length,
      commitment: sumCommitments(members.map((m) => m.commitment)),
      total: sum,
      share,
      breach: share > CONCENTRATION_LIMIT,
    };
  }).sort((a, b) => b.share - a.share);
}

/* ------------------------------------------------ structural fraud analytics */

export type FlagKind = 'structuring' | 'layering-cycle' | 'pass-through' | 'benford';

export interface Flag {
  kind: FlagKind;
  severity: 'high' | 'medium';
  title: string;
  detail: string;
  /** accounts implicated */
  accounts: string[];
  /** transfers the regulator would compel openings for */
  transfers: string[];
  /** the number the detector actually computed */
  statistic: string;
}

/**
 * Structuring. Every transfer where the bank declined to file a report carries a
 * "under the threshold" assertion. That assertion is metadata — visible without
 * opening anything — so a cluster of them from one payer in a short window is
 * visible from the outside. The amounts stay sealed throughout.
 */
export function detectStructuring(ledger: Ledger, windowDays = 7, minCount = 6): Flag[] {
  const byPayer = new Map<string, Transfer[]>();
  for (const t of ledger.transfers) {
    if (!t.claimsUnderThreshold) continue;
    if (!byPayer.has(t.from)) byPayer.set(t.from, []);
    byPayer.get(t.from)!.push(t);
  }

  const flags: Flag[] = [];
  for (const [payer, list] of byPayer) {
    const sorted = [...list].sort((a, b) => a.day - b.day);
    let best: { transfers: Transfer[]; recipients: string[]; startDay: number } | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const window = sorted.filter((t) => t.day >= sorted[i].day && t.day < sorted[i].day + windowDays);
      if (window.length < minCount) continue;

      // The signal is *concentration*, not exclusivity. An ordinary payer also makes
      // ordinary under-threshold payments in the same week, so requiring every payment
      // in the window to go to the same few people finds nothing. What matters is
      // whether a small set of recipients is being paid repeatedly.
      const perRecipient = new Map<string, Transfer[]>();
      for (const t of window) {
        if (!perRecipient.has(t.to)) perRecipient.set(t.to, []);
        perRecipient.get(t.to)!.push(t);
      }
      const repeated = [...perRecipient.entries()]
        .filter(([, ts]) => ts.length >= 2)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 4);
      const concentrated = repeated.flatMap(([, ts]) => ts);
      if (concentrated.length < minCount) continue;

      if (!best || concentrated.length > best.transfers.length) {
        best = { transfers: concentrated, recipients: repeated.map(([r]) => r), startDay: sorted[i].day };
      }
    }

    if (best) {
      flags.push({
        kind: 'structuring',
        severity: 'high',
        title: `Structuring pattern from ${payer}`,
        detail: `${best.transfers.length} transfers from day ${best.startDay} over ${windowDays} days, every one asserted to be under the ₹${(Number(REPORTING_THRESHOLD) / 100000).toFixed(0)} lakh reporting threshold, concentrated into ${best.recipients.length} repeat counterparties. The amounts are still sealed — the pattern is visible from the assertions and the timing alone.`,
        accounts: [payer, ...best.recipients],
        transfers: best.transfers.map((t) => t.id),
        statistic: `${best.transfers.length} under-threshold assertions → ${best.recipients.length} repeat counterparties in ${windowDays}d`,
      });
    }
  }
  return flags;
}

/**
 * Layering. A closed loop in the transfer graph returns value to its origin.
 *
 * The naive version of this detector is worthless, and it is worth saying why: in any
 * reasonably dense payment graph, short cycles are everywhere. A first cut of this
 * function raised 121 flags across 26 accounts — a detector that flags the whole bank
 * has told you nothing, and in a real institution it would be switched off within a week.
 *
 * What separates layering from ordinary commerce is not the loop, it is the *clock*.
 * Ordinary trade also forms cycles — a farmer pays a supplier who pays a distributor who
 * eventually buys from the farmer — but over months, and incidentally. Layering completes
 * deliberately, in days, because the point is to break the audit trail quickly. So the
 * detector requires the whole loop to close inside `maxSpanDays`, with each hop moving
 * forward in time. That single constraint is what makes the output readable.
 */
export function detectCycles(ledger: Ledger, maxLen = 5, maxSpanDays = 5): Flag[] {
  const adj = new Map<string, { to: string; id: string; day: number }[]>();
  for (const t of ledger.transfers) {
    if (!adj.has(t.from)) adj.set(t.from, []);
    adj.get(t.from)!.push({ to: t.to, id: t.id, day: t.day });
  }

  const found: Flag[] = [];
  const seenCycles = new Set<string>();

  const walk = (start: string, node: string, path: string[], edges: { id: string; day: number }[]) => {
    if (path.length > maxLen) return;
    for (const edge of adj.get(node) ?? []) {
      // A layering loop moves forward in time; an ordinary back-and-forth does not.
      const lastDay = edges.length ? edges[edges.length - 1].day : -Infinity;
      if (edge.day < lastDay) continue;
      // ...and it closes fast. This is the constraint that makes the detector useful.
      const spanStart = edges.length ? edges[0].day : edge.day;
      if (edge.day - spanStart > maxSpanDays) continue;

      if (edge.to === start && path.length >= 3) {
        const key = [...path].sort().join('>');
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          found.push({
            kind: 'layering-cycle',
            severity: 'high',
            title: `Circular flow across ${path.length} accounts`,
            detail: `Value leaves ${start}, passes through ${path.slice(1).join(' → ')} and returns to ${start} in ${edge.day - edges[0].day} days. Trade forms loops too, but over months and by accident; a loop that closes this fast is deliberate. Found from the graph and the clock alone — nothing was decrypted.`,
            accounts: [...path],
            transfers: [...edges.map((e) => e.id), edge.id],
            statistic: `${path.length}-account loop closing in ${edge.day - edges[0].day}d (limit ${maxSpanDays}d)`,
          });
        }
        continue;
      }
      if (path.includes(edge.to)) continue;
      walk(start, edge.to, [...path, edge.to], [...edges, { id: edge.id, day: edge.day }]);
    }
  };

  for (const account of adj.keys()) walk(account, account, [account], []);
  return found;
}

/** Pass-through mule: money arrives from many sources and leaves almost at once. */
export function detectPassThrough(ledger: Ledger, minSources = 4): Flag[] {
  const inbound = new Map<string, Transfer[]>();
  const outbound = new Map<string, Transfer[]>();
  for (const t of ledger.transfers) {
    if (!inbound.has(t.to)) inbound.set(t.to, []);
    inbound.get(t.to)!.push(t);
    if (!outbound.has(t.from)) outbound.set(t.from, []);
    outbound.get(t.from)!.push(t);
  }

  const flags: Flag[] = [];
  for (const [account, ins] of inbound) {
    const outs = outbound.get(account) ?? [];
    if (outs.length === 0) continue;
    for (const out of outs) {
      const sameWindow = ins.filter((i) => i.day <= out.day && out.day - i.day <= 1);
      const sources = new Set(sameWindow.map((i) => i.from));
      if (sources.size < minSources) continue;
      flags.push({
        kind: 'pass-through',
        severity: 'medium',
        title: `Pass-through account ${account}`,
        detail: `${sources.size} separate sources paid into ${account} on day ${out.day}, and the account emptied to a single destination within a day. A genuine account accumulates; a mule forwards. Detected from in-degree, out-degree and timing — amounts sealed.`,
        accounts: [account, ...sources, out.to],
        transfers: [...sameWindow.map((i) => i.id), out.id],
        statistic: `fan-in ${sources.size} → fan-out 1, same-day`,
      });
      break;
    }
  }
  return flags;
}

/* -------------------------------------------------------------- Benford's law */

export interface BenfordResult {
  observed: number[];
  expected: number[];
  counts: number[];
  n: number;
  chiSquare: number;
  /** 8 degrees of freedom */
  criticalValue05: number;
  criticalValue01: number;
  suspicious: boolean;
}

export const BENFORD_EXPECTED = Array.from({ length: 9 }, (_, i) => Math.log10(1 + 1 / (i + 1)));

/**
 * Benford's law, the oldest trick in forensic accounting. Genuine transaction
 * magnitudes span orders of magnitude, so their leading digits follow log10(1+1/d) —
 * a 1 about 30% of the time, a 9 under 5%. Fabricated or manipulated figures rarely do.
 *
 * Note this runs on figures the bank *publishes itself*, not on the sealed amounts.
 * That is the honest version: Benford needs magnitudes, so it cannot be run over
 * commitments, and pretending otherwise would be the fake version of this demo.
 */
export function benford(values: bigint[]): BenfordResult {
  const counts = new Array(9).fill(0);
  let n = 0;
  for (const v of values) {
    const s = v.toString().replace(/^0+/, '');
    if (!s.length) continue;
    const d = Number(s[0]);
    if (d < 1 || d > 9) continue;
    counts[d - 1] += 1;
    n += 1;
  }
  const observed = counts.map((c) => (n ? c / n : 0));
  let chiSquare = 0;
  for (let i = 0; i < 9; i++) {
    const e = BENFORD_EXPECTED[i] * n;
    if (e > 0) chiSquare += Math.pow(counts[i] - e, 2) / e;
  }
  return {
    observed,
    expected: BENFORD_EXPECTED,
    counts,
    n,
    chiSquare,
    criticalValue05: 15.507,
    criticalValue01: 20.09,
    suspicious: chiSquare > 15.507,
  };
}

/* ------------------------------------------------------- selective disclosure */

export interface Disclosure {
  transferId: string;
  from: string;
  to: string;
  day: number;
  amount: bigint;
  /** proves the opened value really is what the sealed commitment always said */
  verified: boolean;
}

/**
 * The point of the whole design. The regulator does not get the book; it gets the
 * patterns. Once a pattern is found, it compels openings for exactly the flagged
 * transfers, and each opening is checked against the commitment published before
 * anyone was looking — so the bank cannot invent a convenient number now.
 */
export function discloseTransfers(ledger: Ledger, transferIds: string[]): Disclosure[] {
  const byId = new Map(ledger.transfers.map((t) => [t.id, t]));
  return transferIds
    .map((id) => byId.get(id))
    .filter((t): t is Transfer => Boolean(t))
    .map((t) => ({
      transferId: t.id,
      from: t.from,
      to: t.to,
      day: t.day,
      amount: t.amount,
      verified: verifyOpening(t.commitment, { value: t.amount, blinding: t.blinding }),
    }));
}

export function runAllDetectors(ledger: Ledger): Flag[] {
  return [
    ...detectStructuring(ledger),
    ...detectCycles(ledger),
    ...detectPassThrough(ledger),
  ];
}

export function formatRupees(v: bigint): string {
  const n = Number(v);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
