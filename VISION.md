# THE VISION — Bharat 2047

> **This file defines the project. Read it before writing any code here.**
> Status: systems 1, 2 and 3 are built and live. Next system is chosen by Pawan,
> one at a time, in roughly the order below.

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

Nothing structural. The palette question is closed — see the amended design rule
above: Bharat 2047 keeps its own identity, and the bar it is held to is
exceptional craft rather than a colour match.

The standing work is the roadmap itself: systems 4 through 10, one at a time, each
built to the same bar the voting centre and the panchayat set.
