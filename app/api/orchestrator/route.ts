// app/api/orchestrator/route.ts
//
// The Forge Orchestrator. Per Aj: one chat box, in Forge and in
// Hyperion's CEO, that takes a freeform instruction and runs the real
// generators behind the scenes -- no separate routing logic in two
// places that could quietly drift apart. Both interfaces call this
// same endpoint.
//
// Two real steps: (1) classify which real generator the instruction
// needs and construct valid parameters for its ACTUAL contract (not a
// guessed one -- every contract below was read directly from the real
// route source before being included here), (2) dispatch to that real
// endpoint and return its real result.
//
// Honest about scope: this covers the generators whose real contracts
// have actually been verified. Adding a new one means adding a real
// entry here after reading its actual route.ts, the same discipline
// used for every entry already present -- not a guess at what its
// contract "probably" looks like.

import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/lib/error-message';

const BASE_URL = 'https://project-forge-omega.vercel.app';
const anthropicKey = () => process.env.ANTHROPIC_API_KEY;

async function callClaude(system: string, userMsg: string, maxTokens = 1000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey()!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMsg }] }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// Real, verified generator contracts -- every field here was read
// directly from the actual route source, not assumed.
const GENERATORS: Record<string, { endpoint: string; description: string; params: string; producesRealFile: boolean }> = {
  comic_generator: {
    endpoint: '/api/comic-generator/generate',
    description: 'A comic-book-style article on any topic, or a weekly-planner-curated comic.',
    params: 'userId, mode ("topic"|"weekly"), topic (if mode=topic), title, artMode ("cast" for consistent recurring characters)',
    producesRealFile: true,
  },
  product_builder: {
    endpoint: '/api/product-builder/generate',
    description: 'A polished, branded PDF worksheet or activity from a schema and topic -- the general-purpose real-PDF pipeline.',
    params: 'userId, schemaId, subject, grade, topic, jurisdiction',
    producesRealFile: true,
  },
  interactive_notebook: {
    endpoint: '/api/inb-generator/generate',
    description: 'A foldable/component-based interactive notebook (specifically use schemaId 1821568d-6538-467c-a49c-7d40d993dee7).',
    params: 'userId, schemaId, subject, grade, topic, jurisdiction',
    producesRealFile: true,
  },
  word_search: {
    endpoint: '/api/worksheet-generators/word-search',
    description: 'A word search puzzle.',
    params: 'userId, words (array of strings), difficulty ("basic"|harder), title',
    producesRealFile: true,
  },
  crossword: {
    endpoint: '/api/worksheet-generators/crossword',
    description: 'A crossword puzzle.',
    params: 'userId, entries (array of {word, clue}), title',
    producesRealFile: true,
  },
  bingo: {
    endpoint: '/api/worksheet-generators/bingo',
    description: 'Bingo boards for vocabulary/review.',
    params: 'userId, words (array of strings), boardCount (default 10), freeSpace (default true), title',
    producesRealFile: true,
  },
  sudoku: {
    endpoint: '/api/worksheet-generators/sudoku',
    description: 'A sudoku puzzle.',
    params: 'userId, size (default 9), difficulty ("easy"|"medium"|"hard"), title',
    producesRealFile: true,
  },
  flashcards: {
    endpoint: '/api/worksheet-generators/flashcards',
    description: 'Printable flashcards.',
    params: 'userId, words (array of strings, or {front,back} pairs), color, title',
    producesRealFile: true,
  },
  quiz: {
    endpoint: '/api/worksheet-generators/quiz',
    description: 'A quiz/test worksheet.',
    params: 'userId, type, content, title',
    producesRealFile: true,
  },
  task_cards: {
    endpoint: '/api/worksheet-generators/task-cards',
    description: 'A set of task cards for review/practice.',
    params: 'userId, topic, grade, subject, count (default 24), title',
    producesRealFile: true,
  },
  spelling_list: {
    endpoint: '/api/worksheet-generators/spelling-list',
    description: 'A spelling word list worksheet.',
    params: 'userId, grade (default "3"), topic, wordCount, title',
    producesRealFile: true,
  },
};

const GENERATOR_CATALOG = Object.entries(GENERATORS)
  .map(([id, g]) => `${id}: ${g.description}\n  Real parameters: ${g.params}`)
  .join('\n\n');

export async function POST(request: NextRequest) {
  try {
    const { userId, instruction } = (await request.json()) || {};
    if (!userId || !instruction) {
      return NextResponse.json({ error: 'userId and instruction are required' }, { status: 400 });
    }

    // Step 1: classify + construct real parameters for the real contract.
    const system =
      'You are the Forge Orchestrator classification step. Given a freeform instruction, pick the ONE real generator that ' +
      'actually matches it, and construct a valid parameter object for its REAL contract below -- do not invent fields that ' +
      "aren't listed, and do not omit required ones. If nothing genuinely matches, say so honestly rather than forcing a bad fit.\n\n" +
      GENERATOR_CATALOG +
      '\n\nRespond with ONLY a JSON object, no other text: {"generator": "<id from the list above, or null if nothing fits>", ' +
      '"params": {<real params for that generator, NOT including userId>}, "reasoning": "<one sentence>"}';

    const raw = await callClaude(system, instruction, 1000);
    let classification: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      classification = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return NextResponse.json({ error: 'Could not classify the instruction into a real generator', raw }, { status: 500 });
    }

    if (!classification.generator || !GENERATORS[classification.generator]) {
      return NextResponse.json({
        error: 'No real generator matches this instruction.',
        reasoning: classification.reasoning || null,
        availableGenerators: Object.keys(GENERATORS),
      }, { status: 400 });
    }

    const gen = GENERATORS[classification.generator];

    // Step 2: dispatch to the real endpoint.
    const dispatchRes = await fetch(`${BASE_URL}${gen.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...classification.params }),
    });

    // Real difference found via live testing, not assumed: some
    // generators (comic-generator, product-builder, inb-generator)
    // return JSON with a URL inside it. Others (most worksheet-
    // generators) return the raw PDF bytes directly, with the real
    // saved file URL in a custom X-File-Url response header instead --
    // handle both shapes rather than assuming every generator behaves
    // the same way.
    const contentType = dispatchRes.headers.get('content-type') || '';
    let result: any;
    if (contentType.includes('application/pdf')) {
      if (!dispatchRes.ok) {
        return NextResponse.json({
          error: `${classification.generator} failed (${dispatchRes.status})`,
          generator: classification.generator,
          reasoning: classification.reasoning,
        }, { status: 502 });
      }
      const fileUrlHeader = dispatchRes.headers.get('x-file-url');
      result = { pdfUrl: fileUrlHeader ? decodeURIComponent(fileUrlHeader) : null };
    } else {
      result = await dispatchRes.json();
      if (!dispatchRes.ok) {
        return NextResponse.json({
          error: `${classification.generator} failed: ${result.error || dispatchRes.status}`,
          generator: classification.generator,
          reasoning: classification.reasoning,
        }, { status: 502 });
      }
    }

    return NextResponse.json({
      ok: true,
      generator: classification.generator,
      reasoning: classification.reasoning,
      producesRealFile: gen.producesRealFile,
      result,
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    generators: Object.entries(GENERATORS).map(([id, g]) => ({ id, description: g.description })),
  });
}
