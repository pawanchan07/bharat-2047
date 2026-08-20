/**
 * Stands in for gt-next/config. withGTConfig wrapped the Next config to inject locale
 * plumbing and a request-time locale resolver. With one locale and a static export there is
 * nothing to inject, so it hands the config back untouched.
 */
const withGTConfig = (nextConfig = {}) => nextConfig;
module.exports = { withGTConfig };
module.exports.default = withGTConfig;
