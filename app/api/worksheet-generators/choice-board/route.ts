import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { newWorksheetDoc, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, wrapLines, PAGE_W, PAGE_H, INK, NAVY, sanitizeForPdfText, asciiSafeFilename } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Choice Board (2026-07-21) -- another genuinely missing standard
// product type (confirmed via full repo search before building, same as
// Task Cards). A grid of distinct activities on one topic, deliberately
// varied across different kinds of thinking/modalities (not N variations
// of the same task), students pick which ones to complete rather than
// being assigned all of them -- the defining feature vs. Task Cards,
// which are meant to be worked through as a full set.

const SIZE_OPTIONS: Record<string, number> = { '3x3': 9, '4x4': 16 };

export async function POST(request: NextRequest) {
  try {
    const { userId, topic = '', grade = '', subject = '', size = '3x3', title, bundleId } = (await request.json()) || {};
    if (!userId || !topic?.trim()) return NextResponse.json({ error: 'userId and topic are required' }, { status: 400 });
    const n = SIZE_OPTIONS[size] || 9;
    const gridDim = Math.sqrt(n);

    const prompt = `Write ${n} short activity choices for a student choice board${grade ? ` for ${grade} students` : ''}${subject ? `, ${subject}` : ''}, themed around: ${topic}.
This is a CHOICE board, not a task-card set: students pick which activities to complete, not all of them. Deliberately vary the KIND of thinking and product across all ${n} choices -- mix creative (draw, design, write a story), analytical (compare, explain why, classify), research (find out, investigate), and hands-on/presentation (build a model, act it out, teach someone) activities rather than repeating the same activity type. Each activity should be doable independently by a student without extra materials the classroom wouldn't already have. Keep each one to one or two sentences.
Return ONLY a JSON array, no other text: ["activity 1 text", "activity 2 text", ...]`;

    const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] });
    const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '[]';
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    const jsonText = arrMatch ? arrMatch[0] : raw.replace(/```json|```/g, '').trim();
    let activities: string[] = [];
    try { activities = JSON.parse(jsonText); } catch { activities = []; }
    if (activities.length < n) return NextResponse.json({ error: 'Could not generate a full choice board -- try again' }, { status: 500 });
    activities = activities.slice(0, n).map((a) => sanitizeForPdfText(a));

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || `${topic} Choice Board`;

    const page = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, page, theme);
    page.drawText(docTitle, { x: 54, y: PAGE_H - 56, size: 18, font: helvBold, color: NAVY });
    page.drawText('Choose the activities you\u2019d like to complete. Check each box when done.', { x: 54, y: PAGE_H - 76, size: 10, font: helv, color: INK });

    const margin = 40, top = PAGE_H - 100, gridW = PAGE_W - margin * 2, gridH = top - margin;
    const cellW = gridW / gridDim, cellH = gridH / gridDim;

    for (let i = 0; i < n; i++) {
      const col = i % gridDim, row = Math.floor(i / gridDim);
      const x = margin + col * cellW, y = top - (row + 1) * cellH;

      page.drawRectangle({ x, y, width: cellW, height: cellH, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
      // Completion checkbox, bottom-right of each cell
      const boxSize = 12;
      page.drawRectangle({ x: x + cellW - boxSize - 8, y: y + 8, width: boxSize, height: boxSize, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 1 });

      const lines = wrapLines(activities[i] || '', helv, 10.5, cellW - 20);
      let ty = y + cellH / 2 + ((lines.length - 1) * 13) / 2;
      for (const line of lines) {
        page.drawText(line, { x: x + 10, y: ty, size: 10.5, font: helv, color: INK, maxWidth: cellW - 20 });
        ty -= 13;
      }
    }

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'choice-board', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
