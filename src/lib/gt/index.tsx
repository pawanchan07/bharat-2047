'use client';

/**
 * A local stand-in for gt-next.
 *
 * gt-next is a server library: its provider resolves a locale from request headers, which
 * forces every route to render per request and makes the app impossible to export
 * statically. The whole of IsoCity, the coaster and Bharat 2047 run in the browser, so
 * paying for a server just to pick a language string is the wrong trade.
 *
 * This keeps the exact same API instead of touching 121 call sites, so nothing in the UI
 * changes: `<T>` still wraps copy, `msg()` still tags strings, `useGT()` and `useMessages()`
 * still return functions you call the same way. What is gone is the translation lookup
 * itself, so every string renders as the English the source already contains.
 *
 * Restoring real translation later means swapping this module back out, not unpicking the
 * components, which is the reason it is shaped like this.
 */

import React from 'react';

/**
 * In gt-next these mark copy for extraction and swap in a translated string. With one
 * locale there is nothing to swap, so they render exactly what the source says.
 */
export function T({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

/** Marks a value that should not be translated. It was always passed through verbatim. */
export function Var({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * English pluralisation, which is the only locale this build has. gt-next supports the full
 * CLDR category set, so the other buckets are accepted and simply never selected here.
 */
export function Plural({
  n,
  one,
  other,
  zero,
  two,
  few,
  many,
}: {
  n: number;
  one?: React.ReactNode;
  other?: React.ReactNode;
  zero?: React.ReactNode;
  two?: React.ReactNode;
  few?: React.ReactNode;
  many?: React.ReactNode;
}) {
  if (n === 0 && zero !== undefined) return <>{zero}</>;
  if (n === 1 && one !== undefined) return <>{one}</>;
  if (n === 2 && two !== undefined) return <>{two}</>;
  void few;
  void many;
  return <>{other ?? null}</>;
}

/** A branch picked by name, used the same way as Plural. */
export function Branch({
  branch,
  children,
  ...branches
}: {
  branch?: string;
  children?: React.ReactNode;
  [key: string]: React.ReactNode | string | undefined;
}) {
  const picked = branch !== undefined ? branches[branch] : undefined;
  return <>{picked ?? children ?? null}</>;
}

/**
 * gt-next encodes a string here and decodes it in `useMessages`. With nothing to look up,
 * the round trip is the identity, so a `msg()` in a constant is already the final copy.
 */
export const msg = (text: string): string => text;
export const decodeMsg = (text: string): string => text;
export const decodeOptions = <T,>(value: T): T => value;

/** `const gt = useGT()` then `gt('Some copy')`. */
export function useGT() {
  return React.useCallback((text: string) => text, []);
}

/** `const m = useMessages()` then `m(someMsg)`. */
export function useMessages() {
  return React.useCallback((text: string) => text, []);
}

export function useTranslations() {
  return React.useCallback((text: string) => text, []);
}

export function useGTClass() {
  return null;
}

/** One locale, so these are constants rather than state. */
export const useLocale = () => 'en';
export const useDefaultLocale = () => 'en';
export const useLocales = () => ['en'];
export const useSetLocale = () => (_locale: string) => undefined;
export const useLocaleProperties = () => ({ code: 'en', name: 'English' });
export const useLocaleDirection = () => 'ltr' as const;
export const useRegion = () => undefined;

/**
 * The language picker. There is one language now, so it renders nothing rather than a
 * select with a single disabled option, which would read as broken.
 */
export function LocaleSelector() {
  return null;
}

export function RegionSelector() {
  return null;
}

/** Kept so the import in the layout stays valid; there is no context to provide. */
export function GTProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export const Num = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Currency = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const DateTime = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
