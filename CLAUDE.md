# CLAUDE.md

**Read [VISION.md](VISION.md) first — it defines this project.**

Everything about scope, the order systems get built in, the interaction pattern
every system must follow, the design rules and the working rules lives there.
Do not plan or write code for this repo before reading it.

## Quick orientation

- The prototype is at `/india`. The original IsoCity game is still at `/`.
- Build commands and code style: see [AGENTS.md](AGENTS.md).
- Environment notes: see [CLOUD.md](CLOUD.md).
- What is built, what is real in each system, and how to try it:
  see [README-BHARAT-2047.md](README-BHARAT-2047.md).

## The bar

"Actually working" means the core mechanism really runs, client-side, with no API
keys and nothing pre-recorded. Real SHA-256 in the voting centre; a classifier
really trained in the browser in the panchayat. If a layer is not real, the UI has
to say so out loud — see the "What's real in this demo?" panels.

After any change, walk the whole `/india` flow before calling it done.
