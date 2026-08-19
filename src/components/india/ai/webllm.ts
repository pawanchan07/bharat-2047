'use client';

/**
 * The town's optional brain: an open-weights model running in the visitor's own browser.
 *
 * Nothing in this file is imported at page load. The WebLLM runtime and the model weights
 * are both fetched only when someone presses "Awaken the town's AI", because the first load
 * of /india may not get slower for a feature most visitors will never turn on.
 *
 * Licence matters as much as quality here. This repo has to stay forkable and runnable by
 * anyone, so a model under a bespoke community licence is out however good it is — which
 * rules out Llama 3.2 and Gemma. Qwen2.5 is Apache-2.0 and is the only sub-2B family that
 * is also meaningfully multilingual.
 */

import type * as WebLLM from '@mlc-ai/web-llm';

export interface TownModel {
  id: string;
  label: string;
  /** Measured from the MLC repository, not estimated from the parameter count. */
  downloadMB: number;
  /** Roughly what the GPU needs to hold it. */
  vramMB: number;
  blurb: string;
}

export const MODELS: TownModel[] = [
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    label: 'Light',
    downloadMB: 275,
    vramMB: 945,
    blurb: 'Quick to download and runs on modest hardware. Good enough to rephrase the desk’s verdict in your language; thinner on open questions.',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Full',
    downloadMB: 838,
    vramMB: 1630,
    blurb: 'Three times the size and noticeably better at reasoning and at Indian languages. Worth it on a laptop with a real GPU.',
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;
export const modelById = (id: string) => MODELS.find((m) => m.id === id) ?? MODELS[0];

/** WebGPU is the hard requirement; without it there is no in-browser model at all. */
export async function webGpuStatus(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof navigator === 'undefined') return { ok: false, reason: 'no browser' };
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) {
    return {
      ok: false,
      reason: 'This browser has no WebGPU, which is what runs the model on your graphics card.',
    };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return { ok: false, reason: 'WebGPU is present but no graphics adapter would start.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'WebGPU failed to initialise on this device.' };
  }
}

/**
 * A device hint, not a gate. Phones on mobile data should be offered the small model first
 * and warned about the download; nobody should be blocked from choosing otherwise.
 */
export function suggestedModelId(): string {
  if (typeof navigator === 'undefined') return DEFAULT_MODEL_ID;
  const smallScreen = typeof window !== 'undefined' && window.innerWidth < 900;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowMemory = typeof memory === 'number' && memory < 8;
  return smallScreen || lowMemory ? MODELS[0].id : MODELS[1].id;
}

/** True when the visitor is on a connection where an 800 MB pull would be rude. */
export function onMeteredConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!c) return false;
  return c.saveData === true || c.effectiveType === '2g' || c.effectiveType === 'slow-2g' || c.effectiveType === '3g';
}

export interface LoadProgress {
  /** 0..1 across the whole fetch-and-compile, straight from WebLLM. */
  fraction: number;
  /** WebLLM's own wording for what it is doing right now. */
  text: string;
}

/** Thrown when the visitor cancels; callers treat it as a normal outcome, not a failure. */
export class LoadCancelled extends Error {
  constructor() { super('cancelled'); this.name = 'LoadCancelled'; }
}

let runtime: typeof WebLLM | null = null;

/** Import the runtime once, on demand. Its chunk is ~1 MB and must never be in the first load. */
async function getRuntime(): Promise<typeof WebLLM> {
  if (!runtime) runtime = await import('@mlc-ai/web-llm');
  return runtime;
}

/** Has this exact model already been fetched into the browser's cache? */
export async function isCached(modelId: string): Promise<boolean> {
  try {
    const rt = await getRuntime();
    return await rt.hasModelInCache(modelId);
  } catch {
    return false;
  }
}

/**
 * Bring an engine up, reporting progress and honouring cancellation.
 *
 * WebLLM has no abort signal of its own, so cancellation is cooperative: we stop reporting,
 * and unload the engine the moment it finishes arriving. The bytes already in flight still
 * land in the cache, which is the right outcome anyway — a resumed download starts from
 * where the last one stopped.
 */
export async function loadEngine(
  modelId: string,
  onProgress: (p: LoadProgress) => void,
  signal?: AbortSignal,
): Promise<WebLLM.MLCEngineInterface> {
  const rt = await getRuntime();
  if (signal?.aborted) throw new LoadCancelled();

  const engine = await rt.CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      if (signal?.aborted) return;
      onProgress({ fraction: report.progress ?? 0, text: report.text ?? '' });
    },
  });

  if (signal?.aborted) {
    try { await engine.unload(); } catch { /* nothing to unload */ }
    throw new LoadCancelled();
  }
  return engine;
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Ask the model, streaming tokens out as they arrive so the screen never sits blank.
 * Generation is capped: an unbounded reply on a phone is a heat and battery problem.
 */
export async function* stream(
  engine: WebLLM.MLCEngineInterface,
  messages: ChatMessage[],
  { maxTokens = 320, temperature = 0.4 }: { maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<string> {
  const chunks = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  });
  for await (const chunk of chunks) {
    const piece = chunk.choices[0]?.delta?.content;
    if (piece) yield piece;
  }
}

/** Collect a whole reply. Used where a half-sentence would be worse than a wait. */
export async function complete(
  engine: WebLLM.MLCEngineInterface,
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  let out = '';
  for await (const piece of stream(engine, messages, opts)) out += piece;
  return out.trim();
}
