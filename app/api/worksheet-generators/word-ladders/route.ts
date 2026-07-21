import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Word Ladders (Aj, 2026-07-20): change one letter at a time to turn one
// word into another. Word choice is AI-generated (there's no embedded
// dictionary in this codebase to run a real BFS chain-search against),
// but every candidate chain is structurally verified before it's ever
// shown to a student -- same length throughout, exactly one letter
// different between each consecutive pair, no repeated word -- and
// regenerated (up to 4 attempts) if the model's chain doesn't actually
// satisfy those rules. This is the same "don't trust it, verify it"
// standard the catalog already holds itself to for Sudoku/KenKen
// (backtracking solver) -- here the generation itself is AI (there's no
// dictionary to search), but the STRUCTURE is checked in code, not
// assumed from the model's say-so.
export const maxDuration = 75;  // raised 2026-07-20 alongside MAX_ATTEMPTS 4->8 -- the higher attempt count hit the old 30s ceiling and produced a raw 504 timeout instead of the honest JSON error, worse than the failure it was meant to fix. 75s comfortably covers 8 sequential Claude calls.

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function oneLetterDiff(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs++;
  return diffs === 1;
}

function verifyChain(chain: string[], expectedLength: number): boolean {
  if (!Array.isArray(chain) || chain.length < 3) return false;
  const seen = new Set<string>();
  for (const w of chain) {
    if (typeof w !== 'string' || w.length !== expectedLength) return false;
    const lower = w.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
  }
  for (let i = 0; i < chain.length - 1; i++) {
    if (!oneLetterDiff(chain[i].toLowerCase(), chain[i + 1].toLowerCase())) return false;
  }
  return true;
}

async function generateChain(wordLength: number, rungs: number, topic: string): Promise<string[] | null> {
  const prompt = `Generate a "word ladder" puzzle chain: a sequence of ${rungs} common English words, all exactly ${wordLength} letters long, where each word differs from the previous one by changing EXACTLY ONE letter (same position or a different position -- but only one letter total may change, and the word length must stay the same, no adding/removing letters). Every word must be a real, common, everyday English word appropriate for a school classroom.${topic ? ` If possible, make the first or last word relate to: ${topic} (but every word in between must still be a valid real word -- don't force a bad chain just to hit the theme).` : ''}

Double check your own chain before answering: for each consecutive pair, count the letters that differ -- it must be exactly 1, and both words must be ${wordLength} letters long.

Worked example of a VALID 4-letter chain (for calibration only, do not reuse it): cold -> cord -> word -> ward -> wart. Check: cold->cord differs only at position 2 (l->r). cord->word differs only at position 1 (c->w). word->ward differs only at position 2 (o->a). ward->wart differs only at position 4 (d->t). Every word is a real 4-letter word. Follow this exact standard of verification for your own chain.

Return ONLY a JSON array of the words in order, lowercase, nothing else: ["word1","word2",...]`;

  const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] });
  const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '[]';
  // Real bug found 2026-07-21: despite "Return ONLY a JSON array, nothing
  // else", the model reliably shows its step-by-step verification work
  // first (the "double check your own chain" instruction essentially
  // invites this) and puts the actual array at the end -- e.g. "I need to
  // create a word ladder...\n\n[\"cat\",\"hat\",\"hot\",\"dot\"]". The old
  // code did JSON.parse on the ENTIRE raw string, which fails immediately
  // on the leading prose ("Unexpected token 'I'...") on effectively every
  // call -- this made the feature look like a hard/unsolvable generation
  // problem (100% failure even on trivial 3-letter chains) when the model
  // was actually succeeding almost every time; only the extraction was
  // broken. Pull just the JSON array out of the response instead of
  // assuming the whole response is JSON.
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  const jsonText = arrayMatch ? arrayMatch[0] : raw.replace(/```json|```/g, '').trim();
  try {
    const chain = JSON.parse(jsonText);
    return Array.isArray(chain) ? chain.map((w: string) => String(w).toLowerCase()) : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, wordLength = 4, rungs = 5, topic = '', title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const len = Math.max(3, Math.min(6, parseInt(wordLength, 10) || 4));
    const n = Math.max(4, Math.min(8, parseInt(rungs, 10) || 5));

    let chain: string[] | null = null;
    const MAX_ATTEMPTS = 8;  // Kept at 8 as a safety margin even after the 2026-07-21 parsing fix (see generateChain) -- the real bug was JSON extraction, not generation difficulty, but retries are cheap insurance against occasional genuine failures.
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !chain; attempt++) {
      const candidate = await generateChain(len, n, topic?.trim());
      if (candidate && verifyChain(candidate, len)) chain = candidate;
    }
    if (!chain) return NextResponse.json({ error: `Could not generate a valid ${len}-letter word ladder after ${MAX_ATTEMPTS} attempts -- try a different word length or fewer rungs.` }, { status: 500 });

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || `Word Ladder: ${chain[0].toUpperCase()} to ${chain[chain.length - 1].toUpperCase()}`;  // fixed 2026-07-20: was U+2192 (rightarrow), not in WinAnsi -- this docTitle gets drawn via page.drawText in addThemedWorksheetPage, so it was a latent crash waiting for a successful chain generation to trigger it

    const drawLadder = (page: any, showAnswers: boolean) => {
      const rowH = 46, boxSize = 30, top = PAGE_H - 170;
      const totalW = len * boxSize;
      const left = (PAGE_W - totalW) / 2;
      for (let r = 0; r < chain.length; r++) {
        const y = top - r * rowH;
        const isEndpoint = r === 0 || r === chain.length - 1;
        for (let c = 0; c < len; c++) {
          const x = left + c * boxSize;
          page.drawRectangle({ x, y: y - boxSize, width: boxSize, height: boxSize, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: isEndpoint ? 1.5 : 0.75, color: isEndpoint ? rgb(0.96, 0.94, 0.99) : undefined });
          if (isEndpoint || showAnswers) {
            const ch = chain[r][c].toUpperCase();
            const fs = 15;
            const tw = helvBold.widthOfTextAtSize(ch, fs);
            page.drawText(ch, { x: x + (boxSize - tw) / 2, y: y - boxSize + 8, size: fs, font: helvBold, color: isEndpoint ? NAVY : INK });
          }
        }
        // Rung number label to the left.
        page.drawText(isEndpoint ? (r === 0 ? 'START' : 'END') : `${r}.`, { x: left - 55, y: y - boxSize + 10, size: 9, font: isEndpoint ? helvBold : helv, color: isEndpoint ? NAVY : INK });
      }
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, `Change one letter at a time to turn ${chain[0].toUpperCase()} into ${chain[chain.length - 1].toUpperCase()}. Each step changes exactly one letter and must spell a real word.`, theme);
    drawLadder(page, false);

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawLadder(keyPage, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'word-ladders', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

