/**
 * The IsoCoaster Worker.
 *
 * iso-coaster.com and bharat.pawanchander.com are the same export served two ways. This one
 * puts the theme park builder at the bare domain instead of the town, which used to be a
 * host check inside src/proxy.ts and cannot be middleware any more now that the site is
 * statically exported.
 *
 * Deep links keep working untouched: /coaster and everything under it is already at the
 * right path in the export, so only the root needs moving. A visitor typing iso-coaster.com
 * sees the park at the URL they typed, with no redirect to /coaster in the address bar.
 */

interface Env {
  ASSETS: Fetcher;
}

/** Where the bare domain should actually land. */
const ROOT = '/coaster';

/**
 * Co-op rooms are invented at runtime, so the export builds a single shell and every room
 * URL is served from it. The code stays in the address bar, which is where the page reads it.
 */
const ROOM_SHELL = 'room';
const COOP_BASE = '/coaster/coop/';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      return env.ASSETS.fetch(new Request(new URL(ROOT, url), request));
    }

    if (url.pathname.startsWith(COOP_BASE)) {
      const code = url.pathname.slice(COOP_BASE.length).replace(/[/]$/, '');
      if (code && code !== ROOM_SHELL) {
        return env.ASSETS.fetch(new Request(new URL(`${COOP_BASE}${ROOM_SHELL}`, url), request));
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
