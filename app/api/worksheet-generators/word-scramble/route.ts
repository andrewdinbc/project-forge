import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, shuffle, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

function scramble(word: string) {
  if (word.length < 2) return word;
  let attempt = word;
  for (let i = 0; i < 10; i++) {
    attempt = shuffle(word.split('')).join('');
    if (attempt.toLowerCase() !== word.toLowerCase()) break;
  }
  return attempt;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, words, title, bundleId } = (await request.json()) || {};
    if (!userId || !words) return NextResponse.json({ error: 'userId and words are required' }, { status: 400 });
    const list = String(words).split('\n').map((w: string) => w.trim()).filter(Boolean);
    if (!list.length) return NextResponse.json({ error: 'Enter at least one word' }, { status: 400 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || 'Word Scramble';

    let page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Unscramble each word and write it on the line.', theme);
    let y = PAGE_H - 140;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (y < 70) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
      const scrambled = scramble(w).toUpperCase();
      page.drawText(`${i + 1}.  ${scrambled}`, { x: 54, y, size: 16, font: helvBold, color: INK });
      page.drawLine({ start: { x: 300, y: y - 3 }, end: { x: PAGE_W - 54, y: y - 3 }, thickness: 1, color: LINE });
      y -= 32;
    }

    const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    let ky = PAGE_H - 90;
    list.forEach((w, i) => {
      keyPage.drawText(`${i + 1}. ${w}`, { x: 54, y: ky, size: 12, font: helv, color: INK });
      ky -= 20;
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'word-scramble', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
