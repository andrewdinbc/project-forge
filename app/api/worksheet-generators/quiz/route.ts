import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, wrapLines, shuffle, PAGE_W, PAGE_H, INK, NAVY, LINE, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function parseMultipleChoice(raw: string) {
  return raw.split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const question = lines[0];
    const options = lines.slice(1).map((l) => ({ text: l.replace(/^\*/, ''), correct: l.startsWith('*') }));
    return { question, options };
  }).filter(Boolean);
}

function parseMatching(raw: string) {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [left, right] = line.split('=').map((s) => s.trim());
    return { left, right: right || left };
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, type, content, title, bundleId } = (await request.json()) || {};
    if (!userId || !type || !content) return NextResponse.json({ error: 'userId, type, and content are required' }, { status: 400 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const typeLabels: any = { multiple_choice: 'Multiple Choice Quiz', matching: 'Matching Quiz', fill_blank: 'Fill-in-the-Blank Quiz', short_answer: 'Short Answer / Essay Test' };
    const docTitle = title?.trim() || typeLabels[type] || 'Quiz';

    let page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, undefined, theme);
    let y = PAGE_H - 130;

    if (type === 'multiple_choice') {
      const questions = parseMultipleChoice(content);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (y < 120) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        for (const line of wrapLines(`${i + 1}. ${q.question}`, helvBold, 12, PAGE_W - 108)) {
          page.drawText(line, { x: 54, y, size: 12, font: helvBold, color: INK });
          y -= 17;
        }
        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j];
          if (y < 60) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
          page.drawText(`   ${LETTERS[j]}) ${opt.text}`, { x: 64, y, size: 11, font: helv, color: INK });
          y -= 16;
        }
        y -= 12;
      }
      const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
      keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
      let ky = PAGE_H - 90;
      questions.forEach((q, i) => {
        const correctIdx = q.options.findIndex((o) => o.correct);
        keyPage.drawText(`${i + 1}. ${correctIdx >= 0 ? LETTERS[correctIdx] : '(mark the answer with * in the question box)'}`, { x: 54, y: ky, size: 11, font: helv, color: INK });
        ky -= 18;
      });
    } else if (type === 'matching') {
      const pairs = parseMatching(content);
      const rightShuffled = shuffle(pairs.map((p, i) => ({ i, right: p.right })));
      page.drawText('Match each item on the left with its answer on the right. Write the letter on the line.', { x: 54, y, size: 10, font: helv, color: INK });
      y -= 24;
      const colLeftX = 54, colBlankX = 54, colRightX = PAGE_W / 2 + 20;
      for (let i = 0; i < pairs.length; i++) {
        const p = pairs[i];
        if (y < 60) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        page.drawText(`____  ${i + 1}. ${p.left}`, { x: colLeftX, y, size: 11, font: helv, color: INK });
        const letter = LETTERS[rightShuffled.findIndex((r) => r.i === i)];
        // (letter reserved for the key; the right column below shows its own lettering)
        y -= 18;
      }
      // Right column of shuffled answers, printed once as its own block under the left list.
      y -= 10;
      page.drawText('Answers:', { x: 54, y, size: 10, font: helvBold, color: NAVY });
      y -= 16;
      for (let j = 0; j < rightShuffled.length; j++) {
        const r = rightShuffled[j];
        if (y < 60) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        page.drawText(`${LETTERS[j]}. ${r.right}`, { x: 64, y, size: 11, font: helv, color: INK });
        y -= 16;
      }
      const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
      keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
      let ky = PAGE_H - 90;
      pairs.forEach((p, i) => {
        const letter = LETTERS[rightShuffled.findIndex((r) => r.i === i)];
        keyPage.drawText(`${i + 1}. ${letter}  (${p.left} -> ${p.right})`, { x: 54, y: ky, size: 10, font: helv, color: INK });
        ky -= 16;
      });
    } else if (type === 'fill_blank') {
      const questions = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (y < 70) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        for (const line of wrapLines(`${i + 1}. ${q}`, helv, 12, PAGE_W - 108)) {
          page.drawText(line, { x: 54, y, size: 12, font: helv, color: INK });
          y -= 20;
        }
        y -= 10;
      }
    } else if (type === 'short_answer') {
      const questions = content.split(/\n\s*\n/).map((q: string) => q.trim()).filter(Boolean);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (y < 140) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        for (const line of wrapLines(`${i + 1}. ${q}`, helvBold, 12, PAGE_W - 108)) {
          page.drawText(line, { x: 54, y, size: 12, font: helvBold, color: INK });
          y -= 17;
        }
        y -= 6;
        for (let l = 0; l < 4; l++) {
          page.drawLine({ start: { x: 54, y }, end: { x: PAGE_W - 54, y }, thickness: 0.75, color: LINE });
          y -= 22;
        }
        y -= 10;
      }
    } else {
      return NextResponse.json({ error: `Unknown quiz type: ${type}` }, { status: 400 });
    }

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'quiz', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
