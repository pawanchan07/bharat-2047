/**
 * The Bharat 2047 Worker.
 *
 * This exists for one reason: the bare domain has to land on the town rather than on the
 * IsoCity city-builder this project is built from. That used to be a Next.js redirect, and
 * before that a middleware host check in src/proxy.ts. Static export drops both, so the
 * rewrite happens here, at the edge, where it is now the only place it can happen.
 *
 * It is a rewrite rather than a redirect on purpose. A visitor arriving at
 * bharat.pawanchander.com sees the town at the URL they typed, with no bounce through
 * /india, which is what the old next.config redirect did and what the address bar should
 * keep showing.
 *
 * Everything that is not the bare root falls straight through to the static assets, so the
 * sprite sheets, the /india document and the rest are served by Cloudflare directly with no
 * script in the way.
 */

interface Env {
  ASSETS: Fetcher;
}

/** Where the bare domain should actually land. */
const ROOT = '/india';

/**
 * The original IsoCity game is not deleted. It is the exported `/` document, and this is
 * how you still reach it now that `/` belongs to the town.
 */
const GAME = '/game';

/**
 * Co-op rooms are invented at runtime, so the export builds one shell per co-op route and
 * every room URL is served from it. The room code stays in the address bar, which is where
 * the page reads it from.
 */
const ROOM_SHELL = 'room';
const COOP_ROUTES = ['/coaster/coop/', '/coop/'];

function coopShell(pathname: string): string | null {
  for (const base of COOP_ROUTES) {
    if (pathname.startsWith(base)) {
      const code = pathname.slice(base.length).replace(/[/]$/, '');
      if (code && code !== ROOM_SHELL) return `${base}${ROOM_SHELL}`;
    }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      return env.ASSETS.fetch(new Request(new URL(ROOT, url), request));
    }

    // /game is the city builder, which the export writes to the site root.
    if (url.pathname === GAME || url.pathname === `${GAME}/`) {
      return env.ASSETS.fetch(new Request(new URL('/', url), request));
    }

    const shell = coopShell(url.pathname);
    if (shell) return env.ASSETS.fetch(new Request(new URL(shell, url), request));

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
