/**
 * RAG (Retrieval Augmented Generation) Service
 *
 * Makes the AI chatbot grounded in actual course content.
 * Instead of just giving generic answers, it:
 * 1. Retrieves relevant course content chunks
 * 2. Injects them as context into the AI prompt
 * 3. Generates responses grounded in real course material
 *
 * Architecture:
 * - Course content is chunked and stored (in-memory for prototype)
 * - On each query, we find the most relevant chunks using keyword matching
 * - (In production, use vector embeddings + pgvector for semantic search)
 * - The chunks are injected into the system prompt for grounded generation
 */

import { env } from '../config/env';

interface ContentChunk {
  id: string;
  courseId: string;
  chunkIndex: number;
  text: string;
  metadata: {
    section: string;
    moduleIndex: number;
    type: 'content' | 'objective' | 'summary';
  };
}

interface RagResult {
  chunks: ContentChunk[];
  answer: string;
  sources: string[];
}

// In-memory content store (for prototype — in production, use pgvector + embeddings)
const contentStore = new Map<string, ContentChunk[]>();

/**
 * Index course content for RAG retrieval.
 * Called when course details are fetched from iGOT.
 */
export function indexCourseContent(
  courseId: string,
  modules: Array<{ name: string; content?: string; type: string }>,
  objectives: string[],
  description: string
): void {
  const chunks: ContentChunk[] = [];

  // Add description as a chunk
  if (description) {
    chunks.push({
      id: `${courseId}-desc`,
      courseId,
      chunkIndex: 0,
      text: `Course Overview: ${description}`,
      metadata: { section: 'Course Overview', moduleIndex: -1, type: 'content' },
    });
  }

  // Add learning objectives
  if (objectives.length > 0) {
    chunks.push({
      id: `${courseId}-objectives`,
      courseId,
      chunkIndex: 1,
      text: `Learning Objectives:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
      metadata: { section: 'Learning Objectives', moduleIndex: -1, type: 'objective' },
    });
  }

  // Add modules
  modules.forEach((mod, idx) => {
    if (mod.content) {
      // Split long content into chunks of ~500 words
      const sentences = mod.content.split(/[.!?]+/).filter(Boolean);
      let currentChunk = '';
      let chunkIdx = 2;

      for (const sentence of sentences) {
        if (currentChunk.split(' ').length > 400) {
          chunks.push({
            id: `${courseId}-mod${idx}-chunk${chunkIdx}`,
            courseId,
            chunkIndex: chunkIdx++,
            text: currentChunk.trim(),
            metadata: { section: mod.name, moduleIndex: idx, type: 'content' },
          });
          currentChunk = '';
        }
        currentChunk += sentence.trim() + '. ';
      }

      if (currentChunk.trim()) {
        chunks.push({
          id: `${courseId}-mod${idx}-chunk${chunkIdx}`,
          courseId,
          chunkIndex: chunkIdx,
          text: currentChunk.trim(),
          metadata: { section: mod.name, moduleIndex: idx, type: 'content' },
        });
      }
    } else {
      // Even without content, store module name for context
      chunks.push({
        id: `${courseId}-mod${idx}`,
        courseId,
        chunkIndex: idx + 2,
        text: `Module: ${mod.name} (${mod.type})`,
        metadata: { section: mod.name, moduleIndex: idx, type: 'summary' },
      });
    }
  });

  contentStore.set(courseId, chunks);
  console.log(`[RAG] Indexed ${chunks.length} chunks for course ${courseId}`);
}

/**
 * Retrieve relevant chunks for a query using keyword matching.
 * (In production, use cosine similarity with embeddings)
 */
export function retrieveChunks(courseId: string, query: string, topK: number = 5): ContentChunk[] {
  const chunks = contentStore.get(courseId) || [];
  if (chunks.length === 0) return [];

  // Simple TF scoring for keyword matching
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const scored = chunks.map((chunk) => {
    const textLower = chunk.text.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      // Count occurrences
      const regex = new RegExp(term, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    // Boost exact phrase matches
    if (textLower.includes(query.toLowerCase())) {
      score += 5;
    }

    // Boost objectives and summaries slightly
    if (chunk.metadata.type === 'objective') score += 1;
    if (chunk.metadata.type === 'summary') score += 0.5;

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

/**
 * Build a RAG-enhanced prompt with retrieved course content.
 */
export function buildRagPrompt(
  userQuery: string,
  chunks: ContentChunk[],
  courseTitle: string
): string {
  const contextChunks = chunks
    .map((c) => `[${c.metadata.section}]\n${c.text}`)
    .join('\n\n');

  return `You are an AI study assistant for the government training course "${courseTitle}" on iGOT Karmayogi.

The following context has been retrieved from the actual course content. Use it to answer the user's question accurately. If the answer is not in the provided context, say so honestly rather than making up information.

COURSE CONTENT (retrieved from course materials):
---
${contextChunks || 'No specific course content available for this query.'}
---

User question: ${userQuery}

Instructions:
1. Answer based primarily on the provided course content
2. If the content doesn't fully answer the question, acknowledge what you know and what you don't
3. Cite specific modules or sections when possible
4. Be helpful but honest about limitations
5. For administrative questions (enrollment, certificates), provide general guidance`;
}

/**
 * Generate a RAG-enhanced response using Gemini/Sarvam.
 * Returns both the answer and the source chunks used.
 */
export async function ragQuery(
  courseId: string,
  query: string,
  courseTitle: string
): Promise<RagResult> {
  // Retrieve relevant chunks
  const chunks = retrieveChunks(courseId, query);

  // Build RAG prompt
  const prompt = buildRagPrompt(query, chunks, courseTitle);

  // Call AI with RAG prompt
  let answer = '';

  // Try Gemini
  const geminiKey = env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        const candidates = data.candidates as Record<string, unknown>[] | undefined;
        const first = candidates?.[0] as Record<string, unknown> | undefined;
        const content = first?.content as Record<string, unknown> | undefined;
        const parts = content?.parts as Record<string, unknown>[] | undefined;
        answer = (parts?.[0]?.text as string) || '';
      }
    } catch (err) {
      console.warn('[RAG] Gemini failed:', err);
    }
  }

  // Try Sarvam if Gemini failed
  if (!answer && env.SARVAM_API_KEY) {
    try {
      const resp = await fetch('https://api.sarvam.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SARVAM_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'sarvam-2b-v0.5',
          messages: [
            { role: 'system', content: 'You are an AI study assistant for Indian government training courses.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        const choices = data.choices as Record<string, unknown>[] | undefined;
        const msg = choices?.[0] as Record<string, unknown> | undefined;
        const message = msg?.message as Record<string, unknown> | undefined;
        answer = (message?.content as string) || '';
      }
    } catch (err) {
      console.warn('[RAG] Sarvam failed:', err);
    }
  }

  // Local fallback
  if (!answer) {
    answer = generateGroundedFallback(query, courseTitle, chunks);
  }

  return {
    chunks,
    answer,
    sources: chunks.map((c) => c.metadata.section),
  };
}

/**
 * Local fallback that uses retrieved chunks even without AI.
 */
function generateGroundedFallback(
  query: string,
  courseTitle: string,
  chunks: ContentChunk[]
): string {
  if (chunks.length === 0) {
    return `I don't have specific course content for "${courseTitle}" that answers your question. Try asking about the course modules, objectives, or specific topics covered.`;
  }

  const relevantContent = chunks
    .slice(0, 3)
    .map((c) => `• ${c.metadata.section}: ${c.text.substring(0, 200)}...`)
    .join('\n');

  return `Based on the course content for "${courseTitle}":\n\n${relevantContent}\n\nFor more detailed information, visit the course on iGOT Karmayogi.`;
}
