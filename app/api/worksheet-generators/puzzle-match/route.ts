import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, uploadWorksheetPdf, shuffle, randInt, PAGE_W, PAGE_H, INK, NAVY } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

function makeProblem(op: string) {
  if (op === 'addition') { const a = randInt(1, 12), b = randInt(1, 12); return { text: `${a} + ${b}`, answer: a + b }; }
  if (op === 'subtraction') { const a = randInt(5, 20), b = randInt(1, a); return { text: `${a} - ${b}`, answer: a - b }; }
  if (op === 'division') { const b = randInt(2, 10), ans = randInt(2, 10); return { text: `${b * ans} ÷ ${b}`, answer: ans }; }
  const a = randInt(1, 12), b = randInt(1, 12); return { text: `${a} x ${b}`, answer: a * b }; // multiplication default
}

export async function POST(request: NextRequest) {
  try {
    const { userId, operation = 'multiplication', count = 16, title } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const n = Math.max(6, Math.min(24, parseInt(count, 10) || 16));

    // Guarantee unique answers so the matching game has exactly one correct pair per card.
    const seen = new Set<number>();
    const problems: { text: string; answer: number }[] = [];
    let guard = 0;
    while (problems.length < n && guard < n * 20) {
      guard++;
      const p = makeProblem(operation);
      if (seen.has(p.answer)) continue;
      seen.add(p.answer);
      problems.push(p);
    }

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Puzzle Match';
    const cols = 4, rows = 6, margin = 40;
    const cardW = (PAGE_W - margin * 2) / cols, cardH = (PAGE_H - margin * 2) / rows;

    const drawCards = (items: { text: string }[], heading: string) => {
      let page: any = null;
      items.forEach((item, i) => {
        const pos = i % (cols * rows);
        if (pos === 0) { page = doc.addPage([PAGE_W, PAGE_H]); page.drawText(heading, { x: margin, y: PAGE_H - 24, size: 12, font: helvBold, color: NAVY }); }
        const col = pos % cols, row = Math.floor(pos / cols);
        const x = margin + col * cardW, y = PAGE_H - margin - 20 - (row + 1) * cardH;
        page.drawRectangle({ x, y, width: cardW - 6, height: cardH - 6, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 1 });
        const text = String(item.text);
        const size = text.length > 8 ? 13 : 16;
        const tw = helvBold.widthOfTextAtSize(text, size);
        page.drawText(text, { x: x + (cardW - 6 - tw) / 2, y: y + (cardH - 6) / 2 - 6, size, font: helvBold, color: INK });
      });
    };

    drawCards(problems.map((p) => ({ text: p.text })), `${docTitle} -- Problem Cards (cut apart)`);
    drawCards(shuffle(problems.map((p) => ({ text: String(p.answer) }))), `${docTitle} -- Answer Cards (cut apart)`);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'puzzle-match', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
