import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, randInt, wrapLines, PAGE_W, PAGE_H, INK, NAVY, LINE, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export async function POST(request: NextRequest) {
  try {
    const { userId, subject, min = 1, max = 100, grade = '', title, bundleId } = (await request.json()) || {};
    if (!userId || !subject) return NextResponse.json({ error: 'userId and subject are required' }, { status: 400 });

    let prompt: string, docTitle: string, subtitle: string;
    let numberTarget: number | null = null;
    if (subject === 'number') {
      numberTarget = randInt(Number(min) || 1, Number(max) || 100);
      prompt = `Write 5 clues, one per weekday, that progressively narrow down the mystery number ${numberTarget} (range ${min}-${max})${grade ? ` for ${grade} students` : ''}. Monday's clue should be broad (e.g. even/odd, a range), Friday's should nearly give it away. Return ONLY JSON: {"clues": ["Monday clue", "Tuesday clue", "Wednesday clue", "Thursday clue", "Friday clue"]}`;
      docTitle = title?.trim() || 'Number Detective';
      subtitle = `Read one clue each day. Write your guess. The mystery number is between ${min} and ${max}.`;
    } else if (subject === 'state') {
      prompt = `Pick one real US state (don't reveal its name). Write 5 geography/culture/history clues about it, one per weekday, progressively easier -- Monday hardest, Friday nearly gives it away. Return ONLY JSON: {"answer": "State Name", "clues": ["Monday clue", "Tuesday clue", "Wednesday clue", "Thursday clue", "Friday clue"]}`;
      docTitle = title?.trim() || 'Mystery State';
      subtitle = 'Read one clue each day. Can you guess the mystery state before Friday?';
    } else {
      return NextResponse.json({ error: 'subject must be "number" or "state"' }, { status: 400 });
    }

    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
    const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
    // 2026-07-21: extract the {...} object rather than assuming the whole
    // response is JSON (see word-ladders fix, same root cause).
    const objMatch = raw.match(/\{[\s\S]*\}/);
    const jsonText = objMatch ? objMatch[0] : raw.replace(/```json|```/g, '').trim();
    let data: any = {};
    try { data = JSON.parse(jsonText); } catch { data = {}; }
    const clues: string[] = Array.isArray(data.clues) ? data.clues : [];
    if (clues.length < 5) return NextResponse.json({ error: 'Could not generate clues -- try again' }, { status: 500 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, subtitle, theme);
    let y = PAGE_H - 150;
    DAYS.forEach((day, i) => {
      page.drawText(`${day}:`, { x: 54, y, size: 11, font: helvBold, color: NAVY });
      const lines = wrapLines(clues[i] || '', helv, 11, PAGE_W - 170);
      let ty = y;
      for (const line of lines) { page.drawText(line, { x: 120, y: ty, size: 11, font: helv, color: INK }); ty -= 15; }
      y = ty - 6;
      page.drawText('My guess: _______________________', { x: 54, y, size: 10, font: helv, color: INK });
      y -= 34;
    });
    page.drawText('Final answer: _______________________', { x: 54, y: y - 10, size: 12, font: helvBold, color: NAVY });

    const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    const answer = subject === 'number' ? String(numberTarget) : (data.answer || '');
    keyPage.drawText(`Answer: ${answer}`, { x: 54, y: PAGE_H - 90, size: 13, font: helv, color: INK });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'mystery-clues', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
