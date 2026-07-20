import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, wrapLines, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TYPE_PROMPTS: Record<string, (count: number, topic: string, grade: string) => string> = {
  brain_teaser: (count, topic, grade) => `Write ${count} original brain-teaser riddles${grade ? ` for ${grade} students` : ''}${topic ? `, themed around: ${topic}` : ''}. Each should be a short, mind-bending critical-thinking puzzle with one clear correct answer (not wordplay that's ambiguous). Return ONLY JSON: [{"riddle": "...", "answer": "..."}]`,
  what_am_i: (count, topic, grade) => `Write ${count} original "What Am I?" riddles${grade ? ` for ${grade} students` : ''}${topic ? `, themed around: ${topic}` : ''}. Each is 3-4 short first-person clue sentences ending in "What am I?", describing an object/animal/place, with one clear answer. Return ONLY JSON: [{"riddle": "...", "answer": "..."}]`,
  analogy: (count, topic, grade) => `Write ${count} original analogy questions${grade ? ` for ${grade} students` : ''}${topic ? `, themed around: ${topic}` : ''}, in the form "A is to B as C is to ___". Provide 4 multiple-choice options (one correct). Return ONLY JSON: [{"prompt": "Hot is to Cold as Up is to ___", "options": ["Down","Left","Warm","Sky"], "correctIndex": 0}]`,
};
const TYPE_TITLES: Record<string, string> = { brain_teaser: 'Brain Teasers', what_am_i: 'What Am I? Challenges', analogy: 'Logic: Analogies' };

export async function POST(request: NextRequest) {
  try {
    const { userId, type, count = 8, topic = '', grade = '', title, bundleId } = (await request.json()) || {};
    if (!userId || !type || !TYPE_PROMPTS[type]) return NextResponse.json({ error: 'userId and a valid type are required' }, { status: 400 });
    const n = Math.max(3, Math.min(15, parseInt(count, 10) || 8));

    const prompt = TYPE_PROMPTS[type](n, topic?.trim(), grade?.trim());
    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] });
    const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '[]';
    let items: any[] = [];
    try { items = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { items = []; }
    if (!items.length) return NextResponse.json({ error: 'Could not generate puzzles -- try again' }, { status: 500 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || TYPE_TITLES[type];
    let page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, undefined, theme);
    let y = PAGE_H - 130;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (y < 100) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
      if (type === 'analogy') {
        for (const line of wrapLines(`${i + 1}. ${item.prompt}`, helvBold, 12, PAGE_W - 108)) {
          page.drawText(line, { x: 54, y, size: 12, font: helvBold, color: INK }); y -= 17;
        }
        (item.options || []).forEach((opt: string, j: number) => {
          page.drawText(`   ${'ABCD'[j]}) ${opt}`, { x: 64, y, size: 11, font: helv, color: INK }); y -= 16;
        });
        y -= 10;
      } else {
        for (const line of wrapLines(`${i + 1}. ${item.riddle}`, helv, 12, PAGE_W - 108)) {
          page.drawText(line, { x: 54, y, size: 12, font: helv, color: INK }); y -= 17;
        }
        page.drawLine({ start: { x: 70, y: y - 4 }, end: { x: PAGE_W - 54, y: y - 4 }, thickness: 0.75, color: LINE });
        y -= 26;
      }
    }

    const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    let ky = PAGE_H - 90;
    items.forEach((item, i) => {
      if (ky < 60) return;
      const answer = type === 'analogy' ? `${'ABCD'[item.correctIndex] || '?'} (${item.options?.[item.correctIndex] || ''})` : item.answer;
      keyPage.drawText(`${i + 1}. ${answer}`, { x: 54, y: ky, size: 11, font: helv, color: INK });
      ky -= 20;
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'text-puzzle', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
