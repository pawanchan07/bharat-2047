/**
 * The single path the static export builds each co-op shell under.
 *
 * This lives in its own module with no 'use client' directive on purpose. A server
 * component that imports a value from a client module gets a client reference proxy rather
 * than the value, which makes `generateStaticParams` receive a function where it wanted a
 * string. Both sides can import a plain constant safely.
 *
 * Room codes are invented at runtime by whoever starts a game, so there is no list of them
 * to hand the export at build time. One shell is built, and each Worker rewrites every
 * `/coop/<code>` onto it while the code stays in the address bar.
 */
export const ROOM_SHELL = 'room';
