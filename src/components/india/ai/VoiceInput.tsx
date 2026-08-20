'use client';

/**
 * The microphone a villager actually speaks into.
 *
 * Tap to start, tap to stop, not press-and-hold, which fights scrolling on a phone, times
 * out on a long sentence, and is hostile to anyone with a motor impairment.
 *
 * The transcript is shown as it is heard, because watching the words appear is what makes
 * the claim believable. Every failure the browser can report has its own designed state;
 * none of them dead-ends, because the typed box is always still there.
 */

import React, { useEffect } from 'react';
import { languageFor } from './languages';
import { useListening, useSpeaking } from './useSpeech';

export function VoiceInput({
  language, value, onChange, onSubmit, submitLabel = 'Continue →', rows = 3, hint,
}: {
  language: string;
  value: string;
  onChange: (text: string) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  rows?: number;
  hint?: React.ReactNode;
}) {
  const lang = languageFor(language);
  const listening = useListening(language, onChange);
  const speaking = useSpeaking();

  // A new language needs a new session; anything half-heard in the old one is meaningless.
  const { stop: stopListening, reset: resetListening } = listening;
  useEffect(() => { stopListening(); resetListening(); }, [language, stopListening, resetListening]);

  const toggle = () => {
    if (listening.listening) { listening.stop(); return; }
    // iOS only unlocks speech synthesis inside a gesture, and this tap is the first one the
    // visitor makes. Prime it here so the answer can be spoken back later.
    speaking.prime();
    listening.reset();
    onChange('');
    listening.start();
  };

  const live = (listening.transcript + ' ' + listening.interim).trim();

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          onClick={toggle}
          disabled={!listening.supported}
          aria-pressed={listening.listening}
          className={`relative flex items-center gap-2 rounded-full px-5 py-3 font-semibold transition-colors ${
            !listening.supported
              ? 'cursor-not-allowed bg-white/5 text-white/30'
              : listening.listening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400'
          }`}
        >
          {listening.listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" aria-hidden />
          )}
          <span className="relative text-lg" aria-hidden>{listening.listening ? '⏹' : '🎙️'}</span>
          <span className="relative">
            {listening.listening ? 'Listening, tap to stop' : `Speak in ${lang.native}`}
          </span>
        </button>

        {listening.onDevice !== null && listening.supported && (
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              listening.onDevice
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/15 bg-white/5 text-white/50'
            }`}
            title={
              listening.onDevice
                ? 'A language pack for this language is installed, so the audio is recognised on this device and never leaves it.'
                : 'No on-device pack for this language, so the browser sends the audio to its own speech service to transcribe it.'
            }
          >
            {listening.onDevice ? '🔒 recognised on your device' : "☁️ recognised by your browser's service"}
          </span>
        )}
      </div>

      {/* Live waveform, only while actually listening. A fake one would be a lie. */}
      {listening.listening && (
        <div className="mb-2 flex h-6 items-end gap-1" aria-hidden>
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-red-400/80"
              style={{
                animation: `vi-wave ${0.5 + (i % 5) * 0.13}s ease-in-out infinite`,
                animationDelay: `${i * 0.035}s`,
              }}
            />
          ))}
          <style>{`@keyframes vi-wave { 0%,100% { height: 5px } 50% { height: 24px } }`}</style>
        </div>
      )}

      <label className="mb-1 block text-xs text-white/40">
        {listening.listening
          ? 'Heard so far, keep talking'
          : <>What the desk heard: <span className="text-amber-300">you can edit this freely</span></>}
      </label>
      <textarea
        value={listening.listening ? live : value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={listening.listening}
        rows={rows}
        placeholder={lang.sample}
        className="w-full resize-none rounded-xl border border-white/15 bg-black/30 p-3 text-white/90 placeholder:text-white/25 focus:border-amber-400/60 focus:outline-none"
      />

      {!listening.supported && (
        <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-xs text-white/50">
          This browser cannot listen: speech recognition needs Chrome, Edge or Safari. Type the
          problem instead; the engine reads it exactly the same way.
        </p>
      )}

      {listening.error && (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.07] p-2.5 text-xs text-amber-200/90">
          <b className="text-amber-200">{listening.error.message}</b>
          {listening.error.hint && <> {listening.error.hint}</>}
        </p>
      )}

      {hint && <div className="mt-2 text-xs text-white/30">{hint}</div>}

      {onSubmit && (
        <button
          onClick={() => { listening.stop(); onSubmit(); }}
          disabled={!value.trim()}
          className="mt-4 rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500"
        >
          {submitLabel}
        </button>
      )}
    </div>
  );
}

/**
 * A speak-this-aloud control. Shows honestly when the device has no voice for the language,
 * because subtitles are then the only way the words land.
 */
export function SpeakButton({
  text, language, autoPlay = false, label = 'Hear this',
}: {
  text: string;
  language: string;
  autoPlay?: boolean;
  label?: string;
}) {
  const speaking = useSpeaking();
  const voice = speaking.voiceFor(language);
  const lang = languageFor(language);

  useEffect(() => {
    if (autoPlay && text.trim() && voice) speaking.speak(text, language);
    // Speaking once when the text arrives is the intent; re-speaking on every render is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, text, language, voice]);

  if (!speaking.supported) return null;

  if (!voice) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/45">
        No {lang.english} voice installed on this device, so the text above is the whole answer.
      </span>
    );
  }

  return (
    <button
      onClick={() => (speaking.speaking ? speaking.cancel() : speaking.speak(text, language))}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:border-amber-400/50 hover:text-white"
    >
      <span aria-hidden>{speaking.speaking ? '⏹' : '🔊'}</span>
      {speaking.speaking ? 'Stop' : label}
    </button>
  );
}
