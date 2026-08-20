#!/usr/bin/env node
/**
 * Asserts what the National Digital School screen claims, against the shipped module:
 * a certificate that proves itself, a forgery that cannot survive, selective disclosure
 * that really hides what it says it hides, and a revocation register that is itself
 * tamper-evident — plus governed supersession: a certificate that cannot be edited, only
 * replaced, and only when the rules that stop a supersession being an edit in disguise are
 * actually met.
 *
 * Run with:  npm run verify-school
 */

import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { webcrypto } from 'crypto'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const {
  CHALLENGE_WINDOW_MS, STUDENTS, appendContest, appendRevocation, appendSupersession, cidV1,
  createSchool, createSigner, fieldsFor, issue, leafHash, merkleProof, present, registerValid,
  revocationChainValid, rootFromProof, statusOf, supersessionValid, verify, verifySignature,
} = await import(pathToFileURL(path.join(ROOT, 'src/components/india/school.ts')).href)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

console.log('National Digital School — credential properties\n')

const school = await createSchool('National Digital School, Rampur')
const rec = STUDENTS[0]
const cert = await issue(school, rec)
let revocations = []

// --- issuing -----------------------------------------------------------------------
check('a certificate is issued with one leaf per field',
  cert.leaves.length === fieldsFor(rec).length, `${cert.leaves.length} fields`)
check('its address is a real CIDv1 (base32, raw codec, sha2-256)',
  /^bafkrei[a-z2-7]{52}$/.test(cert.cid), cert.cid.slice(0, 24) + '…')
check('the address is derived from the content it addresses',
  (await cidV1(new TextEncoder().encode(cert.root))) === cert.cid)
check('the school’s signature over the root verifies',
  await verifySignature(school.publicKey, cert.root, cert.signature))

// --- full presentation --------------------------------------------------------------
const everything = await present(cert, cert.fields.map((f) => f.key), school.publicKeyId)
let out = await verify(everything, school, revocations)
check('a complete, untouched certificate passes all four checks', out.ok,
  out.checks.map((c) => (c.ok ? '✓' : '✗') + c.id).join(' '))

// --- forgery ------------------------------------------------------------------------
const forged = JSON.parse(JSON.stringify(everything))
const markIdx = forged.disclosed.findIndex((d) => d.field.key.startsWith('mark:'))
const before = forged.disclosed[markIdx].field.value
forged.disclosed[markIdx].field.value = '99'
out = await verify(forged, school, revocations)
check('changing one mark breaks the certificate', !out.ok,
  `${before} → 99, failed: ${out.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`)
check('it fails on the content check, not by luck elsewhere',
  out.checks.find((c) => c.id === 'address').ok === false)
check('the school’s signature still verifies — the root did not change',
  out.checks.find((c) => c.id === 'signature').ok === true,
  'which is why the Merkle proof is what catches this')

// --- a forger with their own key ------------------------------------------------------
const impostor = await createSchool('Totally Real University')
const impostorCert = await issue(impostor, rec)
const impostorPresentation = await present(
  impostorCert, impostorCert.fields.map((f) => f.key), impostor.publicKeyId)
out = await verify(impostorPresentation, school, revocations)
check('a certificate signed by somebody else is rejected', !out.ok,
  `failed: ${out.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`)

// --- selective disclosure -------------------------------------------------------------
const minimal = await present(cert, ['name', 'qualification', 'result'], school.publicKeyId)
out = await verify(minimal, school, revocations)
check('three fields alone still verify against the signed root', out.ok,
  `${minimal.disclosed.length} of ${minimal.totalFields} fields shown`)
const disclosedKeys = minimal.disclosed.map((d) => d.field.key)
check('no marks and no CGPA are present anywhere in what was handed over',
  !JSON.stringify(minimal).includes('"cgpa"') &&
  !disclosedKeys.some((k) => k.startsWith('mark:')),
  'the employer receives hashes, not values')
check('every leaf is salted, so a value cannot be brute-forced',
  new Set(Object.values(cert.salts)).size === cert.leaves.length,
  `${cert.leaves.length} distinct salts`)

// A leaf without its salt must not be reconstructible by guessing the value.
const guessed = await leafHash({ key: 'cgpa', value: '8.9' }, '')
check('guessing the right value without the salt does not reproduce the leaf',
  guessed !== cert.leaves[cert.fields.findIndex((f) => f.key === 'cgpa')])

// --- moving a value between fields ------------------------------------------------------
const swapped = await present(cert, ['name'], school.publicKeyId)
swapped.disclosed[0].field = { ...swapped.disclosed[0].field, key: 'qualification' }
out = await verify(swapped, school, revocations)
check('a value cannot be moved into a different field', !out.ok,
  'the field name is inside the leaf')

// --- proofs -------------------------------------------------------------------------
const idx = 2
const proof = await merkleProof(cert.leaves, idx)
check('a Merkle proof reaches the signed root',
  (await rootFromProof(cert.leaves[idx], proof)) === cert.root,
  `${proof.length} sibling steps for ${cert.leaves.length} leaves`)

// --- revocation -----------------------------------------------------------------------
revocations = await appendRevocation(revocations, 'bafkreiplaceholderplaceholderplaceholderplaceholder', 'Issued in error')
revocations = await appendRevocation(revocations, cert.cid, 'Awarded on forged prerequisites')
check('the revocation register chains correctly', await revocationChainValid(revocations),
  `${revocations.length} entries`)
out = await verify(minimal, school, revocations)
check('a revoked certificate stops verifying', !out.ok,
  out.checks.find((c) => c.id === 'revocation').detail)
check('it fails only on revocation — the crypto is still sound',
  out.checks.filter((c) => !c.ok).length === 1)

const tampered = revocations.map((r) => ({ ...r }))
tampered[1].reason = 'Nothing to see here'
check('editing the revocation register is itself detected',
  !(await revocationChainValid(tampered)))

// --- governed supersession -------------------------------------------------------------
// A correction is the dangerous verb: get its rules wrong and an append-only register is an
// editable one with extra steps. Every rule is asserted here by trying to break it.
const board = await createSigner('State Board of Higher Education')
const fixedRec = { ...STUDENTS[0], rollNo: 'RMP/2047/0421' }
const replacement = await issue(school, fixedRec, 8100)

check('a corrected certificate is a real re-issue, not an edit',
  replacement.cid !== cert.cid && replacement.root !== cert.root,
  'new root, new address, its own signature')
check('the replacement verifies on its own',
  (await verify(await present(replacement, replacement.fields.map((f) => f.key), school.publicKeyId), school, [])).ok)

let reg = []
const t0 = 1_000_000
reg = await appendSupersession(reg, {
  oldCid: cert.cid, newCid: replacement.cid, reasonCode: 'transcription',
  issuer: school, board, at: t0,
})
check('the register chains after a supersession', await registerValid(reg), reg.length + ' entry')
check('both authorities really signed it', await supersessionValid(reg[0], school, board))
check('the lineage runs both ways',
  reg[0].cid === cert.cid && reg[0].replacedBy === replacement.cid)

let refused = null
try {
  await appendSupersession(reg, {
    oldCid: cert.cid, newCid: replacement.cid, reasonCode: 'because-we-felt-like-it',
    issuer: school, board, at: t0,
  })
} catch (e) { refused = e.message }
check('a reason outside the closed list is refused', refused !== null, refused ?? '')

refused = null
try {
  await appendSupersession(reg, {
    oldCid: cert.cid, newCid: replacement.cid, reasonCode: 'transcription',
    issuer: school, board: school, at: t0,
  })
} catch (e) { refused = e.message }
check('one signer signing twice is not a threshold', refused !== null, refused ?? '')

check('the board cannot be swapped for another key after the fact',
  !(await supersessionValid(reg[0], school, await createSigner('Some Other Board'))))

// The challenge window: the original is still the one that counts until it closes.
check('inside the window the original still verifies',
  (await verify(minimal, school, reg, t0 + 1000)).ok,
  statusOf(cert.cid, reg, t0 + 1000).state)
check('after the window it is superseded',
  !(await verify(minimal, school, reg, t0 + CHALLENGE_WINDOW_MS + 1)).ok,
  statusOf(cert.cid, reg, t0 + CHALLENGE_WINDOW_MS + 1).state)

out = await verify(minimal, school, reg, t0 + CHALLENGE_WINDOW_MS + 1)
check('a superseded certificate still has a valid signature',
  out.checks.filter((c) => !c.ok).length === 1 && out.checks.find((c) => c.id === 'signature').ok,
  'only the fourth check moves')

// The holder can refuse, and refusing is itself append-only.
const contested = await appendContest(reg, 0, cert.holder, t0 + 2000)
check('the holder can contest inside the window', await registerValid(contested),
  contested.length + ' entries, nothing removed')
check('a contested supersession never takes effect',
  statusOf(cert.cid, contested, t0 + CHALLENGE_WINDOW_MS + 5000).state === 'contested')
check('the original is current again after a contest',
  (await verify(minimal, school, contested, t0 + CHALLENGE_WINDOW_MS + 5000)).ok)

refused = null
try { await appendContest(reg, 0, cert.holder, t0 + CHALLENGE_WINDOW_MS + 1) }
catch (e) { refused = e.message }
check('contesting after the window has closed is refused', refused !== null, refused ?? '')

const forgedContest = contested.map((r) => ({ ...r }))
forgedContest[1].reason = 'She agreed to it, actually'
check('editing a contest entry is detected like any other',
  !(await registerValid(forgedContest)))

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' CHECK(S) FAILED.'}`)
process.exit(failures === 0 ? 0 : 1)
