#!/usr/bin/env node
/**
 * Replays what the Digital Voting Centre does, against the real blockchain module, and
 * asserts the properties the screen claims: one vote per token, tamper detection, and an
 * honest restore that brings back the vote that was actually cast.
 *
 * Run with:  node scripts/verify-voting-chain.mjs
 */

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { webcrypto } from 'crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Node strips the type annotations for us, so this runs the shipped module itself rather
// than a copy of it.
const {
  createGenesisBlock, mineBlock, makeVoterToken, verifyChain, tally, DIFFICULTY_PREFIX,
} = await import(pathToFileURL(path.join(ROOT, 'src/components/india/blockchain.ts')).href);

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const CITIZENS = [
  { name: 'Asha Devi', village: 'Rampur' },
  { name: 'Ravi Kumar', village: 'Rampur' },
  { name: 'Meena Kumari', village: 'Basantpur' },
];

console.log('Digital Voting Centre — chain properties\n');

// --- three citizens vote -----------------------------------------------------------
let chain = [await createGenesisBlock()];
const cast = new Set();
const votes = ['pragati', 'janshakti', 'navbharat'];

for (let i = 0; i < CITIZENS.length; i++) {
  const token = await makeVoterToken(`${CITIZENS[i].name}-${CITIZENS[i].village}`);
  const prev = chain[chain.length - 1];
  const block = await mineBlock({
    index: prev.index + 1, timestamp: 1767225600000 + i, voterToken: token,
    candidate: votes[i], prevHash: prev.hash,
  });
  chain.push(block);
  cast.add(token);
}

check('three citizens produce three blocks', chain.length === 4, `${chain.length - 1} votes`);
check('every block meets the difficulty target',
  chain.slice(1).every((b) => b.hash.startsWith(DIFFICULTY_PREFIX)), `prefix ${DIFFICULTY_PREFIX}`);
let state = await verifyChain(chain);
check('the honest chain verifies', state.valid);
check('the tally counts one vote each',
  JSON.stringify(tally(chain)) === JSON.stringify({ pragati: 1, janshakti: 1, navbharat: 1 }),
  JSON.stringify(tally(chain)));

// --- one person, one vote ----------------------------------------------------------
const ashaToken = await makeVoterToken('Asha Devi-Rampur');
check('a token is stable for the same citizen', cast.has(ashaToken));
check("a voted citizen is found on the chain by token",
  chain.some((b) => b.index > 0 && b.voterToken === ashaToken));
const arjunToken = await makeVoterToken('Arjun Singh-Rampur');
check('an unvoted citizen is not on the chain',
  !chain.some((b) => b.voterToken === arjunToken) && !cast.has(arjunToken));
check('no two blocks share a voter token',
  new Set(chain.slice(1).map((b) => b.voterToken)).size === chain.length - 1);

// --- tamper ------------------------------------------------------------------------
const honestVotes = new Map();
const target = 1;
const tampered = chain.map((b) => ({ ...b }));
honestVotes.set(tampered[target].index, tampered[target].candidate);
tampered[target].candidate = 'haritdal';
state = await verifyChain(tampered);
check('editing one vote breaks the chain', !state.valid, `broken at [${state.brokenAt}]`);
check('the edited block and every later block are flagged',
  state.brokenAt.includes(target) && state.brokenAt.includes(target + 1) && state.brokenAt.includes(target + 2),
  `broken at [${state.brokenAt}]`);

// --- restore -----------------------------------------------------------------------
// Exactly what repairChain does: put the real votes back, then re-mine from the break.
let fixed = tampered.map((b) => {
  const honest = honestVotes.get(b.index);
  return honest !== undefined ? { ...b, candidate: honest } : { ...b };
});
for (let i = state.brokenAt[0]; i < fixed.length; i++) {
  const prev = fixed[i - 1];
  const b = fixed[i];
  const remined = await mineBlock({
    index: b.index, timestamp: b.timestamp, voterToken: b.voterToken,
    candidate: b.candidate, prevHash: prev.hash,
  });
  fixed = fixed.map((x, j) => (j === i ? remined : x));
}
const after = await verifyChain(fixed);
check('the restored chain verifies again', after.valid);
check('the restored chain carries the vote that was really cast',
  fixed[target].candidate === 'pragati', `block #${target} = ${fixed[target].candidate}`);
check('the tally is back to the honest result',
  JSON.stringify(tally(fixed)) === JSON.stringify({ pragati: 1, janshakti: 1, navbharat: 1 }),
  JSON.stringify(tally(fixed)));

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' CHECK(S) FAILED.'}`);
process.exit(failures === 0 ? 0 : 1);
