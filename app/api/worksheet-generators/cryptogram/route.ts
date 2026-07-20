import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, shuffle, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function buildCipher() {
  // Map each letter to a number 1-26, no letter maps to its own position.
  let nums = shuffle(ALPHABET.map((_, i) => i + 1));
  let attempts = 0;
  while (nums.some((n, i) => n === i + 1) && attempts < 50) { nums = shuffle(nums); attempts++; }
  const map: Record<string, number> = {};
  ALPHABET.forEach((letter, i) => { map[letter] = nums[i]; });
  return map;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, phrase, title, bundleId } = (await request.json()) || {};
    if (!userId || !phrase || !String(phrase).trim()) return NextResponse.json({ error: 'userId and phrase are required' }, { status: 400 });

    const cipher = buildCipher();
    const clean = String(phrase).toUpperCase();
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || 'Cryptogram';

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Use the number under each letter to decode the message. Each number always stands for the same letter.', theme);
    const startX = 54, maxWidth = PAGE_W - 108;
    const cellW = 20;
    let x = startX, y = PAGE_H - 150;
    for (const ch of clean) {
      if (x + cellW > startX + maxWidth) { x = startX; y -= 46; }
      if (y < 200) break; // leave room for the legend below
      if (/[A-Z]/.test(ch)) {
        page.drawText(ch === ' ' ? '' : '_', { x, y, size: 16, font: helvBold, color: INK });
        page.drawText(String(cipher[ch]), { x, y: y - 16, size: 9, font: helv, color: INK });
      } else if (ch === ' ') {
        x += cellW / 2;
        continue;
      } else {
        page.drawText(ch, { x, y, size: 16, font: helvBold, color: INK });
      }
      x += cellW;
    }

    // Legend: number -> blank, for the student to fill in as they solve.
    let ly = 160;
    page.drawText('Number Key:', { x: 54, y: ly, size: 11, font: helvBold, color: NAVY });
    ly -= 20;
    const perRow = 13;
    for (let i = 1; i <= 26; i++) {
      const col = (i - 1) % perRow, row = Math.floor((i - 1) / perRow);
      const lx = 54 + col * ((PAGE_W - 108) / perRow);
      page.drawText(String(i), { x: lx, y: ly - row * 26, size: 9, font: helv, color: INK });
      page.drawLine({ start: { x: lx - 2, y: ly - row * 26 - 12 }, end: { x: lx + 14, y: ly - row * 26 - 12 }, thickness: 0.75, color: LINE });
    }

    // Answer key
    const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    keyPage.drawText(clean, { x: 54, y: PAGE_H - 90, size: 12, font: helv, color: INK });
    let kky = PAGE_H - 130;
    keyPage.drawText('Cipher:', { x: 54, y: kky, size: 11, font: helvBold, color: NAVY });
    kky -= 20;
    ALPHABET.forEach((letter, i) => {
      const col = i % 13, row = Math.floor(i / 13);
      const lx = 54 + col * ((PAGE_W - 108) / 13);
      keyPage.drawText(`${letter}=${cipher[letter]}`, { x: lx, y: kky - row * 20, size: 9, font: helv, color: INK });
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'cryptogram', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
