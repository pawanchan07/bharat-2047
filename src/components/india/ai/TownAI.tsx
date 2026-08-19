'use client';

/**
 * One place that holds the town's language and, if the visitor asked for it, its brain.
 *
 * Every AI or voice surface reads from here, so the language you pick at the microphone is
 * the language the tour narrates in and the language the guide answers in — and a model you
 * downloaded once is shared by all three rather than loaded per screen.
 *
 * The provider itself is tiny and safe to mount at page load. Nothing heavy is imported
 * until `awaken()` is called.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type * as WebLLM from '@mlc-ai/web-llm';
import { DEFAULT_LANGUAGE, languageFor } from './languages';
import {
  DEFAULT_MODEL_ID, LoadCancelled, MODELS, TownModel, isCached, loadEngine, modelById,
  onMeteredConnection, suggestedModelId, webGpuStatus,
} from './webllm';
import type { ChatMessage } from './webllm';

const LANG_KEY = 'bharat2047-language';
const MODEL_KEY = 'bharat2047-model';

export type BrainStatus =
  | 'asleep'        // never asked for
  | 'unsupported'   // no WebGPU on this device
  | 'downloading'
  | 'ready'
  | 'error';

export interface TownAIValue {
  /** BCP-47 code chosen by the visitor; drives recognition, voice and the model. */
  language: string;
  setLanguage: (code: string) => void;

  status: BrainStatus;
  /** 0..1 while downloading. */
  progress: number;
  progressText: string;
  error: string | null;

  /** Which model is selected, and whether the browser already has it. */
  model: TownModel;
  setModel: (id: string) => void;
  models: TownModel[];
  cachedIds: string[];
  /** True when an 800 MB pull would be rude on this connection. */
  metered: boolean;
  /** Why WebGPU is unavailable, when it is. */
  gpuReason: string | null;

  awaken: () => void;
  cancel: () => void;
  /** Free the GPU without forgetting the download. */
  sleep: () => void;

  /** Present only when status is 'ready'. */
  engine: WebLLM.MLCEngineInterface | null;
  /** Convenience: is there a brain to ask right now? */
  awake: boolean;
  /** Ask the model for a complete reply, or get null when it is not awake. */
  ask: (messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }) => Promise<string | null>;
}

const TownAIContext = createContext<TownAIValue | null>(null);

export const useTownAI = (): TownAIValue => {
  const ctx = useContext(TownAIContext);
  if (!ctx) throw new Error('useTownAI must be used inside <TownAIProvider>');
  return ctx;
};

export function TownAIProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [modelId, setModelIdState] = useState(DEFAULT_MODEL_ID);
  const [status, setStatus] = useState<BrainStatus>('asleep');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [gpuReason, setGpuReason] = useState<string | null>(null);
  const [cachedIds, setCachedIds] = useState<string[]>([]);
  const [metered, setMetered] = useState(false);

  const engineRef = useRef<WebLLM.MLCEngineInterface | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [engine, setEngine] = useState<WebLLM.MLCEngineInterface | null>(null);

  // Remember the visitor's language and model choice, and pick sensible first defaults.
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(LANG_KEY);
      if (savedLang && languageFor(savedLang).code === savedLang) setLanguageState(savedLang);
      const savedModel = localStorage.getItem(MODEL_KEY);
      setModelIdState(savedModel && MODELS.some((m) => m.id === savedModel) ? savedModel : suggestedModelId());
    } catch { /* private mode; defaults are fine */ }
    setMetered(onMeteredConnection());
  }, []);

  // Find out whether a brain is even possible here, and whether one is already downloaded.
  // Both are cheap and neither pulls the runtime's weights.
  useEffect(() => {
    let cancelled = false;
    webGpuStatus().then(({ ok, reason }) => {
      if (cancelled) return;
      if (!ok) { setStatus('unsupported'); setGpuReason(reason ?? null); return; }
      Promise.all(MODELS.map(async (m) => ((await isCached(m.id)) ? m.id : null)))
        .then((ids) => { if (!cancelled) setCachedIds(ids.filter(Boolean) as string[]); })
        .catch(() => { /* cache unreadable; treat as empty */ });
    });
    return () => { cancelled = true; };
  }, []);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    try { localStorage.setItem(LANG_KEY, code); } catch { /* private mode */ }
  }, []);

  const setModel = useCallback((id: string) => {
    setModelIdState(id);
    try { localStorage.setItem(MODEL_KEY, id); } catch { /* private mode */ }
  }, []);

  const awaken = useCallback(() => {
    if (status === 'downloading' || status === 'ready' || status === 'unsupported') return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('downloading');
    setProgress(0);
    setProgressText('Waking up…');
    setError(null);

    loadEngine(modelId, (p) => { setProgress(p.fraction); setProgressText(p.text); }, controller.signal)
      .then((e) => {
        engineRef.current = e;
        setEngine(e);
        setStatus('ready');
        setProgress(1);
        setCachedIds((ids) => (ids.includes(modelId) ? ids : [...ids, modelId]));
      })
      .catch((e: unknown) => {
        if (e instanceof LoadCancelled) { setStatus('asleep'); setProgress(0); setProgressText(''); return; }
        console.error(e);
        setStatus('error');
        setError(
          e instanceof Error && /storage|quota/i.test(e.message)
            ? 'There is not enough free storage for the model. Freeing some space, or choosing the Light model, will fix it.'
            : 'The model could not be started on this device. Everything else on this page still works.',
        );
      });
  }, [modelId, status]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus('asleep');
    setProgress(0);
    setProgressText('');
  }, []);

  const sleep = useCallback(() => {
    const e = engineRef.current;
    engineRef.current = null;
    setEngine(null);
    setStatus('asleep');
    setProgress(0);
    if (e) { e.unload().catch(() => { /* already gone */ }); }
  }, []);

  // Never hold a GPU context after the page goes away.
  useEffect(() => () => { engineRef.current?.unload().catch(() => { /* gone */ }); }, []);

  const ask = useCallback(async (
    messages: ChatMessage[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string | null> => {
    const e = engineRef.current;
    if (!e) return null;
    try {
      const { complete } = await import('./webllm');
      return await complete(e, messages, opts);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  const value = useMemo<TownAIValue>(() => ({
    language, setLanguage,
    status, progress, progressText, error,
    model: modelById(modelId), setModel, models: MODELS, cachedIds, metered, gpuReason,
    awaken, cancel, sleep,
    engine, awake: status === 'ready' && engine !== null,
    ask,
  }), [
    language, setLanguage, status, progress, progressText, error, modelId, setModel,
    cachedIds, metered, gpuReason, awaken, cancel, sleep, engine, ask,
  ]);

  return <TownAIContext.Provider value={value}>{children}</TownAIContext.Provider>;
}
