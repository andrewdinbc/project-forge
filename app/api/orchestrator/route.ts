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
    params: 'userId, words (a SINGLE STRING, one word per line separated by real newline characters -- NOT a JSON array, confirmed via the real route source: String(words).split("\\n")), difficulty ("basic"|harder), title',
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
    params: 'userId, words (a SINGLE STRING with one word per line, separated by real newline characters -- NOT a JSON array, the real route does String(words).split("\\n") so an array gets silently collapsed into one item. REAL HARD MINIMUM: 24 lines when freeSpace is true (default). If the user asks for fewer, generate 24 REAL topically-relevant words anyway, joined with \\n, and say so plainly in your reasoning), boardCount (default 10), freeSpace (default true), title',
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
    params: 'userId, words (a SINGLE STRING, one term per line separated by real newline characters -- NOT a JSON array, confirmed via the real route source which parses it as lines), color, title',
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

// Real, hard minimums confirmed directly from each generator's own
// validation code -- checked programmatically below, not just
// described in the prompt and hoped for. Three real failures in a row
// on bingo specifically (same 1-word result every time despite
// increasingly explicit prompt instructions and more token headroom)
// showed that trusting the single classification call to always
// generate a correctly-sized list isn't reliable enough on its own.
const MIN_LENGTHS: Record<string, Record<string, number>> = {
  bingo: { words: 24 },
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
      "aren't listed, and do not omit required ones. Pay close attention to any real hard constraints noted in a generator's " +
      'params (like a minimum array length) -- if the user asked for fewer than a real minimum, generate the real minimum ' +
      'anyway with genuinely relevant, on-topic content, and say so plainly in your reasoning rather than passing something ' +
      "that will fail the generator's own validation. If nothing genuinely matches, say so honestly rather than forcing a bad fit.\n\n" +
      GENERATOR_CATALOG +
      '\n\nRespond with ONLY a JSON object, no other text: {"generator": "<id from the list above, or null if nothing fits>", ' +
      '"params": {<real params for that generator, NOT including userId>}, "reasoning": "<one sentence>"}';

    // 2026-07-23, real bug found via live testing: 1000 tokens wasn't
    // enough headroom for a real word list (e.g. 24 genuine, topically-
    // relevant words for a bingo board) plus the surrounding JSON and
    // reasoning -- the response was silently truncated mid-generation,
    // producing malformed JSON that still partially parsed, passing
    // through a single garbage word instead of the real list. Real
    // headroom now, plus an explicit check that word-list-shaped params
    // actually came back as real arrays before trusting them.
    const raw = await callClaude(system, instruction, 3000);
    let classification: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      classification = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return NextResponse.json({ error: 'Could not classify the instruction into a real generator -- the response may have been truncated', raw }, { status: 500 });
    }

    // Real, programmatic length check -- not just trusting the single
    // classification call got the count right. If a word-list param is
    // shorter than the generator's real known minimum, run one focused
    // correction call whose ONLY job is expanding that specific list --
    // much more reliable than asking one call to classify, reason, AND
    // generate a long list all at once.
    // 2026-07-23, real root cause found after 4 live-tested failures:
    // these generators parse their word-list param as a NEWLINE-
    // SEPARATED STRING (String(words).split('\n')), not a JSON array.
    // The classification step can still reasonably produce either shape
    // depending on how it interprets the (now-corrected) instructions
    // above, so this coerces whatever comes back into the real expected
    // string shape, and counts real lines against the real minimum --
    // not array length, which was the actual bug the whole time.
    if (classification.params && classification.generator) {
      const minimums = MIN_LENGTHS[classification.generator] || {};
      for (const [key, minLen] of Object.entries(minimums)) {
        let current = classification.params[key];
        let lines: string[] = Array.isArray(current)
          ? current.map((x) => String(x).trim()).filter(Boolean)
          : String(current || '').split('\n').map((x) => x.trim()).filter(Boolean);

        if (lines.length < minLen) {
          const expandSystem =
            `The generator needs exactly ${minLen} real, genuinely relevant items. You currently have ${lines.length}: ` +
            `${JSON.stringify(lines)}. Generate the FULL list of ${minLen} real, topically-appropriate items (keep any good ` +
            `ones already listed, add more in the same spirit). Respond with ONLY a JSON array of exactly ${minLen} strings, nothing else.`;
          const expandRaw = await callClaude(expandSystem, instruction, 2000);
          try {
            const arrMatch = expandRaw.match(/\[[\s\S]*\]/);
            const expanded = JSON.parse(arrMatch ? arrMatch[0] : expandRaw);
            if (Array.isArray(expanded) && expanded.length >= minLen) {
              lines = expanded.slice(0, minLen).map((x: any) => String(x).trim());
            } else {
              return NextResponse.json({
                error: `Could not expand ${key} to the required ${minLen} items even after a correction attempt.`,
                generator: classification.generator,
              }, { status: 500 });
            }
          } catch {
            return NextResponse.json({
              error: `Could not expand ${key} to the required ${minLen} items -- correction response was malformed.`,
              generator: classification.generator,
            }, { status: 500 });
          }
        }
        // Real fix: join as the newline-separated STRING these
        // generators actually expect, not an array.
        classification.params[key] = lines.join('\n');
      }
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
