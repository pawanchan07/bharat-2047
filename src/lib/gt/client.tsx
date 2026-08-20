'use client';

/**
 * gt-next splits its API across 'gt-next' and 'gt-next/client'. The shim does not need the
 * split, but the alias has to answer both paths, so this re-exports the same module.
 */
export * from './index';
