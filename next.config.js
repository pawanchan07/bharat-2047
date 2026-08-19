const { withGTConfig } = require("gt-next/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,

  /*
   * This deployment exists to show Bharat 2047, so the bare domain has to land on the
   * town rather than on the IsoCity city-builder we are built on. Someone arriving at
   * bharat.pawanchander.com should see the prototype, not a generic game.
   *
   * The original IsoCity game is not deleted — it is still at /game, and still at / in
   * local development if you comment this block out.
   */
  async redirects() {
    return [{ source: '/', destination: '/india', permanent: false }];
  },
  async rewrites() {
    return [{ source: '/game', destination: '/' }];
  },

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
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }],
      },
      {
        source: '/example-states/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
      },
      {
        source: '/apple-touch-icon.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
      /*
       * /india renders on demand because the root layout resolves a locale from the request
       * headers. The document itself is the same for everyone in a locale, so let the CDN
       * hold it briefly and serve it stale while it refreshes — the visitor stops paying for
       * a cold render before the town can even start loading.
       */
      {
        source: '/india',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400' }],
      },
    ];
  },
};

module.exports = withGTConfig(nextConfig);
