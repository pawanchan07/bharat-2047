#!/usr/bin/env node
/**
 * Asserts what the National Digital School screen claims, against the shipped module:
 * a certificate that proves itself, a forgery that cannot survive, selective disclosure
 * that really hides what it says it hides, and a revocation register that is itself
 * tamper-evident.
 *
 * Run with:  npm run verify-school
 */

import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { webcrypto } from 'crypto'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const {
  STUDENTS, appendRevocation, cidV1, createSchool, fieldsFor, issue, leafHash,
  merkleProof, present, revocationChainValid, rootFromProof, verify, verifySignature,
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

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' CHECK(S) FAILED.'}`)
process.exit(failures === 0 ? 0 : 1)
