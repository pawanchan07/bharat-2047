/**
 * The languages a citizen of this town may speak to it in.
 *
 * One choice drives three separate systems: speech recognition, speech synthesis and the
 * language the model is asked to reply in. So it lives in one place rather than being
 * re-derived in each of them.
 *
 * The list is deliberately short and honest. These are seven of India's most spoken
 * languages, not all twenty-two scheduled ones: recognition and voice quality fall off a
 * cliff outside this set on most devices, and shipping a picker full of options that
 * silently do not work would be worse than shipping seven that do.
 */

export interface TownLanguage {
  /** BCP-47 tag for SpeechRecognition and for matching a speechSynthesis voice. */
  code: string;
  /** How the language names itself. */
  native: string;
  /** How it is named in English, for readers who do not read the script. */
  english: string;
  /** A real complaint in this language, used as the placeholder and the demo prompt. */
  sample: string;
  /** What that complaint says, for the reader who does not speak it. */
  sampleEnglish: string;
  /** Language tag families that count as a match when picking a voice. */
  voiceMatch: string[];
}

export const LANGUAGES: TownLanguage[] = [
  {
    code: 'en-IN', native: 'English', english: 'English',
    sample: 'My pension has not arrived for three months',
    sampleEnglish: 'My pension has not arrived for three months',
    voiceMatch: ['en-IN', 'en-GB', 'en-US', 'en'],
  },
  {
    code: 'hi-IN', native: 'हिन्दी', english: 'Hindi',
    sample: 'मेरी पेंशन तीन महीने से नहीं आई है',
    sampleEnglish: 'My pension has not come for three months',
    voiceMatch: ['hi-IN', 'hi'],
  },
  {
    code: 'pa-IN', native: 'ਪੰਜਾਬੀ', english: 'Punjabi',
    sample: 'ਮੇਰੀ ਪੈਨਸ਼ਨ ਤਿੰਨ ਮਹੀਨੇ ਤੋਂ ਨਹੀਂ ਆਈ',
    sampleEnglish: 'My pension has not come for three months',
    voiceMatch: ['pa-IN', 'pa-Guru-IN', 'pa'],
  },
  {
    code: 'te-IN', native: 'తెలుగు', english: 'Telugu',
    sample: 'నా పెన్షన్ మూడు నెలలుగా రాలేదు',
    sampleEnglish: 'My pension has not come for three months',
    voiceMatch: ['te-IN', 'te'],
  },
  {
    code: 'ta-IN', native: 'தமிழ்', english: 'Tamil',
    sample: 'என் ஓய்வூதியம் மூன்று மாதங்களாக வரவில்லை',
    sampleEnglish: 'My pension has not come for three months',
    voiceMatch: ['ta-IN', 'ta-LK', 'ta'],
  },
  {
    code: 'bn-IN', native: 'বাংলা', english: 'Bengali',
    sample: 'আমার পেনশন তিন মাস ধরে আসেনি',
    sampleEnglish: 'My pension has not come for three months',
    voiceMatch: ['bn-IN', 'bn-BD', 'bn'],
  },
  {
    code: 'mr-IN', native: 'मराठी', english: 'Marathi',
    sample: 'माझी पेन्शन तीन महिन्यांपासून आलेली नाही',
    sampleEnglish: 'My pension has not come for three months',
    voiceMatch: ['mr-IN', 'mr'],
  },
];

export const DEFAULT_LANGUAGE = 'hi-IN';

export const languageFor = (code: string): TownLanguage =>
  LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[1];

/**
 * Pick the best installed voice for a language. Devices name voices inconsistently, so we
 * walk the match list from most to least specific and give up honestly rather than
 * speaking Hindi text with an American voice.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  code: string,
): SpeechSynthesisVoice | null {
  const lang = languageFor(code);
  for (const tag of lang.voiceMatch) {
    const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
  }
  for (const tag of lang.voiceMatch) {
    const prefix = tag.split('-')[0].toLowerCase();
    const loose = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix));
    if (loose) return loose;
  }
  return null;
}
