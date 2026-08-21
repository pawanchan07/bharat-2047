/**
 * AI Safety Command: the engine behind a camera network that cannot recognise a face.
 *
 * Every other AI-CCTV demonstration shows a video feed with a box drawn round a person, and
 * argues "the system sees well". In policing that is both the wrong argument and the
 * dangerous one. This engine argues the opposite thing: in a town where cameras are going to
 * exist anyway, what makes them survivable is that abusing them is expensive in mathematics
 * rather than merely forbidden in policy. Policy changes with governments. A key threshold
 * does not.
 *
 * Four mechanisms, all of them real and all of them running in the visitor's own browser:
 *
 * - **The pole emits numbers, never frames.** `extractFeatures` runs frame differencing over
 *   two real images and returns motion energy, an occupancy estimate and the shape of what
 *   moved. That is the entire payload a camera in this town transmits. The consequence is
 *   architectural rather than promised: this network is incapable of face recognition even
 *   if a future government orders it, because the faces never leave the pole.
 * - **Severity is decided by rules, not by a model.** `assess` fires named, readable rules
 *   over a window of features. It is the same position the panchayat takes: the part that
 *   decides what happens to a person is deterministic and auditable, and it shows its
 *   working.
 * - **Footage opens only when two of three parties agree.** `splitSecret` and
 *   `combineShares` are real Shamir secret sharing over GF(256), splitting a real AES-GCM
 *   key between the station officer, a magistrate and a citizen ombudsman. One share decrypts
 *   nothing. A warrant stops being paperwork and becomes a precondition of the arithmetic.
 * - **Every look is recorded, including the refused ones.** `appendAccess` chains access
 *   events with SHA-256. A refusal that leaves no trace is one nobody can later prove
 *   happened, which is the school's contest logic pointed at policing.
 *
 * The log stores commitments rather than names. "Officer 47 viewed Kamla Devi" would make
 * the audit trail itself a public register of who is under surveillance, which is the
 * failure mode it exists to prevent. Each party appears as a salted hash, and only somebody
 * holding the salt can demonstrate that a given entry is about them.
 */

/* ------------------------------------------------------------------ primitives */

const enc = new TextEncoder();

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text) as BufferSource);
  return toHex(new Uint8Array(digest));
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/* ------------------------------------------------- part 1: the pole, features only */

/**
 * What one camera transmits. Eight numbers and a timestamp.
 *
 * There is deliberately no field here that could carry an image, a crop, a descriptor or an
 * embedding. The type is the privacy guarantee: anything the control room can ever know
 * about a moment has to be reconstructable from these numbers alone, and a face is not.
 */
export interface FrameFeatures {
  /** Fraction of the frame whose luminance changed beyond the noise floor. 0 to 1. */
  motionEnergy: number;
  /** Distinct moving regions across the frame, from a column projection of the motion mask. */
  occupancy: number;
  /**
   * Width over height of the box containing the pixels that got brighter, which is where
   * something now is. A standing person is well below 1, a person on the ground is well above
   * it. This is the whole of the fall signal, and it is a heuristic about shape rather than
   * any recognition of a body.
   */
  aspect: number;
  /** Centre of mass of the motion, as a fraction of frame width and height. */
  cx: number;
  cy: number;
  /** How far the centre of mass travelled since the previous frame, in frame widths. */
  drift: number;
  /** Motion energy minus the previous frame's, so a sudden burst is visible as a spike. */
  jerk: number;
  t: number;
}

const NOISE_FLOOR = 26; // luminance units, tuned so sensor grain does not register as motion

/**
 * Frame differencing over two RGBA buffers of the same size.
 *
 * Real pixel work: luminance difference per pixel, threshold to a binary motion mask, then
 * take the statistics of that mask. No model, no download, no training. This is the oldest
 * technique in the field and it is the correct one here, because everything it is capable of
 * detecting is movement, which is precisely the constraint being demonstrated.
 */
export function extractFeatures(
  prev: Uint8ClampedArray,
  cur: Uint8ClampedArray,
  width: number,
  height: number,
  previous?: FrameFeatures,
  t = 0,
): FrameFeatures {
  let moved = 0;
  let sumX = 0;
  let sumY = 0;
  // Differencing on its own gives the union of where a body was and where it now is, so a
  // person going from upright to flat measures as a square and the fall becomes invisible.
  // Splitting the mask by the sign of the change fixes it: pixels that got brighter are where
  // something now is, pixels that got darker are where it was. Only the first is the shape.
  let apMinX = width, apMaxX = -1, apMinY = height, apMaxY = -1;
  let vaMinX = width, vaMaxX = -1, vaMinY = height, vaMaxY = -1;
  const columnHit = new Uint8Array(width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Rec. 601 luma, integer weights, because this runs per pixel per frame.
      const lp = (prev[i] * 77 + prev[i + 1] * 150 + prev[i + 2] * 29) >> 8;
      const lc = (cur[i] * 77 + cur[i + 1] * 150 + cur[i + 2] * 29) >> 8;
      const delta = lc - lp;
      if (Math.abs(delta) < NOISE_FLOOR) continue;
      moved++;
      sumX += x;
      sumY += y;
      columnHit[x] = 1;
      if (delta > 0) {
        if (x < apMinX) apMinX = x;
        if (x > apMaxX) apMaxX = x;
        if (y < apMinY) apMinY = y;
        if (y > apMaxY) apMaxY = y;
      } else {
        if (x < vaMinX) vaMinX = x;
        if (x > vaMaxX) vaMaxX = x;
        if (y < vaMinY) vaMinY = y;
        if (y > vaMaxY) vaMaxY = y;
      }
    }
  }

  const total = width * height;
  const motionEnergy = moved / total;
  const cx = moved ? sumX / moved / width : 0;
  const cy = moved ? sumY / moved / height : 0;

  // Occupancy from runs of active columns. Two people standing apart leave two runs; one
  // person leaves one. It miscounts an overlap as a single region, which is stated on screen
  // rather than hidden, and it is the reason this number is called an estimate.
  let occupancy = 0;
  let inRun = false;
  let gap = 0;
  const GAP_TOLERANCE = Math.max(2, Math.round(width * 0.04));
  for (let x = 0; x < width; x++) {
    if (columnHit[x]) {
      if (!inRun) {
        occupancy++;
        inRun = true;
      }
      gap = 0;
    } else if (inRun) {
      gap++;
      if (gap > GAP_TOLERANCE) inRun = false;
    }
  }

  // Prefer the shape of what appeared. Where nothing did, fall back to what vanished, so a
  // body walking out of frame still reports a shape rather than a zero.
  const box = (mnX: number, mxX: number, mnY: number, mxY: number) =>
    mxX >= mnX && mxY >= mnY ? (mxX - mnX + 1) / (mxY - mnY + 1) : 0;
  const appeared = box(apMinX, apMaxX, apMinY, apMaxY);
  const aspect = appeared > 0 ? appeared : box(vaMinX, vaMaxX, vaMinY, vaMaxY);

  const drift = previous ? Math.hypot(cx - previous.cx, cy - previous.cy) : 0;
  const jerk = previous ? motionEnergy - previous.motionEnergy : 0;

  return { motionEnergy, occupancy, aspect, cx, cy, drift, jerk, t };
}

/* --------------------------------------------- part 2: severity, decided by rules */

export type IncidentKind = 'none' | 'fall' | 'crowd-surge' | 'collision' | 'unattended';

export interface FiredRule {
  id: string;
  /** What the rule looks for, in the words a person would use. */
  says: string;
  /** The actual comparison that fired, with the numbers filled in. */
  because: string;
}

export interface Assessment {
  kind: IncidentKind;
  /** 0 nothing, 1 log only, 2 notify, 3 dispatch. */
  severity: 0 | 1 | 2 | 3;
  fired: FiredRule[];
  /** True when the rules want a responder sent to the location. */
  dispatch: boolean;
  /**
   * Why this is not a probability. Rules either fired or did not, and a number between 0 and
   * 1 here would suggest a calibration this system does not have and does not need.
   */
  basis: string;
}

const RULES = {
  FALL_SHAPE: 'the motion box turned from tall to wide',
  FALL_SETTLE: 'a burst of movement then near stillness',
  SURGE_COUNT: 'several moving regions at once',
  SURGE_ENERGY: 'sustained high motion across the frame',
  COLLISION_JERK: 'a sharp spike in motion after steady travel',
  STATIC_PRESENCE: 'something appeared and then stopped moving entirely',
} as const;

/**
 * Assess a short window of features.
 *
 * Deterministic and readable on purpose. This is the layer that decides whether an armed
 * response is sent to a location, and per the project's standing position that layer is
 * never a model. Every rule that fires is returned with the numbers that fired it, so the
 * control room screen can show its working the way the voting centre shows its hashing.
 */
export function assess(window: FrameFeatures[]): Assessment {
  const fired: FiredRule[] = [];
  if (window.length < 3) {
    return { kind: 'none', severity: 0, fired, dispatch: false, basis: 'not enough frames yet' };
  }

  const last = window[window.length - 1];
  const peak = window.reduce((m, f) => Math.max(m, f.motionEnergy), 0);
  const peakAspect = window.reduce((m, f) => Math.max(m, f.aspect), 0);
  const firstAspect = window.find((f) => f.motionEnergy > 0.005)?.aspect ?? 0;
  const maxOccupancy = window.reduce((m, f) => Math.max(m, f.occupancy), 0);
  const tail = window.slice(-3);
  const tailEnergy = tail.reduce((s, f) => s + f.motionEnergy, 0) / tail.length;
  const peakIdx = window.reduce((bi, f, i) => (f.motionEnergy > window[bi].motionEnergy ? i : bi), 0);
  const afterPeak = window.slice(peakIdx + 1);
  const afterPeakEnergy = afterPeak.length
    ? afterPeak.reduce((s, f) => s + f.motionEnergy, 0) / afterPeak.length
    : Infinity;
  const maxJerk = window.reduce((m, f) => Math.max(m, f.jerk), 0);
  const travel = window.reduce((s, f) => s + f.drift, 0);

  const num = (v: number, dp = 3) => v.toFixed(dp);

  // Fall: the box that contains the motion flips from taller than wide to wider than tall,
  // and the movement stops shortly after. Either half alone is ordinary. A person sitting
  // down changes shape without the stillness; a person walking out of frame stops moving
  // without the shape change.
  if (firstAspect > 0 && firstAspect < 0.85 && peakAspect > 1.25) {
    fired.push({
      id: 'FALL_SHAPE',
      says: RULES.FALL_SHAPE,
      because: `aspect went ${num(firstAspect, 2)} to ${num(peakAspect, 2)}, crossing 1.0`,
    });
  }
  // Strictly after the peak, not the last three frames. Averaging the impact frame into the
  // window that is supposed to show stillness makes the rule depend on how long the clip
  // happens to run, which is not a property of the event.
  if (peak > 0.02 && afterPeak.length >= 2 && afterPeakEnergy < peak * 0.25) {
    fired.push({
      id: 'FALL_SETTLE',
      says: RULES.FALL_SETTLE,
      because: `motion peaked at ${num(peak)} and sat at ${num(afterPeakEnergy)} for the ${afterPeak.length} frames after`,
    });
  }

  // Crowd surge: several regions moving hard at the same time, sustained rather than a blip.
  if (maxOccupancy >= 4) {
    fired.push({
      id: 'SURGE_COUNT',
      says: RULES.SURGE_COUNT,
      because: `${maxOccupancy} separate moving regions in one frame`,
    });
  }
  if (tailEnergy > 0.09) {
    fired.push({
      id: 'SURGE_ENERGY',
      says: RULES.SURGE_ENERGY,
      because: `motion held at ${num(tailEnergy)} across the last three frames`,
    });
  }

  // Collision: something was travelling steadily and then the motion spiked.
  if (travel > 0.18 && maxJerk > 0.05) {
    fired.push({
      id: 'COLLISION_JERK',
      says: RULES.COLLISION_JERK,
      because: `travelled ${num(travel, 2)} frame widths, then motion jumped ${num(maxJerk)} in one frame`,
    });
  }

  // Something arrived and stopped. Deliberately the lowest severity in the system.
  if (peak > 0.01 && last.motionEnergy < 0.002 && peakAspect > 0 && peakAspect < 1.1) {
    fired.push({
      id: 'STATIC_PRESENCE',
      says: RULES.STATIC_PRESENCE,
      because: `motion reached ${num(peak)} and is now ${num(last.motionEnergy)}`,
    });
  }

  const has = (id: string) => fired.some((f) => f.id === id);

  let kind: IncidentKind = 'none';
  let severity: 0 | 1 | 2 | 3 = 0;

  if (has('FALL_SHAPE') && has('FALL_SETTLE')) {
    kind = 'fall';
    severity = 3;
  } else if (has('SURGE_COUNT') && has('SURGE_ENERGY')) {
    kind = 'crowd-surge';
    severity = 3;
  } else if (has('COLLISION_JERK')) {
    kind = 'collision';
    severity = 3;
  } else if (has('STATIC_PRESENCE')) {
    kind = 'unattended';
    severity = 1;
  } else if (fired.length > 0) {
    // One half of a pair fired. That is not an incident, and saying so is the point: a
    // single indicator is how a dropped bag becomes an armed response.
    severity = 1;
  }

  return {
    kind,
    severity,
    fired,
    dispatch: severity === 3,
    basis:
      severity === 3
        ? 'two independent rules agreed, which is what this system requires before it sends anybody'
        : fired.length > 0
          ? 'one indicator fired, which is not enough to send a responder'
          : 'nothing crossed a threshold',
  };
}

/* ------------------------------------ part 3: two of three, or the footage stays shut */

/**
 * Shamir secret sharing over GF(256).
 *
 * The footage key is split so that no single official holds it. Any two of the three
 * shareholders can reconstruct it; any one of them holds a value that is, provably,
 * independent of the secret. That last property is the reason this is secret sharing rather
 * than a password split into thirds: one share of a split password leaks a third of the
 * password, while one Shamir share leaks nothing at all.
 *
 * GF(256) with the AES polynomial, so every byte of the key is its own independent
 * polynomial and the arithmetic is exact. No floating point, no modular bignum.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    // multiply by the generator 3 in GF(2^8) mod 0x11b
    x ^= (x << 1) ^ (x & 0x80 ? 0x11b : 0);
    x &= 0xff;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
const gfDiv = (a: number, b: number): number => {
  if (b === 0) throw new Error('division by zero in GF(256)');
  return a === 0 ? 0 : GF_EXP[GF_LOG[a] + 255 - GF_LOG[b]];
};

export interface Share {
  /** The x coordinate this share was evaluated at. Never zero, which is where the secret is. */
  x: number;
  y: Uint8Array;
  holder: string;
}

export const SHAREHOLDERS = [
  { id: 'station', label: 'Station officer', icon: '👮' },
  { id: 'magistrate', label: 'Magistrate', icon: '⚖️' },
  { id: 'ombudsman', label: 'Citizen ombudsman', icon: '🧍' },
] as const;

/**
 * Split a secret into `shares` pieces, any `threshold` of which reconstruct it.
 *
 * For each byte, build a random polynomial whose constant term is that byte, then hand each
 * holder one point on it. Recovering the constant term needs `threshold` points; with fewer,
 * every possible secret remains exactly as likely as it was before.
 */
export function splitSecret(secret: Uint8Array, threshold: number, shares: number): Share[] {
  if (threshold < 2) throw new Error('a threshold below two defeats the point');
  if (shares < threshold) throw new Error('cannot have fewer shares than the threshold');
  if (shares > 255) throw new Error('GF(256) has only 255 usable x coordinates');

  const out: Share[] = Array.from({ length: shares }, (_, i) => ({
    x: i + 1,
    y: new Uint8Array(secret.length),
    holder: SHAREHOLDERS[i]?.id ?? `holder-${i + 1}`,
  }));

  for (let b = 0; b < secret.length; b++) {
    const coeffs = randomBytes(threshold - 1);
    for (const share of out) {
      // Horner from the top coefficient down to the secret byte.
      let acc = 0;
      for (let c = threshold - 2; c >= 0; c--) acc = gfMul(acc, share.x) ^ coeffs[c];
      acc = gfMul(acc, share.x) ^ secret[b];
      share.y[b] = acc;
    }
  }
  return out;
}

/** Lagrange interpolation back to x = 0, which is where the secret sits. */
export function combineShares(shares: Share[]): Uint8Array {
  if (shares.length < 2) throw new Error('one share reconstructs nothing, by design');
  const xs = shares.map((s) => s.x);
  if (new Set(xs).size !== xs.length) throw new Error('the same share twice is still one share');
  const len = shares[0].y.length;
  const out = new Uint8Array(len);

  for (let b = 0; b < len; b++) {
    let acc = 0;
    for (let i = 0; i < shares.length; i++) {
      let basis = 1;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        basis = gfMul(basis, gfDiv(xs[j], xs[i] ^ xs[j]));
      }
      acc ^= gfMul(shares[i].y[b], basis);
    }
    out[b] = acc;
  }
  return out;
}

export interface SealedFootage {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  /** What the camera saw, in the only terms it can express it. Not encrypted, because
   *  numbers about movement are what the town is allowed to act on without a warrant. */
  features: FrameFeatures[];
  cameraId: string;
  t: number;
}

/** Encrypt a clip under a fresh AES-GCM key, and return the key so it can be split. */
export async function sealFootage(
  clip: string,
  cameraId: string,
  features: FrameFeatures[],
  t: number,
): Promise<{ sealed: SealedFootage; key: Uint8Array }> {
  const raw = randomBytes(32);
  const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt']);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(clip) as BufferSource,
  );
  return {
    sealed: { iv, ciphertext: new Uint8Array(ct), features, cameraId, t },
    key: raw,
  };
}

/**
 * Open a clip using whatever shares were presented.
 *
 * With one share this does not fail politely, it fails cryptographically: the reconstructed
 * key is simply a different key, and AES-GCM's tag rejects it. There is no code path here
 * that checks a permission flag and decides to say no, which is the difference between a
 * safeguard and a setting.
 */
export async function openFootage(sealed: SealedFootage, shares: Share[]): Promise<string> {
  const raw = combineShares(shares);
  const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv as BufferSource },
    key,
    sealed.ciphertext as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

/* --------------------------------------- part 4: the record of who looked, and who tried */

/**
 * Why a request was made. A closed list, exactly as the school refuses free text as a reason
 * for superseding a certificate. "Investigation" is not a reason, it is a category, and a
 * category no auditor can test is how an access log becomes decoration.
 */
export type AccessReason =
  | 'active-incident'
  | 'magistrate-warrant'
  | 'subject-request'
  | 'audit-review';

export const ACCESS_REASONS: Record<AccessReason, string> = {
  'active-incident': 'An incident is live and a responder is on the way',
  'magistrate-warrant': 'A magistrate has issued a warrant naming this clip',
  'subject-request': 'The person in the footage asked to see it',
  'audit-review': 'A scheduled audit of the network itself',
};

export type AccessAction = 'granted' | 'refused';

export interface AccessEntry {
  index: number;
  action: AccessAction;
  /**
   * Salted hashes, not names. The log has to be publicly checkable without becoming a public
   * register of who is under surveillance, and those two requirements are only compatible if
   * the identities on it are commitments. Whoever holds the salt can demonstrate an entry is
   * about them; nobody else can even enumerate the entries.
   */
  subjectCommit: string;
  officerCommit: string;
  reason: AccessReason;
  /** Which shareholders combined. Below the threshold this is the evidence of the attempt. */
  signers: string[];
  cameraId: string;
  clipT: number;
  t: number;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = '0'.repeat(64);

/** A commitment to an identity: salted so the log cannot be brute-forced back to a name. */
export async function commit(identity: string, salt: string): Promise<string> {
  return sha256Hex(identity + '\u0000' + salt);
}

async function hashEntry(e: Omit<AccessEntry, 'hash'>): Promise<string> {
  return sha256Hex(
    [
      e.index,
      e.action,
      e.subjectCommit,
      e.officerCommit,
      e.reason,
      e.signers.join(','),
      e.cameraId,
      e.clipT,
      e.t,
      e.prevHash,
    ].join('|'),
  );
}

/**
 * Append an access event.
 *
 * Refusals are appended with the same ceremony as grants. This is the load-bearing decision
 * in the whole module: a system that only records successful access cannot distinguish an
 * officer who never looked from one who tried four times and was stopped, and the second is
 * the one an oversight body needs to see.
 */
export async function appendAccess(
  chain: AccessEntry[],
  event: Omit<AccessEntry, 'index' | 'prevHash' | 'hash'>,
): Promise<AccessEntry[]> {
  const prev = chain[chain.length - 1];
  const partial = {
    ...event,
    index: chain.length,
    prevHash: prev ? prev.hash : GENESIS_HASH,
  };
  const hash = await hashEntry(partial);
  return [...chain, { ...partial, hash }];
}

export interface ChainVerdict {
  ok: boolean;
  brokenAt: number[];
}

/** Recompute every hash and every link. Any edit anywhere flags that entry and all later ones. */
export async function verifyAccessChain(chain: AccessEntry[]): Promise<ChainVerdict> {
  const brokenAt: number[] = [];
  let expectedPrev = GENESIS_HASH;
  let poisoned = false;
  for (const e of chain) {
    const { hash, ...rest } = e;
    const recomputed = await hashEntry(rest);
    if (recomputed !== hash || e.prevHash !== expectedPrev) poisoned = true;
    if (poisoned) brokenAt.push(e.index);
    expectedPrev = hash;
  }
  return { ok: brokenAt.length === 0, brokenAt };
}

/* ----------------------------------------------- part 5: dispatch on the real road graph */

export interface RoadNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface RoadGraph {
  nodes: RoadNode[];
  /** Undirected, as street pairs. Distance comes from the coordinates. */
  edges: [string, string][];
}

export interface Route {
  path: string[];
  metres: number;
  seconds: number;
}

const METRES_PER_UNIT = 45;
const RESPONDER_METRES_PER_SECOND = 8.3; // roughly 30 km/h through a small town

/**
 * A star over the town streets.
 *
 * Straight-line distance is an admissible heuristic here, because no road is shorter than the
 * line between its ends. That matters for an honest reason rather than an academic one:
 * "nearest responder" is a claim, and a heuristic that overestimated would let the screen
 * show a route that is not the nearest while saying that it is.
 */
export function shortestRoute(graph: RoadGraph, fromId: string, toId: string): Route | null {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const from = byId.get(fromId);
  const to = byId.get(toId);
  if (!from || !to) return null;

  const neighbours = new Map<string, string[]>();
  for (const [a, b] of graph.edges) {
    if (!neighbours.has(a)) neighbours.set(a, []);
    if (!neighbours.has(b)) neighbours.set(b, []);
    neighbours.get(a)!.push(b);
    neighbours.get(b)!.push(a);
  }

  const dist = (a: RoadNode, b: RoadNode) => Math.hypot(a.x - b.x, a.y - b.y);
  const g = new Map<string, number>([[fromId, 0]]);
  const cameFrom = new Map<string, string>();
  const open = new Set<string>([fromId]);
  const closed = new Set<string>();

  while (open.size) {
    let current = '';
    let best = Infinity;
    for (const id of open) {
      const node = byId.get(id)!;
      const f = (g.get(id) ?? Infinity) + dist(node, to);
      if (f < best) {
        best = f;
        current = id;
      }
    }
    if (current === toId) {
      const path = [current];
      let cur = current;
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)!;
        path.unshift(cur);
      }
      const metres = (g.get(toId) ?? 0) * METRES_PER_UNIT;
      return { path, metres, seconds: metres / RESPONDER_METRES_PER_SECOND };
    }
    open.delete(current);
    closed.add(current);
    for (const nb of neighbours.get(current) ?? []) {
      if (closed.has(nb)) continue;
      const tentative = (g.get(current) ?? Infinity) + dist(byId.get(current)!, byId.get(nb)!);
      if (tentative < (g.get(nb) ?? Infinity)) {
        cameFrom.set(nb, current);
        g.set(nb, tentative);
        open.add(nb);
      }
    }
  }
  return null;
}

/* ------------------------------------------- part 6: does this one actually need a chain */

export interface ChainQuestion {
  n: number;
  question: string;
  verdict: 'yes' | 'no' | 'by design';
  why: string;
}

/**
 * VISION's seven-question test, run against the access log rather than against the footage.
 *
 * Three of the town's four existing systems answer no, and the honest thing about this one is
 * that it answers yes. The reason is not that policing is important. It is that the record of
 * who watched whom has no operator every party would accept, which is the question almost
 * every govtech chain proposal quietly fails.
 *
 * The footage is a separate matter and needs no chain at all. It needs encryption and a split
 * key. Keeping those two answers apart is the whole argument of this building.
 */
export const CHAIN_TEST: ChainQuestion[] = [
  {
    n: 1,
    question: 'More than one party writes to the record.',
    verdict: 'yes',
    why: 'The camera network, the station, the magistrate and the ombudsman all append to it.',
  },
  {
    n: 2,
    question: 'Those parties do not trust each other.',
    verdict: 'yes',
    why: 'Police oversight exists precisely because the watched will not take the watcher at his word.',
  },
  {
    n: 3,
    question: 'There is no third party all of them would accept as the operator.',
    verdict: 'yes',
    why: 'The police cannot run the log that audits the police, and the magistrate is a party to the requests rather than a neutral host. This is the question most proposals fail, and the one this system genuinely passes.',
  },
  {
    n: 4,
    question: 'Someone must check the record later who was not present when it was written.',
    verdict: 'yes',
    why: 'The citizen whose footage was opened was, by definition, not in the control room. She may be reading it in court a year later.',
  },
  {
    n: 5,
    question: 'A quiet edit would be catastrophic.',
    verdict: 'yes',
    why: 'Deleting the record of an unlawful viewing is not a side effect of that abuse. It is the abuse.',
  },
  {
    n: 6,
    question: 'The throughput and the irreversibility are survivable.',
    verdict: 'yes',
    why: 'A town generates thousands of access events a year, not billions of payments. This is the scale a chain is actually good at.',
  },
  {
    n: 7,
    question: 'No personal data needs to sit on the record itself.',
    verdict: 'by design',
    why: 'It does not pass on its own, it had to be made to pass. Names would turn a public audit trail into a public surveillance register, so every identity on this log is a salted commitment, and the footage never goes near the chain.',
  },
];

/** The verdict the screen lands on, stated once so the copy and the code cannot drift apart. */
export const CHAIN_VERDICT = {
  answer: 'yes' as const,
  headline: 'The access log earns a chain. The footage does not.',
  detail:
    'This is the second system in the town to answer yes, alongside the voting centre, and three of the five still answer no. The footage needs encryption and a split key, which is a different problem with a different tool.',
};
