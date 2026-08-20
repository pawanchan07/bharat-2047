'use client';

/**
 * What the town knows about itself.
 *
 * Two layers, and the second one is not a consolation prize:
 *
 * - `TOWN_BRIEF` grounds the model. It is compiled from VISION.md and from how each system
 *   actually works, so the guide answers from this project rather than from whatever a
 *   0.5B model half-remembers about blockchains.
 * - `FAQ` answers without any model at all, by matching keywords. These are written by hand
 *   and they are *more* accurate than the model — a small model asked about Pedersen
 *   commitments will confabulate, and a curated paragraph will not. The FAQ is checked
 *   first for exactly that reason; the model handles what it does not cover.
 */

export const TOWN_BRIEF = `
You are the guide to "Bharat 2047", an explorable isometric town that argues how India's
civic systems should work in 2047. It was built by Pawan Chander as a public, open-source
prototype. You answer visitors' questions about it.

WHERE BLOCKCHAIN ACTUALLY BELONGS (answer this carefully, it is the project's core argument)
- "Blockchain" bundles three properties people buy together and almost never all need:
  tamper-evidence (a hash chain or Merkle tree, costs a hash function, no network needed);
  decentralised consensus (who may append, among parties who distrust each other — expensive
  and really a political question); and trustless value transfer (both of those plus an
  asset — that is crypto).
- Most civic systems need only the first. Estonia has run national health and judicial
  records on hash-linked timestamping for over a decade; it is called a blockchain and has
  no consensus and no coin.
- In THIS town, three of the four built systems do not use a blockchain: the school is a
  Merkle tree plus ECDSA signatures, the bank is Pedersen commitments with no chain at all,
  and the panchayat is a tamper-evident case log. Only the voting centre needs consensus,
  because candidates actively distrust each other and there is no operator all sides accept.
- The seven-question test a system must pass before a chain is worth it: more than one
  writer; those writers distrust each other; no third party they would all accept; someone
  must check it later who was not there; a quiet edit would be catastrophic; the throughput
  and irreversibility are survivable; no personal data sits on the record. Fail one and a
  database with an audit log wins on every axis.
- Never say a chain is a reason. Say it is a choice, name the alternative, state the cost.

WHAT THE TOWN IS
- A living isometric town (built on the open-source IsoCity engine, MIT licensed) where you
  click a building to open a civic system that genuinely runs in your browser.
- Nothing is a mockup, a video or a screenshot. Four systems are finished and working.

SYSTEM 1 — THE DIGITAL VOTING CENTRE
- A citizen's identity becomes an anonymous token: SHA-256 of their identity plus a national
  salt. The chain stores the token, never the person.
- The vote is sealed with real SHA-256 and mined with real proof-of-work: the browser
  searches for a nonce whose block hash starts with "000". You watch the nonce race.
- You can click any block and rewrite its vote. Every block from the break onward is then
  marked invalid, because each link is checked against what the previous block actually
  hashes to. Restoring puts the real votes back and re-mines.
- One person, one vote is enforced structurally: the electoral roll is checked against the
  chain before anyone reaches a ballot, and a citizen already in a block is refused.
- Honest caveat: this demonstrates the integrity layer. A real election also needs
  coercion-resistance, verified voter rolls and offline fallbacks.

SYSTEM 2 — THE AI PANCHAYAT KENDRA
- A villager states a problem in plain language. You can speak it with the microphone in
  English, Hindi, Punjabi, Telugu, Tamil, Bengali or Marathi.
- A multinomial Naive Bayes classifier, trained in your browser at page load on a visible
  120-line corpus, reads it. Measured accuracy: 92.5% leave-one-out across 10 case types,
  with all 9 of its mistakes falling below the auto-route confidence gate.
- A tokenizer collapses Devanagari, Hinglish and English into one feature space.
- Eligibility rules are evaluated against the citizen's actual record, and "unknown" is a
  real third outcome next to pass and fail.
- Five gates decide whether software may proceed alone: confidence, vocabulary, evidence,
  adverse finding, and policy. Disputes never auto-decide however confident the engine is.
- Each case decision is sealed with SHA-256, chained to the previous case.
- The language model, when awake, gives a second reading shown beside the classifier and
  rewrites the final verdict into the visitor's language. It never decides the case.

SYSTEM 3 — THE BANK OF BHARAT
- The question is not "can banking go on a chain" — the town already has two hash chains.
  It is what a regulator can compute over a bank's books without being shown any account.
- Every balance is sealed in a real Pedersen commitment over RFC 3526 MODP Group 14, a
  published 2048-bit safe prime.
- Solvency is proved by the homomorphic identity C(a)·C(b) = C(a+b): multiply all 26 account
  commitments and compare against the declared total. Hiding one rupee fails as loudly as
  hiding fifty lakh, and no account is ever opened to catch it.
- A depositor proves her balance is inside the audited Merkle root without learning anyone
  else's. Schnorr proofs of knowledge use Fiat-Shamir over SHA-256.
- Structuring, layering and a pass-through mule are found from the shape of the transaction
  graph and the clock, while every amount stays sealed. 152 of 163 transfers are never
  opened.
- Honest caveats stated on screen: the customers are synthetic from a fixed seed; Benford's
  law cannot run over sealed commitments so it runs on published figures; and hiding amounts
  while leaving the transaction graph visible is a real, unsolved tradeoff.

SYSTEM 4 — THE NATIONAL DIGITAL SCHOOL
- The problem: verifying an Indian degree means telephoning an institution that may not
  answer, so most employers never do — which is why forged marksheets work at all.
- A certificate is issued as eleven fields. Each field is salted and hashed into a leaf, the
  leaves build a Merkle tree, and the school signs only the root with a real ECDSA P-256 key
  generated in the browser through Web Crypto.
- The certificate's address is a genuine IPFS CIDv1 — raw codec, sha2-256, base32 — computed
  over the certificate bytes, so the address is the document.
- Selective disclosure is the point: a graduate can show three fields out of eleven and the
  verifier still checks them against the root the school signed. Marks she does not want read
  are never sent.
- Change any field and its Merkle proof stops matching the signed root — while the signature
  itself still verifies, because a forger never touched the root. That distinction is shown
  on screen.
- Revocation is a hash-chained register, so a revoked degree cannot be quietly un-revoked and
  an edit to the register is itself detectable.
- Verification is four checks — content address, signature, issuer, revocation — and takes a
  couple of milliseconds, offline, with no call to the university.
- Honest caveat: the cryptography is the easy half. Who is allowed to be an issuer, and how a
  lost signing key is rotated, is governance, and this prototype does not solve it.

HOW THE AI AND VOICE WORK
- Everything runs in the visitor's browser. No API keys, no accounts, no server. Anyone can
  fork the repo and get the whole experience.
- Speech recognition is the browser's own Web Speech API. Where a language pack is installed
  the audio never leaves the device; otherwise the browser sends it to its own speech
  service, and the interface says which one is happening.
- The model is Qwen2.5 (Apache-2.0) run through WebLLM over WebGPU. It is opt-in, states its
  download size, and is cached after the first download.
- Models under bespoke community licences (Llama, Gemma) were rejected because they would
  compromise the promise that a fork runs completely.

WHAT IS PLANNED, NOT BUILT
An AI safety command with audited camera access, a smart waste network, a mobility hub,
health and insurance, digital rights, and policy transparency.

THE TRADE-OFFS, WHICH THE PROJECT STATES RATHER THAN HIDES
- Immutability against the right to erasure (India's DPDP Act 2023). Nothing personal is
  ever on the record — every leaf is a salted hash and the salt lives with the holder, so
  destroying the salt makes the leaf unopenable. Honest residue: that is
  rendering-unreadable, not deleting, and regulators have not settled whether it counts.
- Immutability against honest mistakes. You cannot edit; you supersede, and only with the
  issuer plus a second independent authority signing, a reason from a closed list, a public
  lineage in both directions, and a challenge window for the holder. The error stays visible
  forever. That is the price.
- Key loss is identity loss. "Not your keys, not your coins" is a catastrophic default for a
  welfare state with shared handsets and citizens who cannot read. Recovery means guardians,
  which means trusting someone again. This town chooses recoverability over purity.
- Tamper-evidence is not truth. A chain proves nobody edited the record afterwards. It says
  nothing about whether it was true when written.
- The oracle problem. A chain cannot prove nobody put a fake bottle in a real box at the
  factory. It moves fraud upstream, it does not remove it.
- A permissioned chain run by one authority is a database with extra steps. It buys
  tamper-evidence, not trustlessness, and claiming otherwise is the commonest govtech lie.
- Smart contracts are law you cannot appeal. Code executes and has no discretion, which is
  why the panchayat's five gates could not be a smart contract: the adverse-finding gate
  requires judgement.
- Throughput. India runs billions of payment transactions a month; no chain does that. The
  honest architecture is anchoring — batch, hash, commit one Merkle root for millions of
  records.

WHAT IT MUST BE PAIRED WITH
Zero-knowledge proofs (prove eligibility without the attribute), AI in one direction only
(the model decides, the ledger records, never the reverse), hardware key custody and
threshold signing, offline-first design, and trusted hardware at the sensor. Never raw
biometrics — a fingerprint cannot be revoked.

OFFLINE-FIRST NOW, ONLINE-FIRST LATER
India today is an offline-first market and will become an online-first one. Every system
must work with no network and improve when one appears; none may require one. Verification
is always offline. Writes queue locally and anchor later. Revocation offline uses
short-lived status tokens the holder carries, so a verifier learns a bounded truth instead
of no truth.

HOW TO ANSWER
- Be brief: two to four sentences unless asked for more.
- Be concrete and use the real numbers above.
- If the answer is not in what you know, say so plainly and say what the town does cover.
  Never invent a feature, a number or a claim.
`.trim();

export interface FaqEntry {
  /** Lowercase keywords; a question matching two or more is answered from here. */
  keys: string[];
  question: string;
  answer: string;
}

/**
 * Hand-written answers to what people actually ask. Checked before the model, because on
 * these particular questions a curated paragraph beats a small model every time.
 */
export const FAQ: FaqEntry[] = [
  {
    keys: ['anonymous', 'anonymity', 'secret', 'who i voted', 'privacy', 'vote'],
    question: 'Is my vote really anonymous?',
    answer:
      'The chain never stores who you are. Your identity is hashed with a national salt into a one-way token — SHA-256, irreversible — and only that token goes into the block. Anyone can recount the election; nobody can read a name out of it. The honest limit: this proves the integrity layer, not coercion-resistance. Someone standing over you in the booth is a problem no chain solves.',
  },
  {
    keys: ['bribe', 'miner', 'mining', '51', 'attack', 'proof of work', 'hack'],
    question: 'What if someone bribes the miner?',
    answer:
      'Bribing one miner does not help, because mining does not decide what a vote says — it only seals what was already cast. To change a result you would have to rewrite a block and then re-mine every block after it faster than the rest of the network builds honest ones. You can try exactly this on the chain screen: edit a vote and watch every later block go invalid at once. In this prototype the difficulty is tiny so you can see it work; a real deployment would set it so that re-mining is astronomically expensive.',
  },
  {
    keys: ['blockchain', 'why chain', 'need a blockchain', 'database', 'everywhere'],
    question: 'Does all of this really need a blockchain?',
    answer:
      'Mostly no, and saying so is the argument. "Blockchain" bundles three things: tamper-evidence, which costs a hash function; decentralised consensus, which is expensive and really political; and trustless value transfer, which is crypto. Almost every civic system needs only the first. Three of the four built here do not use a blockchain at all — the school is a Merkle tree and signatures, the bank is commitments with no chain in it, the panchayat is a tamper-evident log. Only the voting centre earns consensus, because candidates genuinely distrust each other and there is no operator all sides would accept. Everywhere else, a database with an append-only audit log would win on speed, cost, energy and legal exposure.',
  },
  {
    keys: ['real', 'fake', 'mockup', 'actually work', 'pre-recorded', 'simulated'],
    question: 'Is any of this actually real, or is it a mockup?',
    answer:
      'The mechanisms are real and run in your browser: genuine SHA-256, genuine proof-of-work, a classifier trained on page load from a corpus you can read in the repo, and 2048-bit Pedersen commitments. What is synthetic is the data — the citizens, the votes and the bank customers are invented, generated from a fixed seed so every visitor sees the same town. Each system says on screen which parts are which.',
  },
  {
    keys: ['accuracy', 'accurate', 'classifier', 'naive bayes', 'wrong', 'confidence'],
    question: 'How accurate is the panchayat classifier?',
    answer:
      '92.5% leave-one-out across 10 case types on 120 examples — and you can re-run that validation yourself from the button in the sidebar. The number that matters more: all 9 of its mistakes fell below the confidence gate, so every one of them would have been handed to a human rather than auto-routed. Being wrong is fine; being wrong and confident is not.',
  },
  {
    keys: ['human', 'gate', 'review', 'approve', 'automatic'],
    question: 'When does a human have to decide?',
    answer:
      'Five gates, any one of which hands the case over: confidence below the threshold, too many words the model has never seen, an unresolved check that bears on the decision, an adverse finding (software may carry a claim forward, never record a refusal), and policy — disputes never auto-decide however confident the engine is. The interesting part of civic AI is not the answer, it is the gate.',
  },
  {
    keys: ['pedersen', 'commitment', 'homomorphic', 'solvency', 'audit', 'bank'],
    question: 'How can a regulator audit a bank without reading it?',
    answer:
      'Each balance is sealed in a Pedersen commitment. Those commitments add: multiply the commitments of two balances and you get a commitment to their sum. So the auditor multiplies all 26 accounts together and compares against a commitment to the total the bank declares. If they match, the declaration is true. No individual balance is ever revealed — and hiding a single rupee fails exactly as loudly as hiding fifty lakh. Try it with the "Hide ₹1" button.',
  },
  {
    keys: ['benford', 'law', 'first digit'],
    question: 'Why does Benford’s law not run on the sealed data?',
    answer:
      'Benford needs the magnitudes of numbers, and a commitment hides magnitude by construction — that is the whole point of it. So the Benford test runs on figures the bank publishes itself, not on the sealed ledger, and the screen says so rather than letting you assume otherwise. It is one of two limits stated openly; the other is that hiding amounts while leaving the transaction graph visible is a real, unsolved tradeoff.',
  },
  {
    keys: ['degree', 'certificate', 'marksheet', 'school', 'diploma', 'forge', 'merkle'],
    question: 'How can a degree prove itself without calling the university?',
    answer:
      'The school signs the certificate once, with a real ECDSA P-256 key, and what it signs is a Merkle root over eleven salted fields. Anyone can then verify four things offline in about two milliseconds: that the content address really is the hash of these bytes, that the signature is the school’s, that the issuer is recognised, and that the certificate is not in the revocation register. Change a single mark and its Merkle proof stops matching the root — while the signature still verifies, because the forger never touched the root.',
  },
  {
    keys: ['selective', 'disclosure', 'hide marks', 'privacy degree', 'show only'],
    question: 'How does a graduate show a degree without showing her marks?',
    answer:
      'Each field is its own leaf, so she sends the three fields an employer actually needs plus their Merkle proofs, and nothing else. The verifier recomputes the root from what he was given and checks it against the root the school signed. He learns her degree and her year; he never sees a mark. The honest caveat is that the hard part is not this — it is governance: who is allowed to be an issuer, and how a lost signing key is rotated.',
  },
  {
    keys: ['crypto', 'bitcoin', 'coin', 'token', 'cbdc', 'digital rupee'],
    question: 'Is this crypto?',
    answer:
      'No, and there is no coin anywhere in this town. Cryptocurrency is the loudest application of this technology, not the largest set of them — I will not put a percentage on that, because any number would be rhetoric I could not defend. India already runs a sovereign version that is nothing like crypto: the RBI began its wholesale digital rupee pilot on 1 November 2022 and the retail pilot a month later, legal tender with no speculation and no mining. Estonia has run national records on hash-linked timestamping for over a decade with no coin at all.',
  },
  {
    keys: ['trade-off', 'tradeoff', 'downside', 'cost', 'problem with', 'weakness', 'erasure', 'forget'],
    question: 'What does this design cost?',
    answer:
      'Every system here has a "what this costs you" panel next to what it can do, so the price is as visible as the capability. The big four: immutability fights the right to erasure, which we answer by keeping nothing personal on the record and letting a destroyed salt make a leaf unopenable — that is rendering-unreadable, not deleting, and regulators have not settled whether it counts. Honest mistakes cannot be edited, only superseded, and the error stays visible in the lineage forever. Losing your key loses your credential, and recovery means guardians, which means trusting somebody again. And tamper-evidence is not truth: a corrupt institution signing with a real key still produces a perfectly valid degree.',
  },
  {
    keys: ['smart contract', 'self-executing', 'code is law', 'automate the decision'],
    question: 'Why not put the decisions in smart contracts?',
    answer:
      'Because code executes and has no discretion, and civic decisions need some. A contract that auto-denies a pension because a field was blank is worse than a clerk, since there is nobody to argue with. Smart contracts belong on mechanical steps — release escrow when a signed delivery receipt arrives — and have no business on judgement steps. The panchayat is the proof: its five gates could not be a smart contract, because the adverse-finding gate exists precisely so software carries a claim forward but never records a refusal alone.',
  },
  {
    keys: ['offline', 'no network', 'no internet', 'village', 'connectivity'],
    question: 'What happens where there is no network?',
    answer:
      'Everything still works, because India today is an offline-first market even if it will become an online-first one. Verification never needs a network: checking a degree takes the certificate and a public key, and runs in about a millisecond with no request. Writes queue on the device with a signed "captured at" stamp and anchor later when a connection appears. Revocation is the genuinely hard one — you cannot query a live register offline — so the answer is short-lived status tokens the holder carries, letting a verifier learn "not revoked as of this date" instead of nothing at all.',
  },
  {
    keys: ['land', 'registry', 'property', 'title', 'records land'],
    question: 'Would this work for land records?',
    answer:
      'Partly, and the part it does not fix is the important one. A shared ledger between the registrar, the revenue department, the survey office and the municipality is a genuine multi-writer, low-trust case, so it passes the test and it would stop forged mutation entries and the same plot being sold twice. But Indian titles are presumptive rather than conclusive, and digitising a disputed or fraudulent title onto an immutable ledger just makes the fraud permanent and authoritative. The hard part is the first entry — adjudicating who actually owns the land — and that is courts and surveyors, not cryptography. So: the mutation log after adjudication, never a substitute for adjudication.',
  },
  {
    keys: ['microphone', 'speech', 'voice', 'recording', 'listening', 'audio'],
    question: 'Where does my voice go when I speak?',
    answer:
      'Nowhere we control — there is no server here at all. The browser does the recognition. If your device has a language pack installed, the audio is transcribed locally and never leaves the machine, and the badge next to the microphone says so. If it does not, the browser sends the audio to its own speech service to transcribe. That badge tells you which of the two is happening every time.',
  },
  {
    keys: ['model', 'llm', 'webllm', 'download', 'qwen', 'ai', 'gpu'],
    question: 'What is the AI, and why do I have to download it?',
    answer:
      'It is Qwen2.5, an Apache-2.0 open-weights model, running in your own browser on your graphics card through WebLLM. There is no API to call, so the weights have to be on your machine — 275 MB for the light version, 838 MB for the full one, downloaded once and cached. It is entirely optional: every decision in every system is made by deterministic engines that run without it.',
  },
  {
    keys: ['open source', 'licence', 'license', 'github', 'fork', 'code'],
    question: 'Is the code open?',
    answer:
      'Yes — it is public on GitHub, and the point of the design is that a fork runs completely. No API keys, no accounts, no paid service, no server you depend on. That constraint is why the AI runs in your browser and why models under bespoke community licences were rejected in favour of Apache-2.0 ones.',
  },
  {
    keys: ['who built', 'author', 'pawan', 'why exists', 'purpose', 'portfolio'],
    question: 'Who built this and why?',
    answer:
      'Pawan Chander built it as an argument, not a demo. It is his answer to "how should India’s civic systems work in 2047", made both aesthetically and technically — which is why every mechanism actually runs instead of being drawn. The "Why this exists" button in the town’s title bar has the full statement.',
  },
  {
    keys: ['next', 'roadmap', 'coming', 'planned', 'future', 'other buildings'],
    question: 'What is coming next?',
    answer:
      'Six more systems, one at a time and each built to the same bar: an AI safety command where every access to footage is itself logged, a smart waste network, a mobility hub, health and insurance claims that cannot silently vanish, digital rights, and policy transparency. The greyed-out buildings in the town are those.',
  },
];

/** Find a curated answer, requiring enough overlap that a stray word cannot trigger one. */
export function faqAnswer(question: string): FaqEntry | null {
  const q = question.toLowerCase();
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of FAQ) {
    const score = entry.keys.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  // One keyword is a coincidence; two is a question about that thing. A single very
  // specific keyword ("pedersen", "benford") is enough on its own.
  if (!best) return null;
  const specific = best.entry.keys.some((k) => k.length >= 7 && q.includes(k));
  return best.score >= 2 || specific ? best.entry : null;
}

export const SUGGESTED_QUESTIONS = [
  'Is my vote really anonymous?',
  'What if someone bribes the miner?',
  'How can a regulator audit a bank without reading it?',
  'When does a human have to decide?',
  'Where does my voice go when I speak?',
];
