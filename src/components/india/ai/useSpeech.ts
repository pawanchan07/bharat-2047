'use client';

/**
 * Speech in and speech out, from the browser itself: no key, no account, no service.
 *
 * Two honest notes that the UI repeats to the visitor rather than hiding:
 *
 * 1. Recognition can run on the device or in the cloud. Chrome exposes
 *    `availableOnDevice()` / `processLocally`, and where a language pack is installed the
 *    audio never leaves the machine. Where it is not, Chrome sends the audio to its own
 *    speech service. A project that claims "no keys" has to say which one is running
 *    instead of letting people assume the microphone is private.
 * 2. Voices are whatever the device happens to have installed. A phone with no Tamil voice
 *    cannot be made to speak Tamil by asking nicely, so the caller is told and the
 *    subtitles carry the meaning instead.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pickVoice } from './languages';

// ---------------------------------------------------------------- recognition

type RecognitionErrorKind =
  | 'unsupported' | 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'language' | 'unknown';

export interface RecognitionError {
  kind: RecognitionErrorKind;
  /** Written for a visitor, not a developer. */
  message: string;
  /** What they can actually do about it. */
  hint?: string;
}

const ERRORS: Record<RecognitionErrorKind, RecognitionError> = {
  unsupported: {
    kind: 'unsupported',
    message: 'This browser cannot listen.',
    hint: 'Speech recognition needs Chrome, Edge or Safari. Everything here still works by typing.',
  },
  'not-allowed': {
    kind: 'not-allowed',
    message: 'The microphone is blocked.',
    hint: 'Allow microphone access for this site in your browser settings, then try again, or type instead.',
  },
  'no-speech': {
    kind: 'no-speech',
    message: 'Nothing was heard.',
    hint: 'Tap the microphone and speak again, a little closer.',
  },
  'audio-capture': {
    kind: 'audio-capture',
    message: 'No microphone found.',
    hint: 'Plug one in or use a device with a mic. You can type your problem instead.',
  },
  network: {
    kind: 'network',
    message: 'Recognition needs the network right now.',
    hint: 'This language has no on-device pack installed, so the browser sends audio to its speech service, and that needs a connection.',
  },
  language: {
    kind: 'language',
    message: "This language is not supported by your browser's recogniser.",
    hint: 'Pick another language, or type your problem: the engine reads Devanagari, Hinglish and English the same way.',
  },
  unknown: {
    kind: 'unknown',
    message: 'The microphone stopped unexpectedly.',
    hint: 'Try once more, or type instead.',
  },
};

/* Minimal shapes for an API TypeScript's DOM lib still does not describe. */
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  isFinal: boolean; length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  processLocally?: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
  availableOnDevice?: (lang: string) => Promise<string | boolean>;
}

const getRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export interface UseListening {
  supported: boolean;
  listening: boolean;
  /** Words confirmed so far this session. */
  transcript: string;
  /** Words still being revised as the person speaks. */
  interim: string;
  error: RecognitionError | null;
  /** True when this language is recognised without the audio leaving the device. */
  onDevice: boolean | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Listen in one language, reporting words as they are heard so the visitor can watch the
 * transcript build. Recognition is restarted internally on the browser's own end events so
 * a natural pause does not silently end the session.
 */
export function useListening(lang: string, onFinal?: (text: string) => void): UseListening {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<RecognitionError | null>(null);
  const [onDevice, setOnDevice] = useState<boolean | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantedRef = useRef(false);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  // Ask whether this language can be recognised without sending audio anywhere.
  useEffect(() => {
    let cancelled = false;
    const Ctor = getRecognitionCtor();
    const probe: Promise<boolean | null> = Ctor?.availableOnDevice
      ? Ctor.availableOnDevice(lang).then((r) => r === true || r === 'available').catch(() => null)
      : Promise.resolve(null);
    probe.then((v) => { if (!cancelled) setOnDevice(v); });
    return () => { cancelled = true; };
  }, [lang]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
    setInterim('');
  }, []);

  const reset = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setError(ERRORS.unsupported); return; }

    // A fresh recogniser each time: reusing one across languages is unreliable on mobile.
    try { recRef.current?.abort(); } catch { /* nothing running */ }

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // Prefer on-device. Where the pack is missing the browser falls back on its own; we
    // only set it when we know it can be honoured, so a missing pack is not an error.
    if (onDevice === true) { try { rec.processLocally = true; } catch { /* not supported */ } }

    rec.onstart = () => { setListening(true); setError(null); };

    rec.onresult = (event) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalRef.current = (finalRef.current + ' ' + text).trim();
          setTranscript(finalRef.current);
          onFinalRef.current?.(finalRef.current);
        } else {
          live += text;
        }
      }
      setInterim(live);
    };

    rec.onerror = (e) => {
      const kind = (e.error as RecognitionErrorKind) in ERRORS ? (e.error as RecognitionErrorKind) : 'unknown';
      // A pause is not a failure: keep listening rather than showing an error for it.
      if (kind === 'no-speech' && wantedRef.current) return;
      wantedRef.current = false;
      setError(ERRORS[kind]);
      setListening(false);
    };

    rec.onend = () => {
      setInterim('');
      // The browser ends the session on its own after a silence. If the visitor has not
      // tapped stop, pick it back up so a thinking pause does not cut them off.
      if (wantedRef.current) {
        try { rec.start(); return; } catch { /* fall through to stopping */ }
      }
      setListening(false);
    };

    recRef.current = rec;
    wantedRef.current = true;
    try {
      rec.start();
    } catch {
      wantedRef.current = false;
      setError(ERRORS.unknown);
    }
  }, [lang, onDevice]);

  // Never leave a microphone open behind a closed screen.
  useEffect(() => () => { wantedRef.current = false; try { recRef.current?.abort(); } catch { /* gone */ } }, []);

  return { supported, listening, transcript, interim, error, onDevice, start, stop, reset };
}

// ----------------------------------------------------------------- synthesis

export interface UseSpeaking {
  supported: boolean;
  speaking: boolean;
  /** Null when the device has no voice for the chosen language, so subtitles carry it instead. */
  voiceFor: (lang: string) => SpeechSynthesisVoice | null;
  speak: (text: string, lang: string) => void;
  cancel: () => void;
  /** Call inside a tap so iOS will allow speech later; harmless everywhere else. */
  prime: () => void;
}

/** Long text is split on sentence ends: iOS truncates a single long utterance. */
function intoUtterableChunks(text: string): string[] {
  const parts = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[।.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const part of parts) {
    if ((current + ' ' + part).trim().length > 180) {
      if (current) chunks.push(current.trim());
      current = part;
    } else {
      current = (current + ' ' + part).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

export function useSpeaking(): UseSpeaking {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const primedRef = useRef(false);

  // getVoices() is empty on the first call in every browser; the list arrives later.
  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const voiceFor = useCallback((lang: string) => pickVoice(voices, lang), [voices]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const prime = useCallback(() => {
    if (!supported || primedRef.current) return;
    // iOS only unlocks speech inside a user gesture. An empty utterance does that without
    // making a sound.
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    primedRef.current = true;
  }, [supported]);

  const speak = useCallback((text: string, lang: string) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const voice = pickVoice(voices, lang);
    const chunks = intoUtterableChunks(text);
    setSpeaking(true);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 1;
      if (i === chunks.length - 1) {
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
      }
      window.speechSynthesis.speak(u);
    });
  }, [supported, voices]);

  // Stop talking if the screen is closed or the tab is hidden.
  useEffect(() => {
    if (!supported) return;
    const onHide = () => { if (document.hidden) { window.speechSynthesis.cancel(); setSpeaking(false); } };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { supported, speaking, voiceFor, speak, cancel, prime };
}
