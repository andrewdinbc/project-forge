import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, shuffle, randInt, PAGE_W, PAGE_H, INK, NAVY, LINE, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

function blankWord(word: string) {
  const letters = word.split('');
  const blankCount = Math.max(1, Math.round(letters.length * 0.35));
  const indices = shuffle(letters.map((_, i) => i)).slice(0, blankCount);
  const blanked = letters.map((ch, i) => (indices.includes(i) ? '_' : ch));
  return blanked.join('');
}

export async function POST(request: NextRequest) {
  try {
    const { userId, words, title, bundleId } = (await request.json()) || {};
    if (!userId || !words) return NextResponse.json({ error: 'userId and words are required' }, { status: 400 });
    const list = String(words).split('\n').map((w: string) => w.trim()).filter(Boolean);
    if (!list.length) return NextResponse.json({ error: 'Enter at least one word' }, { status: 400 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || 'Missing Letters';

    let page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Fill in the missing letters. Use the word bank if you need help.', theme);
    let y = PAGE_H - 140;
    page.drawText('Word Bank:', { x: 54, y, size: 11, font: helvBold, color: NAVY });
    y -= 16;
    const bank = shuffle(list).join('   •   ');
    page.drawText(bank, { x: 54, y, size: 10, font: helv, color: INK });
    y -= 30;

    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (y < 70) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
      const blanked = blankWord(w);
      page.drawText(`${i + 1}.  ${blanked.split('').join(' ')}`, { x: 54, y, size: 16, font: helvBold, color: INK });
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
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'missing-letters', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
