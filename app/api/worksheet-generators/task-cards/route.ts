import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { newWorksheetDoc, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, wrapLines, PAGE_W, PAGE_H, INK, NAVY, asciiSafeFilename } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Task Cards (2026-07-21) -- a real gap, not a testing miss: this
// product type didn't exist anywhere in the catalog or codebase before
// this. Standard TPT format: a set of small cut-apart cards, each with
// one question/task, used for stations, "SCOOT" games, task rotations,
// or early finishers -- distinct from Flashcards (front/back pairs,
// meant to be quizzed one at a time) and from Quiz (teacher supplies
// finished questions; this generates them from a topic).

export async function POST(request: NextRequest) {
  try {
    const { userId, topic = '', grade = '', subject = '', count = 24, title, bundleId } = (await request.json()) || {};
    if (!userId || !topic?.trim()) return NextResponse.json({ error: 'userId and topic are required' }, { status: 400 });
    const n = Math.max(8, Math.min(32, parseInt(String(count), 10) || 24));

    const prompt = `Write ${n} short task-card prompts for a classroom set of task cards${grade ? ` for ${grade} students` : ''}${subject ? `, ${subject}` : ''}, themed around: ${topic}.
Each card should be a single, self-contained question, problem, or short task a student can answer in a sentence or two while rotating through stations -- not a riddle, not multiple choice, just a direct question or task appropriate to the grade level. Vary the type of thinking required (recall, explain, compare, apply) across the set rather than repeating the same question shape ${n} times.
Return ONLY a JSON array, no other text: [{"task": "...", "answer": "..."}]`;

    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] });
    const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '[]';
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    const jsonText = arrMatch ? arrMatch[0] : raw.replace(/```json|```/g, '').trim();
    let cards: any[] = [];
    try { cards = JSON.parse(jsonText); } catch { cards = []; }
    if (!cards.length) return NextResponse.json({ error: 'Could not generate task cards -- try again' }, { status: 500 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || `${topic} Task Cards`;

    const cols = 2, rows = 3, margin = 40;
    const cardW = (PAGE_W - margin * 2) / cols, cardH = (PAGE_H - margin * 2) / rows;

    let page: any = null;
    for (let i = 0; i < cards.length; i++) {
      const pos = i % (cols * rows);
      if (pos === 0) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); }
      const col = pos % cols, row = Math.floor(pos / cols);
      const x = margin + col * cardW, y = PAGE_H - margin - (row + 1) * cardH;

      page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1, borderDashArray: [4, 3] });
      // Number badge
      page.drawCircle({ x: x + 22, y: y + cardH - 22, size: 12, color: rgb(0.71, 0.55, 0.16) });
      const numStr = String(i + 1);
      const numW = helvBold.widthOfTextAtSize(numStr, 11);
      page.drawText(numStr, { x: x + 22 - numW / 2, y: y + cardH - 26, size: 11, font: helvBold, color: rgb(1, 1, 1) });

      const lines = wrapLines(cards[i].task || '', helv, 12, cardW - 32);
      let ty = y + cardH / 2 + ((lines.length - 1) * 15) / 2;
      for (const line of lines) {
        const w = helv.widthOfTextAtSize(line, 12);
        page.drawText(line, { x: x + (cardW - w) / 2, y: ty, size: 12, font: helv, color: INK });
        ty -= 15;
      }
    }

    // Answer key
    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    let ky = PAGE_H - 90;
    cards.forEach((c, i) => {
      if (ky < 60) return;
      for (const line of wrapLines(`${i + 1}. ${c.answer || ''}`, helv, 11, PAGE_W - 108)) {
        keyPage.drawText(line, { x: 54, y: ky, size: 11, font: helv, color: INK });
        ky -= 16;
      }
      ky -= 4;
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'task-cards', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
