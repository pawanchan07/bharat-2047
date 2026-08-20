'use client';

/**
 * What the language model is allowed to do at the panchayat desk.
 *
 * Two jobs, both chosen because being wrong at them is not consequential:
 *
 * 1. **A second reading.** It says what it thinks the villager's problem is. That opinion is
 *    displayed *next to* the classifier's, never instead of it. The classifier still decides
 *    what happens to the case, because the classifier is auditable, its training corpus is
 *    in the repo, and its accuracy is measured. When the two disagree the screen says so.
 * 2. **Saying the answer out loud.** Turning the engine's structured verdict into one
 *    natural sentence in the villager's own language, which a template cannot do across
 *    seven languages, and which is the whole point of a desk you can talk to.
 *
 * Every function here returns null rather than guessing when the model is asleep or its
 * output is unusable. The caller always has a deterministic path.
 */

import { INTENTS, INTENT_IDS, IntentId } from '../panchayat';
import { languageFor } from './languages';
import type { ChatMessage } from './webllm';

type Ask = (messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }) => Promise<string | null>;

export interface SecondOpinion {
  intent: IntentId | null;
  /** The model's own words for why, shown verbatim, not paraphrased. */
  because: string;
  /** True when the model named a case type that does not exist. Worth showing. */
  offList: boolean;
}

const INTENT_MENU = INTENT_IDS.map((id) => `${id} = ${INTENTS[id].label}`).join('\n');

/**
 * Ask the model to read the complaint. Deliberately constrained: pick from the same ten
 * case types the classifier has, and say why in one short line.
 */
export async function secondOpinion(ask: Ask, text: string): Promise<SecondOpinion | null> {
  if (!text.trim()) return null;
  const reply = await ask([
    {
      role: 'system',
      content:
        'You read grievances brought to an Indian village panchayat. The citizen may write in ' +
        'English, Hindi, Hinglish, Punjabi, Telugu, Tamil, Bengali or Marathi.\n\n' +
        'Choose exactly one case type from this list:\n' + INTENT_MENU + '\n\n' +
        'Answer in exactly two lines and nothing else:\n' +
        'CASE: <the code, e.g. PENSION_FAILURE>\n' +
        'WHY: <one short sentence in English>',
    },
    { role: 'user', content: text.slice(0, 600) },
  ], { maxTokens: 90, temperature: 0.2 });

  if (!reply) return null;

  const caseLine = /CASE:\s*([A-Z_]+)/.exec(reply)?.[1]?.trim();
  const whyLine = /WHY:\s*([\s\S]+)/.exec(reply)?.[1]?.trim().split('\n')[0]?.trim();
  const matched = INTENT_IDS.find((id) => id === caseLine) ?? null;

  // A model that answers with something not on the menu is a result worth showing, not an
  // error to swallow: it is exactly the failure mode the engine exists to catch.
  if (!matched && !whyLine) return null;

  return {
    intent: matched,
    because: whyLine || 'No reason given.',
    offList: !matched && !!caseLine,
  };
}

export interface VerdictFacts {
  citizenName: string;
  /** What the engine concluded the case is. */
  intentLabel: string;
  /** Where it is going and who signs it. */
  department: string;
  officer: string;
  slaDays: number;
  /** Whether a human has to sign before anything moves. */
  needsHuman: boolean;
  /** The single most important thing found wrong, in plain English. */
  headline: string;
  caseId: string;
}

/** The sentence a desk should say when it hands over a receipt. Always available. */
export function templateVerdict(f: VerdictFacts): string {
  const routed = f.needsHuman
    ? `A panchayat member has to approve it before it moves.`
    : `It has been routed straight to the ${f.department}.`;
  return `${f.citizenName}, your problem has been recorded as "${f.intentLabel}". ${f.headline} ${routed} Your case number is ${f.caseId} and the ${f.officer} must respond within ${f.slaDays} days.`;
}

/**
 * The same facts, said naturally in the villager's language. Falls back to the English
 * template whenever the model is asleep or its reply is unusable. The caller shows the
 * text on screen either way, so a missing voice never costs the visitor the answer.
 */
export async function spokenVerdict(
  ask: Ask, facts: VerdictFacts, languageCode: string,
): Promise<{ text: string; fromModel: boolean }> {
  const fallback = templateVerdict(facts);
  const lang = languageFor(languageCode);
  if (lang.code === 'en-IN') {
    // No translation needed; the model would only add risk without adding anything.
    return { text: fallback, fromModel: false };
  }

  const reply = await ask([
    {
      role: 'system',
      content:
        `You are the assistant at an Indian village panchayat desk. Speak warmly and simply, ` +
        `as if to an elderly villager who cannot read. Reply ONLY in ${lang.english} ` +
        `(${lang.native}), in 2 to 3 short sentences. Do not add facts. Do not translate the ` +
        `case number, read it exactly as given. No preamble, no quotes, no English.`,
    },
    {
      role: 'user',
      content:
        `Tell the citizen this:\n` +
        `Name: ${facts.citizenName}\n` +
        `Their problem is recorded as: ${facts.intentLabel}\n` +
        `What was found: ${facts.headline}\n` +
        `${facts.needsHuman ? 'A panchayat member must approve it before it moves.' : `It has gone straight to the ${facts.department}.`}\n` +
        `Case number: ${facts.caseId}\n` +
        `The ${facts.officer} must reply within ${facts.slaDays} days.`,
    },
  ], { maxTokens: 220, temperature: 0.5 });

  const cleaned = reply?.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  // A reply that came back mostly in ASCII is the model failing to switch script; the
  // template is more use to the visitor than a confident-sounding wrong-language sentence.
  const looksTranslated =
    !!cleaned && cleaned.length > 12 && (cleaned.match(/[^\x00-\x7F]/g)?.length ?? 0) > cleaned.length * 0.3;

  return looksTranslated ? { text: cleaned, fromModel: true } : { text: fallback, fromModel: false };
}
