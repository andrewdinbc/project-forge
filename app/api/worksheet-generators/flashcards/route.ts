import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, wrapLines, PAGE_W, PAGE_H, INK, NAVY } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

function parseLines(raw: string) {
  return String(raw || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [front, back] = line.split('|').map((s) => s.trim());
      return { front, back: back || null };
    });
}

const COLORS: any = {
  navy: rgb(0.11, 0.21, 0.34), green: rgb(0.18, 0.42, 0.25), purple: rgb(0.48, 0.24, 0.54),
  gold: rgb(0.63, 0.49, 0.16), red: rgb(0.65, 0.2, 0.2), black: rgb(0.1, 0.1, 0.1),
};

export async function POST(request: NextRequest) {
  try {
    const { userId, words, color = 'navy', title, bundleId } = (await request.json()) || {};
    if (!userId || !words) return NextResponse.json({ error: 'userId and words are required' }, { status: 400 });
    const cards = parseLines(words);
    if (!cards.length) return NextResponse.json({ error: 'Enter at least one word' }, { status: 400 });

    const { doc, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const ink = COLORS[color] || COLORS.navy;
    const cols = 2, rows = 4, margin = 40;
    const cardW = (PAGE_W - margin * 2) / cols, cardH = (PAGE_H - margin * 2) / rows;
    const docTitle = title?.trim() || 'Flashcards';

    const drawDeck = async (getText: (c: any) => string | null) => {
      let page: any = null;
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const pos = i % (cols * rows);
        if (pos === 0) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); }
        const col = pos % cols, row = Math.floor(pos / cols);
        const x = margin + col * cardW, y = PAGE_H - margin - (row + 1) * cardH;
        page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
        const text = getText(c);
        if (text) {
          const size = text.length > 14 ? 16 : 22;
          const lines = wrapLines(text, helvBold, size, cardW - 24);
          let ty = y + cardH / 2 + ((lines.length - 1) * (size + 4)) / 2;
          for (const line of lines) {
            const w = helvBold.widthOfTextAtSize(line, size);
            page.drawText(line, { x: x + (cardW - w) / 2, y: ty, size, font: helvBold, color: ink });
            ty -= size + 4;
          }
        }
      }
    };

    await drawDeck((c) => c.front);
    const hasBacks = cards.some((c) => c.back);
    if (hasBacks) await drawDeck((c) => c.back || '');

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'flashcards', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
