# THE VISION — Bharat 2047

> **This file defines the project. Read it before writing any code here.**
> Status: systems 1, 2 and 3 are built and live. Next system is chosen by Pawan,
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
**first** in the projects/prototypes list, and it carries the **strongest card and
preview of any project on the site** — not an equal among equals. Every decision
inside this repo is held to flagship quality, which is a higher bar than "good".

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

## Where the built systems live

| System | Experience | Engine |
| --- | --- | --- |
| Digital Voting Centre | `src/components/india/VotingCentre.tsx` | `src/components/india/blockchain.ts` |
| AI Panchayat Kendra | `src/components/india/PanchayatKendra.tsx` | `src/components/india/panchayat.ts` |
| Bank of Bharat | `src/components/india/BankOfBharat.tsx` | `src/components/india/bank.ts` |

Landmarks, the dock and the explore mode are in
`src/components/india/FutureIndia.tsx`. A system goes live by flipping its
landmark's `status` to `'live'`, giving it a `cta`, and rendering its component.
Every journey opens on the shared drawn walk-up scene in
`src/components/india/ArrivalScene.tsx` — a citizen is always *seen* arriving.

## Outstanding against this vision

The palette question is closed — see the amended design rule above: Bharat 2047
keeps its own identity, and the bar it is held to is exceptional craft rather than
a colour match.

Open work, in order:

1. The three items of the 2026-08-20 upgrade: the talking panchayat, the "ask the
   town anything" guide, and the narrated tour.
2. Featuring Bharat 2047 first on pawanchander.com, with the strongest card and
   preview on the site. That lives in the portfolio repo, not this one, but it is
   part of this project's definition of done.
3. The roadmap itself: systems 4 through 10, one at a time, each built to the bar
   the voting centre, the panchayat and the bank set.
