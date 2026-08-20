# Checkpoint

Where both projects stand, so a fresh session can pick up without re-deriving any of it.
Updated 2026-08-21.

Read [VISION.md](VISION.md) before doing anything in this repo. It governs.

---

## Live right now

| Domain | Worker | Serves | State |
| --- | --- | --- | --- |
| pawanchander.com | `portfolio-ai-pm` | the portfolio | live |
| www.pawanchander.com | redirect rule | 301 to apex, all paths | live |
| bharat.pawanchander.com | `bharat-2047` | `/india`, the town | live |
| iso-coaster.com | `iso-coaster` | `/coaster`, the park | **staged, waiting on nameservers** |

All on Cloudflare Workers as static exports. No Vercel anywhere in the path.
Push to `main` builds and deploys both repos automatically.

Cloudflare account `5cd40771d23dbe441caa5dd177022867`.
Zones: `pawanchander.com` (active), `iso-coaster.com` (pending), `steerly.in` (unrelated).

---

## The one step nobody but Pawan can do

`iso-coaster.com` is fully staged on Cloudflare: Worker deployed and verified, Vercel DNS
records deleted, Custom Domain bound, `www` CNAME added. The zone is still `pending`
because its nameservers are still Vercel's.

```
move from:  ns1.vercel-dns.com     ns2.vercel-dns.com
        to:  asa.ns.cloudflare.com  rustam.ns.cloudflare.com
```

Done wherever the domain is registered. If it was bought through Vercel, that is Vercel's
own dashboard. Then press **Done, check nameservers** on the Cloudflare zone. No downtime:
during propagation both nameserver sets serve the same site. Keep the Vercel project alive
until the zone reads `Active`, then delete it.

---

## Bharat 2047 roadmap

**Four of ten systems built.** The school was the most recent.

1. ✅ Digital Voting Centre
2. ✅ AI Panchayat Kendra
3. ✅ Bank of Bharat
4. ✅ National Digital School
5. 🗓️ AI Safety Command
6. 🗓️ Smart Waste Network
7. 🗓️ Smart Mobility Hub
8. 🗓️ Smart Health Centre with insurance
9. 🗓️ Internet and digital rights
10. 🗓️ Policy transparency

One at a time, each to the bar the first four set. VISION's process applies: reason first in
writing, wait for approval on anything extra, then build, test the whole `/india` flow,
commit, push, report.

Both verifier scripts pass and should keep passing: `npm run verify-school` (34 assertions),
`npm run verify-voting`.

---

## Things a fresh session would otherwise rediscover the hard way

**gt-next is replaced, not removed.** It is a server library: its provider reads request
headers, which forces per-request rendering and makes static export impossible. `src/lib/gt/`
implements the same API and `next.config.js` aliases `gt-next` to it. All 121 call sites are
untouched. Do not try to reinstate the real one without also giving up static export.

**Static export drops three things silently.** `redirects()`, `rewrites()` and `headers()`
are all ignored. The cache headers live in `public/_headers`; the root rewrites live in the
Workers under `worker/`. Adding any of the three back to `next.config.js` will look
configured and do nothing.

**Assets beat the Worker unless told otherwise.** `run_worker_first` in each wrangler config
lists the paths that must reach the script. Without it the root rewrite never fires.

**Co-op rooms use one exported shell.** `generateStaticParams` cannot live in a `'use client'`
file, so each `[roomCode]` page is a server wrapper around a client component that reads the
code from the address bar. `ROOM_SHELL` lives in its own non-client module because a server
component importing from a client module gets a reference proxy, not the value.

**Local DNS lies.** Pawan's router at `192.168.29.1` cached Vercel's address for hours after
the migration. Verify with `1.1.1.1` or `8.8.8.8`, or on mobile data, before believing a site
is down.

---

## Open, in priority order

1. **Delete the exposed Cloudflare API tokens.** Two were pasted into a chat transcript in
   plain text. Not yet deleted.
2. **iso-coaster.com nameservers** (above).
3. **Apex route to Custom Domain.** `pawanchander.com` is bound by a Worker route with a
   `192.0.2.1` placeholder A record, because the token at the time could not create a Custom
   Domain. Works fine; converting is tidier. Add the Custom Domain first, then remove the
   route, to avoid a gap.
4. **System 5.** Pawan picks which.

## Known cosmetic issues, deliberately not fixed

- `/coop/<code>` has `<title>ISOCITY - Join co-op ROOM</title>`. The tab title carries the
  shell placeholder; the page body reads the real code and works.
- `LocaleSelector` renders nothing rather than a select with one option.
- The portfolio contact form opens the visitor's mail client rather than sending. It
  previously validated, logged to a server console and discarded the message while telling
  the sender it had been received. A real endpoint would be an improvement.
