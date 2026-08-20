# 🇮🇳 Bharat 2047 — Future India Prototype

> **Read [VISION.md](VISION.md) first — it defines this project.**

An explorable, living isometric town showing how future India's civic systems
could work. Four of them are fully built and running for real in the browser:

- a **blockchain voting centre** — real SHA-256 hashing, real proof-of-work
  mining, live tamper detection;
- an **AI Panchayat Kendra** — a grievance desk whose classifier is *trained in
  your browser when the screen opens*, with a rules engine that really checks the
  citizen's record and five gates that decide when software must hand over to a
  human;
- a **Bank of Bharat** — a confidential ledger a regulator can audit *without
  being allowed to read it*: real 2048-bit Pedersen commitments, a solvency proof
  that is pure homomorphic arithmetic and catches a one-rupee lie, and fraud
  detectors that find structuring and layering while every amount stays sealed;
- a **National Digital School** — a degree that proves itself: a real ECDSA P-256
  signature over a Merkle root, a real IPFS content address, and selective
  disclosure that lets a graduate prove she holds the degree while showing three
  fields out of eleven.

No API keys, no network calls, nothing pre-recorded.

## Three of these four do not use a blockchain

This project gets read as "the blockchain town". It is worth being blunt about what
that actually means, because the word bundles three separate properties that people
buy as a package and almost never all need:

- **Tamper-evidence** — a hash chain or a Merkle tree. Proves nobody quietly edited
  the record after it was written. Costs a hash function. No network, no consensus,
  no token.
- **Decentralised consensus** — agreement on who may append, among parties who
  distrust each other. Expensive, slow, and fundamentally a political question.
- **Trustless value transfer** — both of the above plus an asset. This is crypto.

Almost every civic system needs only the first. Estonia has run national health and
judicial records on hash-linked timestamping for over a decade; it is universally
called a blockchain, and it has no consensus and no coin.

| System | What it actually uses | Needs a chain? |
| --- | --- | --- |
| National Digital School | Merkle tree, ECDSA P-256, hash-chained revocation register | **No** |
| Bank of Bharat | Pedersen commitments, Merkle root, Schnorr proofs | **No** — there is no chain in it at all |
| AI Panchayat Kendra | SHA-256 case decisions chained to the previous case | **No** — a tamper-evident log |
| Digital Voting Centre | Hash chain, proof-of-work, public verification | **Yes** |

The voting centre is the one case that earns it: candidates actively distrust each
other and there is no operator all sides would accept, which is precisely what
consensus was invented for. Everywhere else a database with an append-only audit log
wins on speed, cost, energy, correctability and legal exposure.

**The test a system has to pass** before a chain is worth its cost — all seven, not
some: more than one party writes; those parties distrust each other; no third party
they would all accept; someone must check it later who was not there; a quiet edit
would be catastrophic; the throughput and irreversibility are survivable; no personal
data sits on the record itself.

You can run that test against your own case inside the town — open **Why this exists** and
answer the seven questions. It will usually tell you no, and name the cheaper architecture
that would beat a chain. Five of the six worked examples it ships with come back *no*.

Every system in the town now carries a **what this actually uses** card and a **what
this costs you** card next to what it can do, so the price is as visible as the
capability. The full reasoning — the trade-offs, how each one is answered, what
blockchain has to be paired with, and the offline-first rule — is in
[VISION.md](VISION.md) under *The blockchain doctrine*.

And it is not crypto. There is no coin anywhere in this repo. India already runs a
sovereign digital currency that is nothing like one: the RBI began its wholesale
digital rupee pilot on 1 November 2022 and the retail pilot a month later.

Built on the open-source [IsoCity](https://github.com/amilich/isometric-city)
engine (MIT license — kept in `LICENSE`).

---

## Run it on your machine

You need **Node.js 20 or newer** (https://nodejs.org).

```bash
# 1. open a terminal inside this folder, then:
npm install

# 2. start it:
npm run dev

# 3. open the prototype in your browser:
#    http://localhost:3000/india
```

That's it. First `npm install` takes a few minutes.

> `/` redirects to `/india`, because a visitor arriving at the bare domain should
> see the town, not the engine we built on. The original IsoCity city-builder game
> is still there, at http://localhost:3000/game (the roller-coaster mini-game was
> removed to keep this package small).

## What to try

1. Click **Explore the town** — drag to pan, scroll to zoom.
2. Click the **Digital Voting Centre** (the grand building in the middle,
   or use the dock at the bottom).
3. Press **Step inside — cast a vote** and follow a citizen through:
   identity scan → anonymous token → secret ballot → SHA-256 seal →
   real mining (watch the nonce race) → the block joins the chain.
4. On the chain screen, **click any block and change its vote** — watch the
   whole chain flag it as tampered, then restore the honest chain.
5. Vote as several citizens; try voting twice as the same person.

Then open the **AI Panchayat Kendra**:

6. Press **Step inside — bring a problem**. Kamla Devi's pension has stopped.
7. On the arrival screen, **edit what she says** — the box is a real input.
   Type Hindi, Hinglish or English; type nonsense. The classifier re-runs on
   whatever you type, and the confidence number moves with it.
8. Watch **Understand**: all ten case types scored, the words that decided it
   shown as log-odds against the runner-up, and every word the model has never
   seen listed in red.
9. Watch **Check record**: each eligibility rule really evaluated, with
   *unknown* as a genuine third outcome next to pass and fail.
10. **Human review** is the point of the whole thing. Kamla's case is stopped by
    the adverse-finding gate; the next villager's water complaint clears all five
    and the engine routes it alone. Try **Reclassify it** — the human's
    correction re-runs the checks and redrafts the application.
11. In the side panel, press **Run the validation** — it retrains the model 120
    times, leave-one-out, and reports both the accuracy and the number that
    matters more: how many of its mistakes the confidence gate caught.

### What is real in the Panchayat Kendra, and what is not

**Real:** the multinomial Naive Bayes classifier (trained at page load on the
120-line corpus in `panchayat.ts`, Laplace-smoothed, √n-normalised log scores
with a fitted temperature); the tokenizer that collapses Devanagari, Hinglish and
English into one feature space; the entity extractor; every eligibility rule; the
five routing gates; the leave-one-out evaluation; and the SHA-256 seal chaining
each case decision to the last.

**Not real:** the sentences the assistant speaks back to the villager. Those are
templated from the engine's output, not generated by a language model. In
production that is the one layer that would call a real model — and the only one
that safely could, because it is the only layer where being wrong is not
consequential. The UI says this on screen rather than hiding it.

Current measured numbers, reproducible from the button in the UI: **92.5%
leave-one-out accuracy** across 10 classes on 120 examples, with **9 of 9
misclassifications falling below the auto-route confidence gate**.

Then open the **Bank of Bharat**:

12. Press **Step inside — audit the bank**. Every balance is already sealed; the
    balance column shows dots because nobody, including you, can read it.
13. On **Prove solvency**, watch the audit multiply all 26 account commitments
    together and match the declared total. Then press **Hide ₹1**. A one-rupee lie
    fails exactly as loudly as a fifty-lakh one, and no account was opened to catch it.
14. **My account** — a named depositor proves her balance is inside the audited
    root with a Merkle proof, learning nothing about the other 25.
15. **Exposure** — sector concentration computed from homomorphic sums. The
    regulator opens the aggregate, never a member.
16. **Patterns** — structuring, layering and a pass-through mule, all found from
    the shape of the graph and the clock while every amount is still sealed.
17. **Disclosure** — compel openings for one flag. Every opened amount lands just
    under the ₹10 lakh reporting threshold, and each verifies against the
    commitment published before anyone was looking. 152 of 163 transfers were
    never opened; that ratio is the whole argument.

### What is real in the Bank of Bharat, and what is not

**Real:** Pedersen commitments over RFC 3526 MODP Group 14 (a published 2048-bit
safe prime); the homomorphic identity C(a)·C(b) = C(a+b) that the entire solvency
proof rests on; Schnorr proofs of knowledge (Fiat–Shamir over SHA-256); the Merkle
tree and inclusion proofs; the graph and timing detectors; the Benford χ² test; and
the verification that each compelled opening matches its original commitment.

**Not real:** the customers and their transactions are synthetic, generated from a
fixed seed so every visitor audits the same bank. Three fraud patterns are planted
in it deliberately so the detectors have something true to find.

**Worth knowing:** Benford's law needs magnitudes, so it *cannot* run over sealed
commitments — it runs on figures the bank publishes itself, and the UI says so
rather than letting you assume otherwise. The design also hides amounts but not the
transaction graph; hide the graph too and every detector goes blind. That tradeoff
is real, unsolved, and stated on screen.

Then open the **National Digital School**:

18. Press **Step inside — verify a degree**, then **Issue her certificate**. Eleven
    fields are each salted and hashed into their own leaf; the leaves build a Merkle
    tree; the school signs *the root*, not the document. The certificate's address is
    a genuine IPFS CIDv1 — base32 over a raw codec plus a sha2-256 multihash.
19. **Verify** runs four checks in about a millisecond, offline: content address,
    signature, issuer key, revocation. No call to the university.
20. **Forge it** — rewrite any mark. Watch *which* check fails: the signature still
    verifies, because the forger never touched the root and could not produce a new
    one. What catches it is the Merkle proof.
21. **Show less** — hand an employer 4 fields out of 11. What is left off is genuinely
    not in what they receive; they hold a hash, not a hidden value, which is why the
    per-field salt is not decoration.
22. **Correct it** — the school got a roll number wrong, or she legally changed her name.
    You cannot edit a signed record, so it is *superseded*: a replacement is issued and the
    register records the supersession, signed by the school **and** an independent board,
    with a reason from a closed list. Try filing one with the school signing twice and watch
    it refused. Then watch the challenge window run down — twelve seconds here, weeks in
    anything real — and press contest before it closes to see the correction annulled with
    the graduate's own key. Nothing is ever removed: the attempt, the refusal and the
    original certificate all stay on the record.
23. **Revoke** — cancel the degree. Only the fourth check moves, because a signature
    is a statement about the past and the past did not change. Revocation is a
    liveness question and cryptography alone cannot answer it.

### What is real in the National Digital School, and what is not

**Real:** ECDSA P-256 keypairs generated in your browser through Web Crypto, and
signatures that really verify against the published key; salted SHA-256 leaves, the
Merkle tree, and inclusion proofs that any implementation would accept; the IPFS
CIDv1 (any IPFS tool would agree with the address); and a hash-chained revocation
register, so editing the register is itself detected.

**Not real:** the three students, their marks and the school's identity are invented,
and the school's signing key lives only for as long as the tab does.

**Worth knowing:** this proves a certificate is authentic and unaltered. It cannot
prove the school was *honest* when it issued one — a corrupt institution signing with
a real key still produces a perfectly valid degree. Who is allowed to be an issuer,
and how a lost signing key is rotated, is governance, and no amount of cryptography
moves it. What this does remove is the several million forgeries that are just
photocopies with a number changed.

Everything asserted above is checked by `npm run verify-school`, which runs 34 tests against
the same module the screen uses: forgery, key substitution, field-moving, salt guessing,
selective disclosure, revocation, and every rule that separates a correction from an edit —
a reason outside the closed list is refused, one signer signing twice is refused, the board's
key cannot be swapped after the fact, the original still verifies inside the challenge window
and stops being current after it, a contested supersession never takes effect, and editing a
contest entry is detected like any other tamper.

## Putting it on your website

Two good options:

**Option A — subdomain / separate deployment (recommended).**
Deploy this folder to Vercel, Netlify or any Node host and point a subdomain
at it (e.g. `future.yoursite.com`), or link to `/india` from your site.
On Vercel: import the folder as a project, no config needed.

**Option B — iframe embed.**
Deploy it anywhere as above, then embed on any page of your site:

```html
<iframe src="https://future.yoursite.com/india"
        style="width:100%;height:90vh;border:0;border-radius:12px"></iframe>
```

## Project map (what was added to IsoCity)

- `src/app/india/page.tsx` — the `/india` route; loads the fixed town
- `src/components/india/FutureIndia.tsx` — explore mode, landmarks, panels
- `src/components/india/VotingCentre.tsx` — the blockchain voting experience
- `src/components/india/blockchain.ts` — the real blockchain (SHA-256,
  proof-of-work mining, chain verification, tally)
- `src/components/india/PanchayatKendra.tsx` — the AI grievance desk experience
- `src/components/india/panchayat.ts` — the real engine behind it: training
  corpus, tokenizer, Naive Bayes classifier, entity extraction, scheme rules,
  root-cause diagnosis, the routing gates, leave-one-out evaluation, case ledger
- `src/components/india/BankOfBharat.tsx` — the confidential-ledger audit experience
- `src/components/india/bank.ts` — the real engine behind it: Pedersen commitments
  over RFC 3526 Group 14, homomorphic sums, Schnorr proofs, the Merkle tree, the
  synthetic bank, and the structuring / layering / pass-through / Benford detectors
- `src/components/india/ArrivalScene.tsx` — the drawn walk-up scene both journeys open on
- `src/components/india/WorldLabels.tsx` — the name plates floating over the buildings
- `src/components/india/BootScreen.tsx` — the loading screen, driven by real asset progress
- `src/components/india/Tricolour.tsx` — the flag, drawn (the emoji renders as “IN” on Windows)
- `scripts/generate_future_india.py` — regenerates the town layout
- `scripts/optimize-static-images.mjs` — shrinks the social cards and the touch icon
- `public/example-states/future_india.json` — the town itself

## Speaking to the town

You do not have to be able to read or type to be heard here.

Press the microphone in the **AI Panchayat Kendra** and say your problem out loud, in
English, Hindi, Punjabi, Telugu, Tamil, Bengali or Marathi. The transcript builds as you
speak, the same classifier reads it, and at the end the verdict is **said back to you** in
the same language. That is the gap the system exists to close: a receipt a villager cannot
read is not a receipt.

Two things the interface tells you rather than hiding:

- The badge beside the microphone says whether your device recognised the audio **locally**
  (a language pack is installed, and nothing left the machine) or handed it to **your
  browser's own speech service**. A project claiming "no keys" cannot let you assume the
  microphone is private.
- Where your device has no voice installed for a language, it says so, and the text carries
  the answer rather than a wrong-accented approximation of it.

### The optional brain

**Awaken the town's AI 🧠** downloads an open-weights model that runs entirely on your own
graphics card through [WebLLM](https://github.com/mlc-ai/web-llm) — no key, no account,
nothing sent anywhere. Two sizes, both **Qwen2.5, Apache-2.0**, measured from the MLC
repository rather than estimated:

| | download | good for |
| --- | --- | --- |
| Light — Qwen2.5-0.5B | **275 MB** | rephrasing the desk's verdict in your language |
| Full — Qwen2.5-1.5B | **838 MB** | noticeably better reasoning and Indian languages |

Llama 3.2 and Gemma 3 are better-known and were rejected anyway: their bespoke community
licences would break the promise that a fork of this repo runs completely.

**What the model is allowed to do is deliberately narrow.** The classifier, the eligibility
rules and the five routing gates still decide every case — they are auditable, their corpus
is in this repo, and their accuracy is measured. The model gives a *second reading shown
beside* the classifier, and puts the finished verdict into your language. When the two
disagree, you see the disagreement, the engine's call stands, and the human reviewer can
overrule either. It phrases the answer; it never reaches it.

It is opt-in, states its size up front, streams with a progress bar, can be cancelled
(keeping whatever already arrived), and is cached so it never downloads twice. Without
WebGPU you get a designed explanation and a page that still works completely.

### Three more ways in

- **Ask the town anything** — a guide in the corner. Thirteen questions have answers written
  by hand and those are used first, because on Pedersen commitments or proof-of-work a
  curated paragraph beats a 0.5B model. Anything else goes to the model, grounded in a brief
  compiled from `VISION.md`. Every answer says which one wrote it.
- **Take the tour** — six stops, the camera flying between landmarks while the town explains
  itself. Subtitles are the fallback rung, so they are always on screen.
- **A citizen's day** — follow one person from 06:10 to 21:00 through all four systems, with
  the light moving with her. The same six adults appear in the voting centre, the panchayat and the bank — the school has
  its own graduating class, one of them Kamla Devi’s granddaughter — and what they did
  in one is visible in the others.

**The town remembers.** Cast a vote, file a grievance or catch the bank in a lie and it is
recorded, marked over the place it happened, and collected in a panel with the six named attacks
this town invites you to try — and a proof card you can save.

## Notes on speed

Every one of the features above is loaded only when you use it. Measured first-load
JavaScript for `/india`: **2,515 KB before this work, 2,402 KB after** — it got *smaller*,
because the civic systems became dynamic imports at the same time. The WebLLM runtime
(5.9 MB) and the model weights are fetched only when you press the button.

The town is fixed, so `/india` only waits on the sprite sheets it actually uses — the
main sheet, water, parks, shops, stations and the two services sheets. Measured on the
deployment, fetching that set with the cache bypassed: **2,510 KB in 1.1 s**, against
**7,196 KB in 5.6 s** for the fifteen sheets it used to pull before anything could be
drawn. Construction, abandoned, high-density, farm, mansion and aircraft sheets are
fetched afterwards, at idle.

The loading bar counts those real downloads rather than animating on a timer, and the
world stops rendering entirely while the loader or a full-screen system is covering it.
`public/assets` is served with a month-long cache, so a second visit costs almost nothing.
Time to a fully painted town on the live site: **~3.2 s**, TTFB 40 ms.

## Roadmap (as designed)

- ✅ Digital Voting Centre — LIVE
- ✅ AI Panchayat Kendra — LIVE
- ✅ Bank of Bharat — LIVE
- ✅ National Digital School — LIVE
- 🗓️ AI safety command, smart waste, mobility hub, health and insurance,
  digital rights, policy transparency
