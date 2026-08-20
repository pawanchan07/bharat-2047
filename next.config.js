
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,

  /*
   * Static export. Everything here runs in the browser once loaded, so Cloudflare serves
   * the built HTML from Workers assets and nothing renders per request.
   */
  output: 'export',

  /*
   * The optimiser is a server. Without one, next/image has to be told to emit plain <img>
   * tags rather than /_next/image URLs that nothing will answer.
   */
  images: { unoptimized: true },

  /*
   * gt-next is replaced by a local shim. It is a server library: its provider reads request
   * headers, which forces per-request rendering and blocks static export entirely. The shim
   * keeps the same API so all 121 call sites are untouched and the UI is identical; what it
   * drops is the translation lookup, leaving the English already in the source.
   */
  turbopack: {
    resolveAlias: {
      'gt-next': './src/lib/gt/index.tsx',
      'gt-next/client': './src/lib/gt/client.tsx',
    },
  },
  webpack: (config) => {
    config.resolve.alias['gt-next/client'] = require('path').resolve(__dirname, 'src/lib/gt/client.tsx');
    config.resolve.alias['gt-next'] = require('path').resolve(__dirname, 'src/lib/gt/index.tsx');
    return config;
  },

  /*
   * There is deliberately no redirects(), rewrites() or headers() here. Static export drops
   * all three silently. The root rewrite that sends bharat.pawanchander.com to /india and
   * iso-coaster.com to /coaster now lives in each Worker's entry script, and the asset cache
   * headers live in public/_headers, which Cloudflare Workers assets reads.
   */

  /*
   * Vercel fingerprints /_next/static, but files under public/ are served with a
   * revalidate-every-time default, so a returning visitor pays a round trip per sprite
   * sheet before it can draw anything. These are stable art files, so cache them properly.
   *
   * Not `immutable`, and not a year: these paths are not content-hashed, so an edit to a
   * sheet has to be able to reach people who already have it. A month with a week of
   * stale-while-revalidate gets the repeat-visit win without that trap. The town layout
   * changes more often, so it gets an hour.
   */
};

module.exports = nextConfig;
