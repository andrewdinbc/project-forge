import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, GRAY, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { rgb, degrees } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Cipher Wheels: Secret Code Facts (Aj, 2026-07-20). A real cut-out
// rotating cipher disk -- two concentric rings of the alphabet, an outer
// ring fixed and an inner ring shifted by N letters, meant to be cut out
// and joined at the center with a paper fastener so the inner wheel can
// actually rotate. Comes with a set of facts encoded with that same
// shift for students to decode by dialing their wheel to the shift shown
// and reading letter-for-letter. Every letter position is computed
// analytically (angle = index * 360/26 around the circle, degrees()
// rotation on each drawn character) -- not a stock image of a wheel.
export const maxDuration = 30;

const admin: any = supabaseAdmin;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const FACT_BANK: Record<string, string[]> = {
  animals: [
    'A GROUP OF LIONS IS CALLED A PRIDE',
    'OCTOPUSES HAVE THREE HEARTS',
    'A SNAIL CAN SLEEP FOR THREE YEARS',
    'ELEPHANTS ARE THE ONLY MAMMALS THAT CANNOT JUMP',
    'A SHRIMP CAN CLAP ITS CLAWS FASTER THAN A BULLET',
    'BUTTERFLIES TASTE WITH THEIR FEET',
  ],
  space: [
    'ONE DAY ON VENUS IS LONGER THAN ITS YEAR',
    'THE SUN MAKES UP MOST OF THE MASS IN OUR SOLAR SYSTEM',
    'A YEAR ON MERCURY IS EIGHTY EIGHT DAYS',
    'SATURN COULD FLOAT IN WATER',
    'THERE ARE MORE STARS THAN GRAINS OF SAND ON EARTH',
  ],
  general: [
    'HONEY NEVER SPOILS IF STORED PROPERLY',
    'A GROUP OF FLAMINGOS IS CALLED A FLAMBOYANCE',
    'BANANAS ARE BERRIES BUT STRAWBERRIES ARE NOT',
    'THE SHORTEST WAR IN HISTORY LASTED LESS THAN AN HOUR',
    'A BOLT OF LIGHTNING IS HOTTER THAN THE SURFACE OF THE SUN',
  ],
};

function caesarShift(text: string, shift: number): string {
  return text
    .split('')
    .map((ch) => {
      if (ch < 'A' || ch > 'Z') return ch;
      const idx = ch.charCodeAt(0) - 65;
      return ALPHABET[(idx + shift + 26) % 26];
    })
    .join('');
}

export async function POST(request: NextRequest) {
  try {
    const { userId, shift, topic = 'general', title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const n = Math.max(1, Math.min(25, parseInt(shift, 10) || 3 + Math.floor(Math.random() * 5)));
    const bank = FACT_BANK[topic] || FACT_BANK.general;
    const facts = [...bank].sort(() => Math.random() - 0.5).slice(0, 4);

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Cipher Wheel: Secret Code Facts';

    const drawRing = (page: any, cx: number, cy: number, radius: number, textRadius: number, shiftAmount: number, dashed: boolean) => {
      // Outer cut-line circle -- approximated with short straight segments
      // since pdf-lib has no native dashed-circle primitive.
      const segments = 72;
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * 2 * Math.PI, a2 = ((i + (dashed ? 0.6 : 1)) / segments) * 2 * Math.PI;
        page.drawLine({
          start: { x: cx + radius * Math.sin(a1), y: cy + radius * Math.cos(a1) },
          end: { x: cx + radius * Math.sin(a2), y: cy + radius * Math.cos(a2) },
          thickness: 1, color: rgb(0.3, 0.3, 0.3),
        });
      }
      for (let i = 0; i < 26; i++) {
        const angleDeg = (i * 360) / 26;
        const angleRad = (angleDeg * Math.PI) / 180;
        const letter = ALPHABET[(i + shiftAmount + 26) % 26];
        const lx = cx + textRadius * Math.sin(angleRad), ly = cy + textRadius * Math.cos(angleRad);
        const fs = 11;
        const tw = helvBold.widthOfTextAtSize(letter, fs);
        // Rotate each letter so its "up" points radially outward from
        // center (standard cipher-wheel dial style, readable from the
        // rim inward). PDF rotation is counter-clockwise-positive; our
        // angle is measured clockwise from the top, so negate it.
        page.drawText(letter, {
          x: lx - (tw / 2) * Math.cos((angleRad)), y: ly - (tw / 2) * Math.sin(angleRad),
          size: fs, font: helvBold, color: INK, rotate: degrees(-angleDeg),
        });
      }
    };

    // ---- Page 1: the wheel itself + assembly instructions ----
    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, `Cut out both circles, stack the smaller one on top of the larger one, and poke a brad fastener through both centers so the inner wheel can spin freely. To decode a message: find each secret letter on the INNER wheel, then read the matching letter straight across on the OUTER wheel -- that's the real letter.`, theme);
    const cx = PAGE_W / 2, cy = PAGE_H - 420;
    drawRing(page, cx, cy, 170, 148, 0, true); // outer ring: plain alphabet, cut line at r=170
    drawRing(page, cx, cy, 100, 78, n, true); // inner ring: shifted alphabet, cut line at r=100
    page.drawCircle({ x: cx, y: cy, size: 4, color: rgb(0.2, 0.2, 0.2) }); // center fastener hole marker
    const shiftLabel = `Shift = ${n}  (as printed -- once assembled, the inner wheel spins freely for any shift)`;
    const lw = helvBold.widthOfTextAtSize(shiftLabel, 12);
    page.drawText(shiftLabel, { x: (PAGE_W - lw) / 2, y: cy - 200, size: 12, font: helvBold, color: NAVY });

    // ---- Page 2: encoded facts to decode ----
    const factsPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, factsPage, theme);
    factsPage.drawText(`${docTitle} -- Decode These Facts`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    factsPage.drawText(`Find each letter below on your wheel's INNER ring, then read the OUTER ring at that same spot to get the real letter.`, { x: 54, y: PAGE_H - 78, size: 10, font: helv, color: GRAY });
    let fy = PAGE_H - 120;
    facts.forEach((fact, i) => {
      const encoded = caesarShift(fact, n);
      factsPage.drawText(`${i + 1}. ${encoded}`, { x: 54, y: fy, size: 12, font: helvBold, color: rgb(0.5, 0.15, 0.15) });
      fy -= 22;
      factsPage.drawLine({ start: { x: 54, y: fy }, end: { x: PAGE_W - 54, y: fy }, thickness: 0.75, color: rgb(0.7, 0.7, 0.7) });
      fy -= 30;
    });

    // ---- Answer key ----
    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    let ky = PAGE_H - 100;
    facts.forEach((fact, i) => {
      keyPage.drawText(`${i + 1}. ${fact}`, { x: 54, y: ky, size: 11, font: helv, color: INK });
      ky -= 22;
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'cipher-wheels', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
