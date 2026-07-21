import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, GRAY, LINE } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Spelling Test / Practice Sheet (Aj, 2026-07-20). Two real, distinct
// formats from one word list, matching the two things
// commoncoresheets.com's Spelling Worksheet Maker actually produces that
// nothing else in this catalog does yet (word search/scramble/ABC order/
// flashcards/missing-letters already cover the rest of that toolset):
//   - A dictation TEST page: numbered blank lines only, no words shown,
//     for a teacher to read words aloud and students to write what they
//     hear -- the actual "spelling test" format.
//   - A "Look, Say, Cover, Write, Check" practice page: the classic
//     5-column self-study format (word shown once, three blank practice
//     columns, then a final check column) used in real classrooms for
//     independent spelling practice.
export const maxDuration = 30;

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, words, mode = 'both', title, bundleId } = (await request.json()) || {};
    if (!userId || !words) return NextResponse.json({ error: 'userId and words are required' }, { status: 400 });
    const list = String(words).split('\n').map((w: string) => w.trim()).filter(Boolean);
    if (!list.length) return NextResponse.json({ error: 'Enter at least one word' }, { status: 400 });

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Spelling';

    if (mode === 'test' || mode === 'both') {
      const page = await addThemedWorksheetPage(doc, helvBold, helv, `${docTitle} -- Spelling Test`, 'Listen carefully and write each word as it is read aloud.', theme);
      let y = PAGE_H - 150;
      for (let i = 0; i < list.length; i++) {
        if (y < 70) break; // honest cap -- a test page only has room for so many; excess words still appear on the practice page
        page.drawText(`${i + 1}.`, { x: 54, y, size: 12, font: helv, color: INK });
        page.drawLine({ start: { x: 80, y: y - 2 }, end: { x: PAGE_W - 54, y: y - 2 }, thickness: 0.75, color: LINE });
        y -= 32;
      }
    }

    if (mode === 'practice' || mode === 'both') {
      const page = doc.addPage([PAGE_W, PAGE_H]);
      await drawThemeBorder(doc, page, theme);
      page.drawText(`${docTitle} -- Look, Say, Cover, Write, Check`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
      page.drawText('For each word: LOOK at it closely. SAY it out loud. COVER it up. WRITE it from memory. CHECK your spelling.', { x: 54, y: PAGE_H - 78, size: 9, font: helv, color: GRAY });

      const colLabels = ['Word', 'Write 1', 'Write 2', 'Write 3', 'Check'];  // fixed 2026-07-20: dropped the \u2713 checkmark -- not encodable in pdf-lib's WinAnsi StandardFonts, crashed every generation in 'test'/'both' mode (the default)
      const tableLeft = 54, tableTop = PAGE_H - 100, tableW = PAGE_W - 108;
      const colW = [tableW * 0.24, tableW * 0.19, tableW * 0.19, tableW * 0.19, tableW * 0.19];
      const rowH = Math.min(34, (tableTop - 60) / (list.length + 1));

      let x = tableLeft;
      for (let c = 0; c < colLabels.length; c++) {
        page.drawRectangle({ x, y: tableTop - rowH, width: colW[c], height: rowH, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1, color: rgb(0.93, 0.9, 0.97) });
        const tw = helvBold.widthOfTextAtSize(colLabels[c], 9);
        page.drawText(colLabels[c], { x: x + (colW[c] - tw) / 2, y: tableTop - rowH / 2 - 4, size: 9, font: helvBold, color: NAVY });
        x += colW[c];
      }

      for (let r = 0; r < list.length; r++) {
        const rowY = tableTop - rowH * (r + 2);
        if (rowY < 50) break; // honest cap -- long lists get a "and more" note below instead of running off the page
        x = tableLeft;
        for (let c = 0; c < colLabels.length; c++) {
          page.drawRectangle({ x, y: rowY, width: colW[c], height: rowH, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.75 });
          x += colW[c];
        }
        page.drawText(list[r], { x: tableLeft + 8, y: rowY + rowH / 2 - 4, size: 11, font: helvBold, color: INK });
      }

      const shown = Math.min(list.length, Math.floor((tableTop - 60) / rowH) - 1);
      if (shown < list.length) {
        page.drawText(`+ ${list.length - shown} more word(s) -- see the full list on the Spelling List page.`, { x: 54, y: 40, size: 9, font: helv, color: GRAY });
      }
    }

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'spelling-test', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

