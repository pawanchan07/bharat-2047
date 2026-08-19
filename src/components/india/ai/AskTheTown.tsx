'use client';

/**
 * "Ask the town anything" — the guide that sits in the corner of the world.
 *
 * It answers from a curated FAQ first and from the in-browser model second, and it labels
 * which one answered. That order is deliberate: on the questions people actually ask, a
 * paragraph written by hand is more accurate than a 0.5B model, and a guide to a project
 * about honesty should not confabulate about its own cryptography.
 *
 * Everything degrades. No model: the FAQ still answers, and says when a question is outside
 * it. No microphone: you type. No voice: you read.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { languageFor } from './languages';
import { useTownAI } from './TownAI';
import { AwakenBrain, LanguagePicker } from './AiControls';
import { SpeakButton } from './VoiceInput';
import { useListening } from './useSpeech';
import { FAQ, SUGGESTED_QUESTIONS, TOWN_BRIEF, faqAnswer } from './knowledge';

type Source = 'faq' | 'model' | 'none';

interface Turn {
  question: string;
  answer: string;
  source: Source;
  pending?: boolean;
}

export function AskTheTown() {
  const townAI = useTownAI();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAwaken, setShowAwaken] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listening = useListening(townAI.language, setDraft);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const lang = languageFor(townAI.language);

  const send = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    listening.stop();
    setDraft('');

    // The curated answer wins when it exists — it is the more accurate one.
    const curated = faqAnswer(q);
    if (curated) {
      setTurns((t) => [...t, { question: q, answer: curated.answer, source: 'faq' }]);
      return;
    }

    if (!townAI.awake) {
      setTurns((t) => [...t, {
        question: q,
        answer:
          'That one is outside the answers I have written down, and the town’s AI is asleep so I cannot reason about it. ' +
          'Awaken it below and ask again — or try one of the questions underneath, which I can always answer.',
        source: 'none',
      }]);
      setShowAwaken(true);
      return;
    }

    setBusy(true);
    setTurns((t) => [...t, { question: q, answer: '', source: 'model', pending: true }]);
    try {
      const reply = await townAI.ask([
        {
          role: 'system',
          content:
            TOWN_BRIEF +
            `\n\nReply in ${lang.english} (${lang.native}). Two to four sentences. ` +
            `If the answer is not in what you know above, say so plainly.`,
        },
        { role: 'user', content: q.slice(0, 500) },
      ], { maxTokens: 260, temperature: 0.4 });

      setTurns((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        if (last?.pending) {
          last.pending = false;
          last.answer = reply?.trim() ||
            'I could not put an answer together for that one. The questions below are ones I always know.';
          last.source = reply?.trim() ? 'model' : 'none';
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }, [busy, listening, townAI, lang]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-24 right-4 z-30 flex items-center gap-2 rounded-full border border-amber-400/40 bg-[#0b1020]/90 px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur transition-colors hover:bg-amber-500 hover:text-black sm:bottom-4"
      >
        <span aria-hidden className="text-lg">💬</span>
        Ask the town anything
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-30 flex max-h-[min(78vh,640px)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b1020]/97 shadow-2xl backdrop-blur">
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">Ask the town anything</div>
          <div className="truncate text-[11px] text-white/40">
            {townAI.awake ? 'Written answers first, then the model you woke' : 'Answering from what it has written down'}
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close the guide"
          className="shrink-0 rounded-md px-2 py-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* conversation */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div className="text-sm text-white/50">
            <p className="mb-3">
              Ask anything about this town — how the voting chain holds, what the panchayat is
              allowed to decide, how a bank gets audited without being read.
            </p>
            <div className="space-y-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[13px] text-white/70 transition-colors hover:border-amber-400/40 hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i}>
            <div className="mb-1.5 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-amber-500 px-3 py-2 text-sm font-medium text-black">
              {t.question}
            </div>
            <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3 py-2">
              {t.pending ? (
                <span className="text-sm text-white/40">Thinking…</span>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{t.answer}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      t.source === 'faq'
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                        : t.source === 'model'
                          ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
                          : 'border-white/15 text-white/40'
                    }`}>
                      {t.source === 'faq' ? 'written answer' : t.source === 'model' ? 'from the model in your browser' : 'no answer'}
                    </span>
                    {t.source !== 'none' && (
                      <SpeakButton text={t.answer} language={townAI.language} label="Hear it" />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Only offered when a question actually went unanswered — the written answers are
            not a lesser product, and nagging after a good one would say they were. */}
        {showAwaken && townAI.status !== 'unsupported' && !townAI.awake && (
          <AwakenBrain reason="With it awake I can answer questions I have not been given a written answer for — still entirely in your browser." />
        )}
      </div>

      {/* composer */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="mb-2">
          <LanguagePicker compact />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => (listening.listening ? listening.stop() : (listening.reset(), listening.start()))}
            disabled={!listening.supported}
            aria-label={listening.listening ? 'Stop listening' : 'Ask by voice'}
            title={listening.supported ? 'Ask by voice' : 'This browser cannot listen — type instead'}
            className={`shrink-0 rounded-full p-3 text-lg transition-colors ${
              !listening.supported
                ? 'cursor-not-allowed bg-white/5 text-white/25'
                : listening.listening
                  ? 'bg-red-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {listening.listening ? '⏹' : '🎙️'}
          </button>
          <textarea
            value={listening.listening ? (listening.transcript + ' ' + listening.interim).trim() : draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
            }}
            readOnly={listening.listening}
            rows={1}
            placeholder={listening.listening ? 'Listening…' : `Ask in ${lang.native}…`}
            className="max-h-28 min-h-[46px] flex-1 resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white/90 placeholder:text-white/25 focus:border-amber-400/60 focus:outline-none"
          />
          <button
            onClick={() => send(draft)}
            disabled={!draft.trim() || busy}
            aria-label="Send"
            className="shrink-0 rounded-full bg-amber-500 p-3 text-lg text-black transition-colors hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500"
          >
            ↑
          </button>
        </div>
        {listening.error && (
          <p className="mt-2 text-[11px] text-amber-200/80">
            {listening.error.message} {listening.error.hint}
          </p>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-white/25">
          {FAQ.length} questions have answers written by hand; those are used first because on
          this subject they are the more accurate ones.
        </p>
      </div>
    </div>
  );
}
