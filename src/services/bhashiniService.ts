/**
 * Bhashini Translation Service
 *
 * Uses India's Bhashini platform (bhashini.gov.in) for multilingual support.
 * This is India's national AI-powered language translation platform.
 *
 * Supports translation for:
 * - Assessment questions (for multilingual officials)
 * - Chatbot responses (for course assistance)
 * - UI labels (future)
 *
 * API: https://bhashini.gov.in/api
 * Supports 22+ Indian languages including Hindi, Tamil, Bengali, etc.
 */

const BHASHINI_API_URL = 'https://bhashini.gov.in/api';

// Supported Indian languages with their Bhashini codes
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  'en': 'en',
  'hi': 'hi',
  'bn': 'bn',
  'te': 'te',
  'mr': 'mr',
  'ta': 'ta',
  'gu': 'gu',
  'kn': 'kn',
  'ml': 'ml',
  'or': 'or',
  'pa': 'pa',
  'as': 'as',
  'ur': 'ur',
};

export const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'hi': 'Hindi',
  'bn': 'Bengali',
  'te': 'Telugu',
  'mr': 'Marathi',
  'ta': 'Tamil',
  'gu': 'Gujarati',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'or': 'Odia',
  'pa': 'Punjabi',
  'as': 'Assamese',
  'ur': 'Urdu',
};

// Simple in-memory cache for translations (avoid re-translating same text)
const translationCache = new Map<string, string>();

function getCacheKey(text: string, source: string, target: string): string {
  return `${source}:${target}:${text.substring(0, 100)}`;
}

/**
 * Translate text using Bhashini API.
 * Falls back to Google Translate API if Bhashini is unavailable.
 *
 * @param text - text to translate
 * @param sourceLang - source language code (default: 'en')
 * @param targetLang - target language code
 * @returns translated text
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (sourceLang === targetLang) return text;
  if (!text || text.trim().length === 0) return text;

  // Check cache
  const cacheKey = getCacheKey(text, sourceLang, targetLang);
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  // Try Bhashini first, then fallback to Google Translate
  let translated = await callBhashini(text, sourceLang, targetLang);
  if (!translated) {
    translated = await callGoogleTranslate(text, sourceLang, targetLang);
  }

  if (translated) {
    // Cache result
    if (translationCache.size > 1000) {
      // Simple cache eviction: clear oldest entries
      const keys = Array.from(translationCache.keys());
      keys.slice(0, 500).forEach((k) => translationCache.delete(k));
    }
    translationCache.set(cacheKey, translated);
  }

  return translated || text;
}

/**
 * Call Bhashini Translation API.
 */
async function callBhashini(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const response = await fetch(`${BHASHINI_API_URL}/translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[Bhashini] API returned ${response.status}`);
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const result = data?.translatedText as string | undefined;
    return result || null;
  } catch (err) {
    console.warn('[Bhashini] Translation failed:', err);
    return null;
  }
}

/**
 * Fallback: Google Translate free API (unofficial, rate-limited).
 * Used when Bhashini is unavailable.
 */
async function callGoogleTranslate(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) return null;

    const data = await response.json() as unknown[][];
    if (Array.isArray(data) && data[0]) {
      const translated = (data[0] as Array<[string]>)
        .map((item) => item[0])
        .join('');
      return translated || null;
    }
    return null;
  } catch (err) {
    console.warn('[Google Translate] Fallback failed:', err);
    return null;
  }
}

/**
 * Translate an array of assessment questions.
 * Returns questions with translated text.
 */
export async function translateQuestions(
  questions: Array<{
    question: string;
    options: string[];
    explanation: string;
    bloomLevel?: string;
    difficulty?: string;
    competency?: string;
  }>,
  targetLang: string
): Promise<typeof questions> {
  if (targetLang === 'en') return questions;

  const translated = await Promise.all(
    questions.map(async (q) => ({
      ...q,
      question: await translateText(q.question, 'en', targetLang),
      options: await Promise.all(
        q.options.map((opt) => translateText(opt, 'en', targetLang))
      ),
      explanation: await translateText(q.explanation, 'en', targetLang),
    }))
  );

  return translated;
}

/**
 * Check if a language code is supported.
 */
export function isLanguageSupported(lang: string): boolean {
  return lang in SUPPORTED_LANGUAGES;
}

/**
 * Get list of available languages for translation.
 */
export function getAvailableLanguages(): Array<{ code: string; name: string }> {
  return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }));
}
