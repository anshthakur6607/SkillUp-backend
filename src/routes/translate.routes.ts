/**
 * Translation Routes — server-side proxy for Sarvam AI translation.
 *
 * POST /api/translate — translate text or batch of texts to target language.
 *
 * SECURITY: Sarvam API key is server-side only. Frontend never sees the key.
 * Supports: English ↔ 10 Indian languages (Hindi, Bengali, Tamil, Telugu, etc.)
 */

import { Router, Request, Response } from "express";

const router = Router();

// Supported target languages for Sarvam
const SUPPORTED_LANGS: Record<string, string> = {
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
};

/**
 * POST /api/translate
 * Body: { text: string, targetLang: string } OR { texts: string[], targetLang: string }
 * Returns: { translated: string } or { translations: string[] }
 */
router.post("/translate", async (req: Request, res: Response) => {
  try {
    const { text, texts, targetLang } = req.body;

    if (!targetLang || !SUPPORTED_LANGS[targetLang]) {
      res.status(400).json({
        error: "Invalid target language",
        supported: Object.keys(SUPPORTED_LANGS),
      });
      return;
    }

    const sarvamKey = process.env.SARVAM_API_KEY;
    if (!sarvamKey) {
      // No API key — return original text (graceful degradation)
      if (Array.isArray(texts)) {
        res.json({ translations: texts });
      } else {
        res.json({ translated: text || "" });
      }
      return;
    }

    const targetSarvamLang = SUPPORTED_LANGS[targetLang];

    // Single text translation
    if (text && typeof text === "string") {
      const translated = await translateSarvam(text, "en", targetSarvamLang, sarvamKey);
      res.json({ translated });
      return;
    }

    // Batch translation
    if (Array.isArray(texts)) {
      // Translate sequentially to avoid rate limits
      const translations: string[] = [];
      for (const t of texts) {
        const translated = await translateSarvam(t, "en", targetSarvamLang, sarvamKey);
        translations.push(translated);
      }
      res.json({ translations });
      return;
    }

    res.status(400).json({ error: "Provide either 'text' or 'texts' array" });
  } catch (error) {
    console.error("[Translate] Error:", error);
    // Graceful fallback — return original text
    const { text, texts } = req.body;
    if (Array.isArray(texts)) {
      res.json({ translations: texts });
    } else {
      res.json({ translated: text || "" });
    }
  }
});

/**
 * Call Sarvam AI translation API.
 * API docs: https://docs.sarvam.ai/api-reference/translation
 */
async function translateSarvam(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<string> {
  try {
    const resp = await fetch("https://api.sarvam.ai/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API-Subscription-Key": apiKey,
      },
      body: JSON.stringify({
        input: text,
        source_language_code: sourceLang,
        target_language_code: targetLang,
        mode: "formal",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      console.error(`[Translate] Sarvam API returned ${resp.status}`);
      return text; // fallback to original
    }

    const data = (await resp.json()) as { translated_text?: string };
    return data.translated_text || text;
  } catch (error) {
    console.error("[Translate] Sarvam call failed:", error);
    return text; // fallback to original
  }
}

export default router;
