import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, shuffle, PAGE_W, PAGE_H, INK, NAVY, LINE, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, words, title, bundleId } = (await request.json()) || {};
    if (!userId || !words) return NextResponse.json({ error: 'userId and words are required' }, { status: 400 });
    const list = String(words).split('\n').map((w: string) => w.trim()).filter(Boolean);
    if (list.length < 2) return NextResponse.json({ error: 'Enter at least 2 words' }, { status: 400 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || 'ABC Order';
    const scrambled = shuffle(list);

    // Page 1: cut-out word bank + numbered blanks to glue in order.
    let page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Cut out the words below, put them in ABC order, and glue them next to the matching number.', theme);
    let y = PAGE_H - 150;
    const cols = 3, colW = (PAGE_W - 108) / cols;
    scrambled.forEach((w, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 54 + col * colW, cy = y - row * 30;
      page.drawRectangle({ x, y: cy - 18, width: colW - 10, height: 22, borderColor: LINE, borderWidth: 1 });
      const size = 11;
      const tw = helv.widthOfTextAtSize(w, size);
      page.drawText(w, { x: x + Math.max(4, (colW - 10 - tw) / 2), y: cy - 12, size, font: helv, color: INK });
    });
    y -= Math.ceil(scrambled.length / cols) * 30 + 20;

    if (y < 200) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
    page.drawText('Put them in ABC order:', { x: 54, y, size: 12, font: helvBold, color: NAVY });
    y -= 26;
    for (let i = 0; i < list.length; i++) {
      if (y < 60) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
      page.drawText(`${i + 1}.`, { x: 54, y, size: 11, font: helv, color: INK });
      page.drawLine({ start: { x: 78, y: y - 3 }, end: { x: PAGE_W - 54, y: y - 3 }, thickness: 1, color: LINE });
      y -= 26;
    }

    // Answer key
    const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    const sorted = [...list].sort((a, b) => a.localeCompare(b));
    let ky = PAGE_H - 90;
    sorted.forEach((w, i) => {
      keyPage.drawText(`${i + 1}. ${w}`, { x: 54, y: ky, size: 12, font: helv, color: INK });
      ky -= 20;
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'abc-order', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
