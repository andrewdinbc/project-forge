import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, randInt, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Builds a problem whose answer equals `target` (1-26), varying the
// operation so the sheet isn't all addition.
function problemFor(target: number) {
  const op = randInt(0, 2);
  if (op === 0) { const b = randInt(1, Math.max(1, target - 1)); return { text: `${target - b} + ${b}` }; }
  if (op === 1) { const b = randInt(1, 10); return { text: `${target + b} - ${b}` }; }
  const factors = [];
  for (let f = 2; f <= Math.min(9, target); f++) if (target % f === 0) factors.push(f);
  if (factors.length) { const f = factors[randInt(0, factors.length - 1)]; return { text: `${f} x ${target / f}` }; }
  return { text: `${target} + 0` };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, topic = '', grade = '', title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const prompt = `Write one original, short, kid-friendly joke or riddle${grade ? ` for ${grade} students` : ''}${topic ? `, themed around: ${topic}` : ''}. The answer/punchline must be SHORT (2-4 words, letters only, no numbers or punctuation). Return ONLY JSON: {"question": "...", "answer": "PUNCHLINE IN CAPS"}`;
    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
    const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
    let joke: any = {};
    try { joke = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { joke = {}; }
    const answer = String(joke.answer || 'GOOD JOB').toUpperCase().replace(/[^A-Z ]/g, '');
    if (!answer.trim()) return NextResponse.json({ error: 'Could not generate a riddle -- try again' }, { status: 500 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || 'Math Riddle';
    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Solve each problem, then use the key to decode the answer.', theme);
    let y = PAGE_H - 140;

    page.drawText(joke.question || 'Solve the riddle:', { x: 54, y, size: 12, font: helvBold, color: NAVY });
    y -= 30;

    const chars = answer.split('');
    const cellW = 34;
    let x = 54;
    chars.forEach((ch) => {
      if (x + cellW > PAGE_W - 54) { x = 54; y -= 60; }
      if (ch === ' ') { x += cellW / 2; return; }
      const letterPos = ALPHABET.indexOf(ch) + 1;
      const p = problemFor(letterPos);
      const tw = helv.widthOfTextAtSize(p.text, 9);
      page.drawText(p.text, { x: x + (cellW - tw) / 2, y: y + 16, size: 9, font: helv, color: INK });
      page.drawLine({ start: { x, y }, end: { x: x + cellW - 8, y }, thickness: 1, color: LINE });
      x += cellW;
    });

    y -= 60;
    page.drawText('Number Key: 1=A 2=B 3=C 4=D 5=E 6=F 7=G 8=H 9=I 10=J 11=K 12=L 13=M', { x: 54, y, size: 8, font: helv, color: NAVY });
    y -= 14;
    page.drawText('14=N 15=O 16=P 17=Q 18=R 19=S 20=T 21=U 22=V 23=W 24=X 25=Y 26=Z', { x: 54, y, size: 8, font: helv, color: NAVY });

    const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    keyPage.drawText(joke.question || '', { x: 54, y: PAGE_H - 90, size: 11, font: helv, color: INK });
    keyPage.drawText(answer, { x: 54, y: PAGE_H - 120, size: 14, font: helvBold, color: NAVY });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'math-riddle', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
