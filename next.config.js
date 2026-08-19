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
};

module.exports = withGTConfig(nextConfig);
