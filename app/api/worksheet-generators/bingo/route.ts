import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, uploadWorksheetPdf, shuffle, PAGE_W, PAGE_H, INK, NAVY } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, words, boardCount = 10, freeSpace = true, title } = (await request.json()) || {};
    if (!userId || !words) return NextResponse.json({ error: 'userId and words are required' }, { status: 400 });
    const list = String(words).split('\n').map((w: string) => w.trim()).filter(Boolean);
    const needed = freeSpace ? 24 : 25;
    if (list.length < needed) return NextResponse.json({ error: `Need at least ${needed} words/facts${freeSpace ? ' (24, since the center is FREE)' : ''} -- you have ${list.length}.` }, { status: 400 });

    const n = Math.max(1, Math.min(40, parseInt(boardCount, 10) || 10));
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Bingo';
    const grid = 5, margin = 60, boardSize = PAGE_W - margin * 2, cell = boardSize / grid;

    for (let b = 0; b < n; b++) {
      const page = doc.addPage([PAGE_W, PAGE_H]);
      page.drawText(docTitle, { x: margin, y: PAGE_H - 50, size: 20, font: helvBold, color: NAVY });
      page.drawText(`Board ${b + 1}`, { x: PAGE_W - margin - 70, y: PAGE_H - 50, size: 11, font: helv, color: rgb(0.5, 0.5, 0.5) });
      const picks = shuffle(list).slice(0, needed);
      let idx = 0;
      const top = PAGE_H - 90;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const x = margin + c * cell, y = top - (r + 1) * cell;
          page.drawRectangle({ x, y, width: cell, height: cell, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });
          const isFree = freeSpace && r === 2 && c === 2;
          const text = isFree ? 'FREE' : picks[idx++];
          const size = text.length > 10 ? 8 : 10;
          const words2 = String(text).split(' ');
          let ty = y + cell / 2 + (words2.length > 1 ? (words2.length - 1) * (size + 2) / 2 : 0);
          for (const w of words2) {
            const tw = helv.widthOfTextAtSize(w, size);
            page.drawText(w, { x: x + (cell - tw) / 2, y: ty, size, font: isFree ? helvBold : helv, color: isFree ? NAVY : INK });
            ty -= size + 2;
          }
        }
      }
    }

    // Calling cards -- one small card per word/fact, to cut apart and draw from.
    const ccCols = 4, ccRows = 8, ccMargin = 30, ccW = (PAGE_W - ccMargin * 2) / ccCols, ccH = (PAGE_H - ccMargin * 2) / ccRows;
    let ccPage: any = null;
    list.forEach((w: string, i: number) => {
      const pos = i % (ccCols * ccRows);
      if (pos === 0) {
        ccPage = doc.addPage([PAGE_W, PAGE_H]);
        ccPage.drawText('Calling Cards', { x: ccMargin, y: PAGE_H - 20, size: 12, font: helvBold, color: NAVY });
      }
      const col = pos % ccCols, row = Math.floor(pos / ccCols);
      const x = ccMargin + col * ccW, y = PAGE_H - ccMargin - 24 - (row + 1) * ccH;
      ccPage.drawRectangle({ x, y, width: ccW, height: ccH, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.75 });
      const size = w.length > 12 ? 8 : 10;
      const tw = helv.widthOfTextAtSize(w, size);
      ccPage.drawText(w, { x: x + Math.max(2, (ccW - tw) / 2), y: y + ccH / 2 - 4, size, font: helv, color: INK });
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'bingo', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
