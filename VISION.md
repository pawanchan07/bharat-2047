# THE VISION — Bharat 2047

> **This file defines the project. Read it before writing any code here.**
> Status: systems 1, 2, 3 and 4 are built and live. Next system is chosen by Pawan,
> one at a time, in roughly the order below.
>
> **This is the flagship.** Of everything I have built, Bharat 2047 is the project
> I want judged first — see [Positioning](#positioning-this-is-the-flagship).

This project is NOT a demo with two or three screens. It is a complete,
explorable answer to one question: "How should one town in future India
actually work?" Every civic system a citizen touches in their life should
eventually be in this town, clickable, and ACTUALLY WORKING — not mockups,
not slides, not videos. The voting centre set the standard: real SHA-256,
real proof-of-work mining, a tamper attack you can genuinely perform. Every
system we add must meet that same bar of realness in the browser.

## The full scope (we go deep on ONE at a time, in roughly this order)
1. ✅ Blockchain voting — DONE (Digital Voting Centre)
2. ✅ AI Panchayat Kendra — DONE. Villager states any problem in plain language
   ("pension nahi aa rahi 3 mahine se") → AI understands, extracts entities,
   matches government schemes, files and routes the request, human panchayat
   member approves, citizen tracks resolution. This is also the town's
   COMPLAINT SYSTEM — any grievance about any department enters here.
3. ✅ Bank of Bharat — DONE. New-age banking: every transaction on an auditable
   blockchain ledger, stricter rules enforced by mathematics, regulators see
   the books in real time, no hidden loans, instant fraud visibility.
4. Education — school grades, marksheets and degrees on decentralized
   storage; any employer verifies a certificate in seconds; impossible to forge.
5. Crime prevention & police station — AI CCTV network: detects incidents,
   classifies severity, dispatches nearest responder, AND every access to
   footage is logged on an audit chain (privacy safeguards are part of the
   demo, not a footnote).
6. Smart waste network — bins report fill levels, AI predicts overflow,
   trucks dispatched on optimized routes; thermal/life-detection sensors
   trigger instant emergency alerts (e.g., abandoned infant).
7. Smart mobility hub — live-tracked buses/trains, demand-responsive routes,
   one QR ticket for everything.
8. Health & insurance — AI triage, patient-owned records, insurance claims
   settled transparently on-chain (no claim can silently vanish).
9. Internet & digital rights — how public internet, digital identity and
   citizen data rights work in this town.
10. Policy transparency — how a town policy/budget is proposed, debated,
    voted, published and tracked — visible to every citizen.

...and beyond: anything a citizen touches. The town grows until the answer
to "how should X work in India?" is "click the building and see."

## The interaction pattern (apply to EVERY system)

WORLD (the town) → click building → SERVICE (what it does for a citizen)
→ follow a person → WORKFLOW (step-by-step animated journey) → zoom deeper
→ TECHNOLOGY (the real engine visibly working: hashes, parsing, routing)
→ WHY IT MATTERS (plain-language sidebar, honest caveats included).

The voting centre implements this pattern — study it before building anything.

## Inspirations that define the feel

- IsoCity (our base engine): living isometric town, game-like, approachable
- Bruno Simon's portfolio: exploration itself is the joy — discover by wandering
- Anders Brownworth's blockchain demo: credibility through REAL computation
- MIT CityScope: change something → the system visibly responds → consequences
- Minecraft: blocky, playful, colorful — a world, not a website

## Design rules

- Keep the game-like isometric world aesthetic — playful, warm, alive.
  It should feel a bit like Minecraft/SimCity, never like a corporate site.
- **Design quality is non-negotiable. Palette match with my website is not.**
  *(Amended 2026-08-19 by Pawan, superseding the original rule below.)*
  This prototype may carry its own colours and its own identity — it does not
  have to borrow pawanchander.com's palette to be correct. What it may never do
  is look or read as anything less than exceptional. Visual craft and the
  quality of the information on screen are both held to the highest bar,
  everywhere, with no exceptions. I am an aspiring AI product manager with a
  love for exceptional design; this prototype is the proof of both, so nothing
  in it ships half-finished, ugly, or vague.
  <sub>Original rule, kept for the record: "harmonize the UI layer (panels,
  overlays, buttons, typography, background tones) with the design language of
  my personal website — borrow its colors, background shades and small details
  so Bharat 2047 feels like it belongs to my site when embedded."</sub>
- Different citizens (names, ages, villages) walk each journey — it's about
  people, not features.
- Every system gets an "honest caveat" box: what this prototype proves and
  what a real deployment would still need. Honesty is part of the design.
- **State the intent, everywhere.** This is not a neutral tech demo. It is my
  answer to "how should India work in 2047" — argued both aesthetically and
  technically. Every system must make that point of view visible and legible,
  not bury it. A visitor should never have to guess why this exists.

## Working rules

- One system at a time, maximum depth. Do not add shallow placeholders for
  three systems when one deep system is possible.
- "Actually working" means the core mechanism runs client-side in the
  browser with no API keys (like the voting centre and the panchayat engine).
- Any open-source library, dataset or technique may be pulled in to make a
  system genuinely work. Using someone else's good open-source work is
  encouraged; faking a mechanism is not. Credit whatever we use.
- This repo is public. It is read as much as it is used, so the explanation is
  part of the deliverable: the README, the code comments and the on-screen copy
  all have to be accurate enough that a stranger can check our claims.
- After each system is finished and I approve it, we pick the next one.
- Never break previously finished systems; test the whole /india flow after
  every change.

---

# The 2026-08-20 upgrade

*Everything below was added by Pawan on 2026-08-20. Where it conflicts with
anything above, this wins.*

## Positioning: this is the flagship

Bharat 2047 is my **standout project**. On pawanchander.com it is featured
**first** in the projects/prototypes list. Every decision inside this repo is held
to flagship quality, which is a higher bar than "good".

**Amended 2026-08-20:** first *position* is the whole of it. The site does not
label it the flagship or give it a bigger card than the others — that was tried and
Pawan called it back. The work should read as the strongest thing in the list
because of what it is, not because of a chip that says so.

If a change would be acceptable in an ordinary side project but not in the one
piece of work I most want to be judged on, it does not ship.

## The open principle: no keys, ever

This repo is public and it must stay **completely runnable by anyone who forks
it**. No API keys, no paid services, no accounts, no server the visitor depends
on. A stranger clones it, runs `npm install && npm run dev`, and gets the *entire*
experience — including every AI and voice feature. There is no degraded
"open-source edition".

This is not only an ethics position, it is the technical constraint that shapes
the architecture: **all intelligence runs client-side, in the visitor's own
browser, on open technology.**

- **Speech to text** — the Web Speech API (`webkitSpeechRecognition`), with a
  language picker: English, Hindi, Punjabi, Telugu, Tamil, Bengali, Marathi
  (`en-IN`, `hi-IN`, `pa-IN`, `te-IN`, `ta-IN`, `bn-IN`, `mr-IN`). Browsers
  without it get a designed message, never a dead button.
- **Text to speech** — `window.speechSynthesis`, choosing a voice that matches the
  chosen language when the device has one.
- **The LLM brain** — [WebLLM](https://github.com/mlc-ai/web-llm) running an
  **Apache- or MIT-licensed** instruct model in-browser over WebGPU. A model under
  a bespoke community licence (Llama, Gemma) is not acceptable here however good
  it is: it would compromise the fork-and-run promise.
- **Opt-in, never automatic.** The model appears behind an
  **"Awaken the town's AI 🧠"** button that states the download size up front,
  streams with a real progress bar, can be cancelled, and caches so it is never
  downloaded twice. WebGPU is feature-detected.

### The fallback chain is part of the design

**WebLLM → deterministic engine → typed input.** Every feature has all three
rungs, and the site stays *fully usable with zero downloads on any device*. A
visitor on an old Android phone with no WebGPU and no microphone must still get
the complete argument — they simply get it by typing.

This has a consequence worth stating plainly, because it is the honest version of
"AI-powered": **the deterministic engines remain the decision-makers.** The
Naive Bayes classifier, the eligibility rules and the five routing gates decide
what happens to a citizen's case; they are auditable and they are the project's
actual claim. The language model is used where the README already said a model
could safely be used — the layer where being wrong is not consequential:
understanding as a *second opinion shown beside the engine*, and putting the
engine's verdict into natural spoken language. When the two disagree, the screen
shows the disagreement and the engine wins.

## What is being built on top of this

1. **The talking AI Panchayat** — the crown jewel. The visitor *is* the villager:
   they press a mic and speak their problem in their own language
   ("meri pension teen mahine ton nahi aayi"), and the pipeline runs
   speech → text → understanding → scheme match → complaint filed and routed →
   and the answer is **shown and spoken back** in that same language. The point it
   exists to prove: *a citizen who cannot read or type can still be fully heard by
   the system.* The pipeline is visible — heard text, parsed intent, matched
   scheme — the way the voting centre shows its hashing.
2. **"Ask the town anything"** — a floating guide. Any question, any supported
   language ("is my vote really anonymous?", "what if someone bribes the miner?"),
   answered by the in-browser model grounded in a system prompt compiled from this
   file plus how each built system actually works. It says when it does not know.
   Falls back to a curated FAQ engine.
3. **The narrated guided tour** — a "Take the tour" mode: the camera flies from
   landmark to landmark while the town narrates the Bharat 2047 story in the
   chosen language. Skippable, and subtitled — the subtitles double as the
   fallback when no voice is available.

## Performance guardrails (non-negotiable)

- **The first load must never get slower than it is today.** No new feature may
  add weight to it. The measured baseline on 2026-08-20 is **609 KB**
  (596 KB JS + 13 KB CSS, brotli, 14 files) for `/india`.
- **Everything new is lazy.** WebLLM, voice and tour code load through dynamic
  `import()`, fetched only when the visitor activates that feature. The main
  bundle is measured before and after every change and **both numbers are
  reported**. If it grew, that is fixed before shipping.
- The model download states its size up front, streams with a progress bar, is
  cancellable, and is cached so it never downloads twice.
- Every change is tested on a simulated slow-4G connection and the load time
  reported.

## How we work now

Established 2026-08-20 and used for every item from here on:

1. **Reason first.** Before writing code, a short written plan: the technical
   choices and *why*, the risky parts, and my own additional ideas ranked by
   impact against effort.
2. **Pawan approves the extra ideas.** The named items get built; anything I
   invented waits for a yes.
3. **Then build**, to the flagship bar — no half-features. Every state
   (permission denied, no WebGPU, no voice installed, model still downloading,
   model cancelled) gets a designed, polished experience, not an error string.
4. **Test the whole /india flow**, commit cleanly, push, redeploy, and report the
   URLs, what changed, and the before/after numbers.

---

# The blockchain doctrine

Added 2026-08-20, after Pawan pushed back on the narration rather than the
engineering. The systems are right. What the town *said* about them was lazy, and a
visitor could reasonably walk out thinking this project believes a chain is the
answer to everything. It does not. This section is the answer, and every screen in
the town is narrated to match it.

## The bundle nobody unpacks

"Blockchain" ships three separate properties as one package, and almost no use case
needs all three:

1. **Tamper-evidence** — hash chains and Merkle trees. Proves nobody quietly edited
   the record after it was written. Needs no consensus, no network, no token, no
   miners. Cheap, and available to anyone with SHA-256.
2. **Decentralised consensus** — agreement on who may append, among parties who
   distrust each other. Expensive, slow, and fundamentally a political question
   rather than a cryptographic one.
3. **Trustless value transfer** — both of the above plus an asset. This is crypto.

Estonia has run national health and judicial records on hash-linked timestamping
for over a decade. It is universally called "Estonia's blockchain". It has no
consensus and no coin. It only ever claimed property 1, and that is why it works.

**Most civic systems need only property 1.** This town is the demonstration:

| System | What it actually uses | Does it need a chain? |
| --- | --- | --- |
| National Digital School | Merkle tree, ECDSA signatures, hash-chained revocation register | **No.** No consensus, no network, no peers. Verification runs fully offline. |
| Bank of Bharat | Pedersen commitments, Merkle root, Schnorr proofs | **No.** There is no chain in it at all. |
| AI Panchayat Kendra | SHA-256 case decisions chained to the previous case | **No.** A tamper-evident log, not a blockchain. |
| Digital Voting Centre | Hash chain, proof-of-work, public verification | **Yes.** Candidates actively distrust each other and there is no operator all sides would accept. This is the one case that earns it. |

Three of the four civic systems in a project people read as "the blockchain town"
do not use a blockchain. Saying that out loud is more credible than any feature we
could add.

## The test a system must pass

A chain earns its cost only when **all** of these hold:

1. More than one party writes to the record.
2. Those parties do not trust each other.
3. There is no third party all of them would accept as the operator.
4. Someone must be able to check the record later who was not present when it was
   written.
5. A quiet edit would be catastrophic.
6. The throughput and the irreversibility are survivable.
7. No personal data needs to sit on the record itself.

Fail any one and a database with an append-only audit log beats it on every axis:
speed, cost, energy, correctability, and legal exposure.

## Where it genuinely earns its place

**Money and trade.** Cross-border settlement in minutes rather than days. The
honest narrowing: the chain leg is fast, and the fiat on- and off-ramps are the
slow, expensive, regulated part. UPI already settles domestically in seconds with
no chain at all. The claim worth making is about *multi-party, multi-jurisdiction*
settlement, not about payments in general.

**Supply chain.** A shared record between a factory, three logistics firms, a
customs authority and a retailer — genuine multi-writer, genuine low trust, no
acceptable single operator. Passes 1 through 6. Fails hard on the oracle problem
(below), which is why Maersk and IBM shut TradeLens down in 2023.

**Digital identity and credentials.** Prove a fact about yourself without handing
over the document that contains it. This is the school, and it is the strongest
civic case because the tamper-evidence is the whole product and the consensus is
unnecessary.

**Land registry.** The canonical Indian case, and worth arguing carefully because
several states are already piloting it. Indian titles are *presumptive*, not
conclusive: registration records a transaction, it does not guarantee ownership.
The failures are forged mutation entries, the same plot sold twice, and benami
holdings. A shared ledger between the registrar, the revenue department, the survey
office and the municipality is a real multi-writer low-trust case and it passes the
test. **But it fixes the mutation log, not the title.** Digitising a disputed or
fraudulent title onto an immutable ledger makes the fraud permanent and
authoritative. The hard part is the first entry — adjudicating who actually owns the
land — and that is courts and surveyors, not cryptography. India's land records
modernisation programme has been running since 2008 and the bottleneck was never the
database. Honest verdict: **the mutation log after adjudication, never as a
substitute for adjudication.**

## The trade-offs, and how this project answers each

### Legal and human

**Immutability against the right to erasure.** India's DPDP Act 2023 grants
erasure. A record that cannot forget is incompatible with personal data sitting on
it. The answer this town already implements: nothing personal is ever on the
record. Every leaf is a salted SHA-256 of one field, and the salt lives with the
holder. Destroy the salt and the leaf becomes an unopenable 256-bit string — the
tree still verifies structurally, and the content is gone beyond recovery. This is
why the school salts every field, and why its screen already says a leaf without a
salt would be brute-forceable.

*The residue, stated because it is real:* this is rendering-unreadable, not
deletion, and regulators have not settled whether that satisfies erasure. It only
holds if the salt had real entropy and was never backed up. It cannot un-publish
anything an observer already copied. And the *existence* of a record survives — you
can erase what a leaf said, never that a leaf was there.

**Immutability against honest mistakes.** Civic records have typos: a misspelled
name, a wrong date of birth, a legally changed name after marriage. A chain can only
append, never fix, so without a designed path every clerical error becomes permanent
and public. The answer is **governed supersession**, not editing. A certificate's
status is derived from an append-only register with three verbs: `issue`,
`supersede`, `revoke`. A supersession is valid only when all of these hold:

1. It is signed by the issuer **and** a second independent authority — a threshold,
   so no single clerk can rewrite history.
2. Its reason comes from a closed list: transcription error, legally evidenced name
   change, or an upheld grievance. Free text is not a reason.
3. The old record's entry points forward to the new one and the new points back. The
   lineage is public and permanent.
4. The holder is notified and has a challenge window before it takes effect.
5. Only the *presentation* layer follows the lineage to "current". The history is
   never removed.

*The residue:* you get a corrected record, not a clean one — the error stays visible
in the lineage forever. And who the second authority is remains governance, not
cryptography.

**Built, 2026-08-20.** All five rules are enforced in `school.ts` rather than described:
`appendSupersession` refuses a reason outside the closed list and refuses one signer
signing twice, the register carries both signatures over a payload binding the two
content addresses, and `statusOf` reads the lineage without ever rewriting it. The
challenge window is real and runs in front of you — twelve seconds on screen, weeks in
anything deployed — and the graduate holds a keypair bound to her certificate at issue,
so `appendContest` is a signature the register recognises rather than a button. Contesting
is itself append-only: the attempt and the refusal both stay on the record, because a right
to contest that leaves no trace is one nobody can later prove they exercised.

**Built, 2026-08-20.** All five rules are enforced in `school.ts` rather than described:
`appendSupersession` refuses a reason outside the closed list and refuses one signer
signing twice, the register carries both signatures over a payload binding the two
content addresses, and `statusOf` reads the lineage without ever rewriting it. The
challenge window is real and runs in front of you — twelve seconds on screen, weeks in
anything deployed — and the graduate holds a keypair bound to her certificate at issue,
so `appendContest` is a signature the register recognises rather than a button. Contesting
is itself append-only: the attempt and the refusal both stay on the record, because a right
to contest that leaves no trace is one nobody can later prove they exercised.

**Key loss is identity loss.** "Not your keys, not your coins" is a catastrophic
default for a welfare state: shared handsets, elderly citizens, people who cannot
read. Social recovery and guardian schemes fix it and reintroduce trusted parties —
the exact thing the chain was meant to remove. This trade-off cannot be engineered
away, only chosen deliberately. This town chooses recoverability over purity.

**Finality against consumer protection.** No chargebacks, no fraud reversal, no
court-ordered clawback. Irreversibility protects a dissident and strands a pensioner
who was scammed. A civic system needs a reversal path, which means an authority,
which means the ledger is not the last word.

### Technical

**Tamper-evidence is not truth.** The most oversold property by a distance. A chain
proves nobody edited the record after it was written. It says nothing about whether
it was true when written. The school states this on screen: a corrupt institution
signing with a real key produces a perfectly valid degree. Garbage in, permanently
and verifiably garbage.

**The oracle problem.** A chain only knows what it is told. It proves the record of a
shipment was not altered; it cannot prove nobody put a counterfeit bottle in a
genuine box at the factory. Blockchain moves fraud upstream to the point of capture.
It does not remove it, and the point of capture is where it is hardest.

**Throughput and anchoring.** India runs billions of payment transactions a month. No
chain does that, and none will. The only honest architecture is *anchoring*: batch,
hash, and commit a Merkle root periodically, so one on-chain write covers millions of
off-chain records. The school demonstrates this at document scale.

**Crypto-agility.** A degree signed in 2047 must still verify in 2097. ECDSA and
SHA-256 are not forever. Fifty-year civic records need algorithm identifiers,
signature suites that can be swapped, and a re-anchoring path designed in from the
first day. Almost nobody builds this, and for a project named for a date this is the
point.

**Small-n deanonymisation.** A public ledger plus a ward of four hundred leaks more
than it appears to. Hiding amounts while leaving the graph visible is the same
problem the bank already states openly.

### Political — the two that get dodged

**A permissioned chain is a database with extra steps.** If one authority runs the
validators, the middleman has not been removed; he has been made slower and harder
to audit while the marketing claims the opposite. Permissioned chains buy
tamper-evidence and multi-party write. They do not buy trustlessness, and saying
they do is the most common dishonesty in govtech.

**"Cuts out the middleman" usually means "swaps the middleman".** The bank leaves and
exchanges, wallet providers, validator operators and oracle vendors arrive — less
regulated, with less recourse, and often more concentrated than what they replaced.

**Smart contracts are law you cannot appeal.** Code executes; it has no discretion. A
contract that auto-denies a pension because a field was blank is worse than a clerk,
because there is nobody to argue with. This is the panchayat's argument in another
costume: the gate matters more than the answer. Smart contracts belong on
*mechanical* steps — release escrow when a signed delivery receipt arrives — and have
no business on *judgement* steps. Every serious "code is law" failure since The DAO
has needed a human override, which proves the rule rather than breaking it.

## Blockchain is not crypto

Cryptocurrency is the loudest application of this technology, not the largest set of
them. We do not quantify that with a percentage, because any figure would be rhetoric
we could not defend. We name real deployments instead:

- **The digital rupee (e₹).** The RBI launched its wholesale pilot on 1 November 2022
  and its retail pilot on 1 December 2022. A sovereign central bank digital currency —
  not a cryptocurrency, no speculation, no mining, legal tender.
- **Estonia's KSI.** Hash-linked timestamping across national health and judicial
  records for over a decade. No coin.
- **TradeLens.** Named deliberately *because it failed*. Maersk and IBM's flagship
  blockchain supply-chain platform shut down in 2023. Citing a dead project is more
  credible than a list of wins.

Claims about specific state-level land-record and certificate pilots stay off any
public screen until each one is individually sourced. Several were announced and
quietly dropped, and this project does not put a claim on a page it cannot defend.

## What it has to be paired with

A chain alone solves almost nothing. The pairings are the actual design:

- **Zero-knowledge proofs.** The pairing that makes ledgers compatible with privacy
  law: prove eligibility without the attribute — over eighteen without a date of
  birth, under an income threshold without an income. The bank's Pedersen commitments
  and the school's selective disclosure are the direct ancestors of this, and where
  the town goes next.
- **AI, in one direction only.** The chain is the audit substrate *for* the model:
  model version, inputs, and which gate fired, hashed and anchored, so anyone can
  later prove which model decided and that the log was not rewritten after the
  complaint arrived. **AI decides, the chain records. Never the reverse.** The
  panchayat already chains every case decision; this makes it the headline.
- **Cybersecurity, concretely.** Hardware security modules for issuer keys — a
  national signing key cannot live where this prototype's does. Threshold signatures
  so no single official can issue alone. A transparency log for the issuer registry
  itself, because "who is allowed to be a school" is a bigger attack surface than any
  certificate. Post-quantum migration paths.
- **Offline-first design.** Non-negotiable, and covered in its own rule below.
- **Trusted hardware at the sensor.** The only real answer to the oracle problem:
  attestation at the point of capture, or the chain launders bad data with a
  cryptographic guarantee attached.
- **Never with raw biometrics.** A fingerprint cannot be revoked. Biometrics never go
  on a ledger and never serve as the identifier — at most they locally unlock a key
  held on the citizen's own device.

## Offline-first now, online-first later

India today is an offline-first market and will become an online-first one. The
design rule follows from that and applies to every system in this town:

**Every system must work with no network, and get better when a network appears.
None may require one.**

1. **Verification is always offline.** Checking a degree, a claim or a receipt needs
   the artefact and a public key, nothing else. The school already does this in about
   a millisecond with no request.
2. **Writes queue locally and anchor later.** The device signs a "captured at" stamp
   so the local record stands on its own, and the anchor proves it existed by a given
   time once connectivity returns.
3. **Revocation is the hard one.** You cannot query a live register with no network.
   The answer is short-lived status tokens the holder carries — "not revoked as of
   this date, expires in thirty days" — so an offline verifier learns a bounded truth
   instead of no truth. The window length is a policy dial between freshness and
   reach.
4. **Nothing degrades to an error message.** A missing network changes what the system
   can *claim*, never whether it responds.

## What this means for the town's narration

The engineering stands. The narration changes:

1. Every system states what it actually uses and whether it needed a chain —
   including the three that say **no**.
2. Every system's honest-caveat box gains a **what this costs you** counterpart, so
   the trade-off is as visible as the capability.
3. The intent screen leads with the unbundling and the seven-question test rather
   than with the word "blockchain".
4. The panchayat shows what its five gates would look like as a smart contract: they
   could not exist, because the adverse-finding gate requires discretion.
5. The school states crypto-agility as a fifty-year design requirement, and carries
   the supersession rules above.
6. Nowhere in this project does the word "blockchain" appear as a reason. It appears
   as a choice, with the alternative named and the cost stated.

It is fine to say blockchain. It is not fine to say it alone.

---

## Where the built systems live

| System | Experience | Engine |
| --- | --- | --- |
| Digital Voting Centre | `src/components/india/VotingCentre.tsx` | `src/components/india/blockchain.ts` |
| AI Panchayat Kendra | `src/components/india/PanchayatKendra.tsx` | `src/components/india/panchayat.ts` |
| Bank of Bharat | `src/components/india/BankOfBharat.tsx` | `src/components/india/bank.ts` |
| National Digital School | `src/components/india/NationalDigitalSchool.tsx` | `src/components/india/school.ts` |

Landmarks, the dock and the explore mode are in
`src/components/india/FutureIndia.tsx`. A system goes live by flipping its
landmark's `status` to `'live'`, giving it a `cta`, and rendering its component.
Every journey opens on the shared drawn walk-up scene in
`src/components/india/ArrivalScene.tsx` — a citizen is always *seen* arriving.

## Outstanding against this vision

The palette question is closed — see the amended design rule above: Bharat 2047
keeps its own identity, and the bar it is held to is exceptional craft rather than
a colour match.

The 2026-08-20 upgrade is built: the talking panchayat, the "ask the town anything"
guide, the narrated tour, and all five of the extra ideas — one shared cast of citizens
across the three systems, a town that visibly reacts to what you do, a saveable proof
card, the five named attacks as a scoreboard, and a citizen's day from dawn to dusk.

Bharat 2047 now leads the projects list on pawanchander.com, on an ordinary card that
happens to carry a real screenshot of the town and a link straight into the prototype,
plus its own action in the site's hero. It was briefly given a full-width card and a
"The flagship" chip; Pawan asked for that to come off, so first position is the only
distinction it gets. That was item 1 and it is done.

**System 4 — the National Digital School — is live** (2026-08-20). A certificate
signs its own Merkle root with a real ECDSA P-256 key, carries a real IPFS CIDv1,
and supports selective disclosure: four fields out of eleven, still verifying against
the root the school signed. Editing a field breaks its Merkle proof while the
signature keeps verifying, which is the distinction the screen is built to teach.
Revocation is a hash-chained register, so cancelling is itself tamper-evident.
19 assertions in `npm run verify-school` cover forgery, key substitution,
field-moving, salt guessing, selective disclosure and revocation.

It shipped inside the performance guardrail: `/india` first-load JS measured
**746.2 KB gzip before, 746.6 KB after** (2,402.9 KB → 2,403.9 KB uncompressed,
15 files, measured the same way on a production build both times). The entire
Education system rides in a lazy chunk fetched when you walk through the door.

Open work, in order:

1. The "does this need a blockchain?" tool is live inside the intent screen: the seven
   questions, answerable against the visitor's own case, with six loadable examples and a
   verdict that names the cheaper architecture that would beat a chain. It answers *no* for
   five of the six, which is the point of shipping it.
2. The rest of the roadmap: systems 5 through 10 — AI Safety Command, Smart Waste
   Network, Smart Mobility Hub, Smart Health Centre with insurance, digital rights
   and policy transparency — one at a time, each built to the bar the voting centre,
   the panchayat, the bank and the school set.
