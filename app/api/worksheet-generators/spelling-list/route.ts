import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Spelling List Generator (Aj, 2026-07-20), modeled on
// commoncoresheets.com/spelling-list-generator: pick a grade and
// optional topic/pattern, get a grade-appropriate word list. Their own
// guidance is followed directly for word count -- "For younger students
// in kindergarten through second grade, keep lists to 10 words or fewer
// and focus heavily on word families and high-frequency sight words. For
// older students, 15 to 20 words" -- baked into GRADE_DEFAULTS below
// rather than left to the model to guess.
//
// This is the first half of the same two-tool workflow
// commoncoresheets.com describes: "Pair the generated list with our
// Spelling Worksheet Maker to create printable activities... all from
// one word list." The second half here isn't a new worksheet-maker
// clone -- word search, word scramble, ABC order, flashcards, and
// missing-letters generators already exist in this catalog and already
// do exactly that job. This generator's real output is the word list
// itself (shown editable on the results page, not just buried in a PDF)
// with one-click "Send to..." handoffs into those existing generators
// via sessionStorage, matching the prefill pattern already used for
// Schema Lab -> Foldable Shapes.
export const maxDuration = 30;

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GRADE_DEFAULTS: Record<string, { count: number; note: string }> = {
  K: { count: 8, note: 'kindergarten -- simple CVC words and the most common sight words only' },
  '1': { count: 10, note: '1st grade -- short vowel patterns, common word families, high-frequency sight words' },
  '2': { count: 10, note: '2nd grade -- long vowel patterns, common blends/digraphs, some multisyllable words' },
  '3': { count: 15, note: '3rd grade -- more complex vowel patterns, common prefixes/suffixes, multisyllable words' },
  '4': { count: 15, note: '4th grade -- grade-level vocabulary, common Greek/Latin roots, homophones' },
  '5': { count: 18, note: '5th grade -- more advanced vocabulary, prefixes/suffixes, commonly confused words' },
  '6': { count: 20, note: '6th grade -- advanced vocabulary, academic words, Greek/Latin roots' },
  '7': { count: 20, note: '7th grade -- academic and content-area vocabulary, advanced spelling patterns' },
  '8': { count: 20, note: '8th grade -- advanced academic vocabulary appropriate for pre-high-school students' },
};

export async function POST(request: NextRequest) {
  try {
    const { userId, grade = '3', topic = '', wordCount, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const gradeInfo = GRADE_DEFAULTS[String(grade)] || GRADE_DEFAULTS['3'];
    const n = Math.max(5, Math.min(25, parseInt(wordCount, 10) || gradeInfo.count));

    const prompt = `Generate a spelling word list of exactly ${n} words for ${gradeInfo.note}.${topic ? ` Theme/pattern: ${topic} -- every word should genuinely fit this theme or spelling pattern, don't force unrelated words in just to hit the count.` : ' Mix familiar review words with a few new, appropriately challenging ones for this grade.'}
Keep it to real, common, classroom-appropriate English words only -- no proper nouns, no obscure/rare words. Return ONLY a JSON array of the words, lowercase, no other text: ["word1","word2",...]`;

    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] });
    const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '[]';
    // 2026-07-21: extract the [...] array rather than assuming the whole
    // response is JSON (see word-ladders fix, same root cause).
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    const jsonText = arrMatch ? arrMatch[0] : raw.replace(/```json|```/g, '').trim();
    let words: string[] = [];
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) words = parsed.map((w: any) => String(w).toLowerCase().trim()).filter(Boolean);
    } catch { words = []; }
    if (!words.length) return NextResponse.json({ error: 'Could not generate a word list -- try again' }, { status: 500 });

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || `Grade ${grade} Spelling List${topic ? `: ${topic}` : ''}`;

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, `${words.length} words${topic ? ` -- ${topic}` : ''}`, theme);
    let y = PAGE_H - 140, col = 0;
    const colX = [54, 220, 386];
    const startY = y;
    for (let i = 0; i < words.length; i++) {
      if (y < 70) { col++; y = startY; if (col > 2) break; }
      const num = `${i + 1}.`;
      page.drawText(num, { x: colX[col], y, size: 11, font: helv, color: INK });
      page.drawLine({ start: { x: colX[col] + 22, y: y - 2 }, end: { x: colX[col] + 148, y: y - 2 }, thickness: 0.75, color: LINE });
      page.drawText(words[i], { x: colX[col] + 24, y, size: 12, font: helvBold, color: NAVY });
      y -= 26;
    }

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'spelling-list', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`,
        'X-File-Url': encodeURIComponent(fileUrl),
        'X-Word-List': encodeURIComponent(words.join(',')),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
