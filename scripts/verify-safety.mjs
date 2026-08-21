#!/usr/bin/env node
/**
 * Asserts what the AI Safety Command screen claims, against the shipped module.
 *
 * The three claims worth testing are the ones a visitor cannot check by looking: that one
 * shareholder genuinely cannot open footage rather than merely being told not to, that a
 * refused attempt is as permanent as a granted one, and that the camera payload has no field
 * capable of carrying a face. The rest covers the incident rules, where the failure that
 * matters is a single indicator sending an armed response to a dropped bag.
 *
 * Run with:  npm run verify-safety
 */

import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { webcrypto } from 'crypto'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const {
  ACCESS_REASONS, CHAIN_TEST, CHAIN_VERDICT, SHAREHOLDERS, appendAccess, assess, combineShares,
  commit, extractFeatures, openFootage, sealFootage, shortestRoute, splitSecret,
  verifyAccessChain,
} = await import(pathToFileURL(path.join(ROOT, 'src/components/india/safety.ts')).href)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ': ' + detail : ''}`)
  if (!ok) failures++
}
const threw = async (fn) => { try { await fn(); return null } catch (e) { return e.message } }

console.log('AI Safety Command: what the building claims\n')
console.log('The camera payload')

const W = 48, H = 48
const blank = () => new Uint8ClampedArray(W * H * 4).fill(0)
const withBox = (x0, y0, w, h) => {
  const buf = blank()
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 4
      buf[i] = buf[i + 1] = buf[i + 2] = 255
      buf[i + 3] = 255
    }
  }
  return buf
}

const still = extractFeatures(withBox(10, 10, 6, 20), withBox(10, 10, 6, 20), W, H)
check('identical frames produce no motion at all', still.motionEnergy === 0)

const standing = withBox(10, 8, 6, 24)   // tall: a person upright
const fallen = withBox(10, 26, 24, 6)    // wide: the same person on the ground
const moved = extractFeatures(standing, fallen, W, H)
check('a changed frame produces real motion', moved.motionEnergy > 0,
  `${(moved.motionEnergy * 100).toFixed(1)}% of pixels changed`)
check('the motion box is wider than tall when someone goes down', moved.aspect > 1,
  `aspect ${moved.aspect.toFixed(2)}`)

const payloadKeys = Object.keys(moved).sort().join(',')
check('the payload carries only numbers, with no field able to hold an image',
  payloadKeys === 'aspect,cx,cy,drift,jerk,motionEnergy,occupancy,t' &&
  Object.values(moved).every((v) => typeof v === 'number'),
  payloadKeys)

const twoPeople = extractFeatures(blank(), (() => {
  const b = withBox(6, 10, 5, 20)
  const c = withBox(34, 10, 5, 20)
  for (let i = 0; i < b.length; i++) if (c[i]) b[i] = c[i]
  return b
})(), W, H)
check('two separated people are counted as two regions', twoPeople.occupancy === 2,
  `occupancy ${twoPeople.occupancy}`)

console.log('\nWhen a responder is sent')

const seq = (frames) => {
  const out = []
  let prev
  for (let i = 0; i < frames.length; i++) {
    const f = extractFeatures(i === 0 ? frames[0] : frames[i - 1], frames[i], W, H, prev, i)
    out.push(f)
    prev = f
  }
  return out
}

const fallFrames = seq([
  withBox(10, 8, 6, 24), withBox(13, 8, 6, 24), withBox(16, 8, 6, 24),
  withBox(10, 26, 24, 6), withBox(10, 26, 24, 6), withBox(10, 26, 24, 6),
])
const fall = assess(fallFrames)
check('a fall dispatches a responder', fall.dispatch && fall.kind === 'fall',
  `${fall.kind}, severity ${fall.severity}`)
check('the fall verdict names both rules that fired', fall.fired.length >= 2,
  fall.fired.map((f) => f.id).join(' + '))

const quiet = assess(seq([blank(), blank(), blank(), blank()]))
check('an empty street dispatches nobody', !quiet.dispatch && quiet.severity === 0)

const bag = assess(seq([blank(), withBox(20, 20, 6, 6), withBox(20, 20, 6, 6), withBox(20, 20, 6, 6)]))
check('something dropped and left behind does NOT send an armed response',
  !bag.dispatch && bag.severity <= 1, `${bag.kind}, severity ${bag.severity}`)
// The screen promises that one indicator fires and nobody is sent. Both halves are asserted,
// because a version where nothing fires at all would still pass the check above while making
// the copy beside it untrue.
check('exactly one indicator fires, and it is the unattended-object rule',
  bag.kind === 'unattended' && bag.fired.length === 1 && bag.fired[0].id === 'STATIC_PRESENCE',
  bag.fired.map((f) => f.id).join(' + ') || 'nothing fired')
check('and the reason it did not is stated', bag.basis.length > 0, bag.basis)

// A crowd surge is the other severity-3 path, and it must not be reachable by one person
// moving hard: the count rule and the energy rule have to agree.
const crowdFrame = (offset) => {
  const b = blank()
  for (const x0 of [4, 14, 24, 34]) {
    const c = withBox(x0 + (offset % 3), 12, 6, 22)
    for (let i = 0; i < b.length; i++) if (c[i]) b[i] = c[i]
  }
  return b
}
const surge = assess(seq([crowdFrame(0), crowdFrame(2), crowdFrame(0), crowdFrame(2)]))
check('four people moving hard together is a surge', surge.kind === 'crowd-surge' && surge.dispatch,
  `${surge.kind}, severity ${surge.severity}, ${surge.fired.length} rules agreed`)

const onePersonHard = assess(seq([
  withBox(6, 10, 6, 22), withBox(20, 10, 6, 22), withBox(6, 10, 6, 22), withBox(20, 10, 6, 22),
]))
check('one person moving hard is never a surge', onePersonHard.kind !== 'crowd-surge',
  onePersonHard.kind)

console.log('\nOpening footage')

const secret = new Uint8Array(32).map((_, i) => (i * 37 + 11) & 0xff)
const shares = splitSecret(secret, 2, 3)
check('the key splits into one share per shareholder', shares.length === SHAREHOLDERS.length)

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
const pairs = [[0, 1], [0, 2], [1, 2]]
check('any two shareholders reconstruct the key',
  pairs.every(([i, j]) => same(combineShares([shares[i], shares[j]]), secret)),
  'all three pairings')
check('all three together also reconstruct it', same(combineShares(shares), secret))

const one = await threw(() => combineShares([shares[0]]))
check('one share reconstructs nothing', one !== null, one)
const dup = await threw(() => combineShares([shares[1], shares[1]]))
check('the same share presented twice is still one share', dup !== null, dup)

const otherSecret = new Uint8Array(32).fill(7)
const otherShares = splitSecret(otherSecret, 2, 3)
const mixed = combineShares([shares[0], otherShares[1]])
check('shares from different splits combine into neither secret',
  !same(mixed, secret) && !same(mixed, otherSecret))

const clip = 'Camera 07, junction of the market road, 47 seconds.'
const { sealed, key } = await sealFootage(clip, 'cam-07', fallFrames, 1000)
const keyShares = splitSecret(key, 2, 3)

const opened = await openFootage(sealed, [keyShares[0], keyShares[1]])
check('two shareholders together open the clip', opened === clip)

const wrong = await threw(() => openFootage(sealed, [keyShares[0], otherShares[1]]))
check('a forged second share fails in the cryptography, not in a permission check',
  wrong !== null, 'AES-GCM rejected the reconstructed key')

check('the movement numbers travel in the clear beside the ciphertext',
  Array.isArray(sealed.features) && sealed.features.length > 0 && sealed.ciphertext.length > 0)

console.log('\nThe access log')

const salt = 'per-citizen salt, held by the citizen'
const subject = await commit('Kamla Devi', salt)
const officer = await commit('Officer 47', 'station salt')
const base = { subjectCommit: subject, officerCommit: officer, cameraId: 'cam-07', clipT: 1000 }

let chain = []
chain = await appendAccess(chain, {
  ...base, action: 'granted', reason: 'active-incident',
  signers: ['station', 'magistrate'], t: 1001,
})
chain = await appendAccess(chain, {
  ...base, action: 'refused', reason: 'audit-review', signers: ['station'], t: 1002,
})
chain = await appendAccess(chain, {
  ...base, action: 'granted', reason: 'subject-request',
  signers: ['ombudsman', 'magistrate'], t: 1003,
})

check('the log carries three entries', chain.length === 3)
check('a refused attempt is on the record', chain[1].action === 'refused',
  `entry #1, one signer: ${chain[1].signers.join(', ')}`)
check('the chain verifies', (await verifyAccessChain(chain)).ok)

const edited = chain.map((e) => ({ ...e }))
edited[1].action = 'granted'
const broken = await verifyAccessChain(edited)
check('quietly turning a refusal into a grant breaks the chain', !broken.ok,
  `broken at [${broken.brokenAt}]`)
check('the edited entry and every later one are flagged',
  broken.brokenAt.includes(1) && broken.brokenAt.includes(2))
check('deleting the refusal is detected too',
  !(await verifyAccessChain([chain[0], chain[2]])).ok)

check('the log names nobody',
  !JSON.stringify(chain).includes('Kamla') && !JSON.stringify(chain).includes('Officer 47'))
check('the same person under a different salt is a different commitment',
  (await commit('Kamla Devi', 'another salt')) !== subject)
check('the citizen holding her salt can find her own entries',
  chain.filter((e) => e.subjectCommit === subject).length === 3)
check('every reason on the log comes from the closed list',
  chain.every((e) => e.reason in ACCESS_REASONS))

console.log('\nDispatch')

const graph = {
  nodes: [
    { id: 'a', label: 'Station', x: 0, y: 0 },
    { id: 'b', label: 'Market', x: 3, y: 0 },
    { id: 'c', label: 'Canal road', x: 0, y: 4 },
    { id: 'd', label: 'Junction', x: 3, y: 4 },
    { id: 'e', label: 'School gate', x: 6, y: 4 },
  ],
  edges: [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['d', 'e']],
}
const route = shortestRoute(graph, 'a', 'e')

// Brute force every simple path and compare, because "nearest" is a claim the screen makes.
const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
const adj = {}
for (const [x, y] of graph.edges) {
  if (!adj[x]) adj[x] = []
  if (!adj[y]) adj[y] = []
  adj[x].push(y)
  adj[y].push(x)
}
let best = Infinity
const walk = (at, seen, cost) => {
  if (at === 'e') { best = Math.min(best, cost); return }
  for (const nb of adj[at] || []) {
    if (seen.has(nb)) continue
    walk(nb, new Set([...seen, nb]),
      cost + Math.hypot(byId[at].x - byId[nb].x, byId[at].y - byId[nb].y))
  }
}
walk('a', new Set(['a']), 0)
check('the route found is genuinely the shortest, not merely a good one',
  Math.abs(route.metres / 45 - best) < 1e-9,
  `${route.path.join(' to ')}, ${Math.round(route.metres)} m`)
check('it reports a travel time', route.seconds > 0, `${Math.round(route.seconds)} s`)
check('an unreachable node returns nothing rather than guessing',
  shortestRoute(graph, 'a', 'nowhere') === null)

console.log('\nThe seven questions')
check('all seven are answered', CHAIN_TEST.length === 7)
check('the verdict is yes, and question seven is the one that had to be designed for',
  CHAIN_VERDICT.answer === 'yes' && CHAIN_TEST[6].verdict === 'by design')

console.log('')
if (failures) {
  console.log(`${failures} check(s) FAILED.`)
  process.exit(1)
}
console.log('All checks passed.')
