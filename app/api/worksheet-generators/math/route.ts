import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, wrapLines, randInt, PAGE_W, PAGE_H, INK, NAVY } from '@/lib/worksheet-pdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

const WORD_TEMPLATES = [
  (a: number, b: number) => `Sam has ${a} marbles. A friend gives Sam ${b} more. How many marbles does Sam have now?`,
  (a: number, b: number) => `There are ${a} students in one class and ${b} students in another. How many students are there in total?`,
  (a: number, b: number) => `A store sold ${a} apples in the morning and ${b} apples in the afternoon. How many apples were sold in all?`,
  (a: number, b: number) => `A farmer picked ${a} pumpkins on Monday and ${b} more on Tuesday. How many pumpkins in total?`,
];

function digitsRange(d: number) { return [Math.pow(10, d - 1), Math.pow(10, d) - 1]; }

function genAdditionBasic() {
  const a = randInt(0, 9), b = randInt(0, 9);
  return { a, b, op: '+', answer: a + b };
}
function genAdditionAdvanced(d1: number, d2: number) {
  const [lo1, hi1] = digitsRange(d1), [lo2, hi2] = digitsRange(d2);
  const a = randInt(lo1, hi1), b = randInt(lo2, hi2);
  return { a, b, op: '+', answer: a + b };
}
function genSubtractionBasic() {
  const answer = randInt(0, 9), b = randInt(1, 9);
  return { a: b + answer, b, op: '-', answer };
}
function needsBorrow(a: number, b: number, digits: number) {
  const as = String(a).padStart(digits, '0'), bs = String(b).padStart(digits, '0');
  for (let i = digits - 1; i >= 0; i--) if (+as[i] < +bs[i]) return true;
  return false;
}
function genSubtractionAdvanced(digits: number, borrowing: string) {
  const [lo, hi] = digitsRange(digits);
  let a = randInt(lo, hi), b = randInt(lo, hi);
  if (b > a) [a, b] = [b, a];
  if (borrowing !== 'mixed') {
    const wantBorrow = borrowing === 'yes';
    let tries = 0;
    while (needsBorrow(a, b, digits) !== wantBorrow && tries < 60) {
      a = randInt(lo, hi); b = randInt(lo, hi);
      if (b > a) [a, b] = [b, a];
      tries++;
    }
  }
  return { a, b, op: '-', answer: a - b };
}
function genMultiplicationBasic(maxFactor: number) {
  const a = randInt(1, maxFactor), b = randInt(1, maxFactor);
  return { a, b, op: '×', answer: a * b };
}
function genMultiplicationAdvanced(d1: number, d2: number) {
  const [lo1, hi1] = digitsRange(d1), [lo2, hi2] = digitsRange(d2);
  const a = randInt(lo1, hi1), b = randInt(lo2, hi2);
  return { a, b, op: '×', answer: a * b };
}
function genDivisionBasic(minDiv: number, maxDiv: number, minQuot: number, maxQuot: number) {
  const divisor = randInt(minDiv, maxDiv), quotient = randInt(minQuot, maxQuot);
  return { a: divisor * quotient, b: divisor, op: '÷', answer: quotient };
}
function genDivisionAdvanced(dividendDigits: number, divisorDigits: number, remainders: string) {
  const [dlo, dhi] = digitsRange(dividendDigits), [vlo, vhi] = digitsRange(divisorDigits);
  let dividend = randInt(dlo, dhi);
  let divisor = randInt(vlo, vhi);
  if (divisor > dividend) divisor = randInt(1, Math.max(1, Math.min(vhi, dividend)));
  let quotient = Math.floor(dividend / divisor);
  let remainder = dividend % divisor;
  const wantRemainder = remainders === 'yes' ? true : remainders === 'no' ? false : null;
  if (wantRemainder === false && remainder !== 0) { dividend = divisor * quotient; remainder = 0; }
  if (wantRemainder === true && remainder === 0) { dividend += randInt(1, divisor - 1 || 1); quotient = Math.floor(dividend / divisor); remainder = dividend % divisor; }
  return { a: dividend, b: divisor, op: '÷', answer: quotient, remainder };
}

function generateProblem(op: string, mode: string, cfg: any) {
  if (op === 'addition') return mode === 'basic' ? genAdditionBasic() : genAdditionAdvanced(cfg.digits1, cfg.digits2);
  if (op === 'subtraction') return mode === 'basic' ? genSubtractionBasic() : genSubtractionAdvanced(cfg.digits, cfg.borrowing);
  if (op === 'multiplication') return mode === 'basic' ? genMultiplicationBasic(cfg.maxFactor) : genMultiplicationAdvanced(cfg.digits1, cfg.digits2);
  if (op === 'division') return mode === 'basic' ? genDivisionBasic(cfg.minDivisor, cfg.maxDivisor, cfg.minQuotient, cfg.maxQuotient) : genDivisionAdvanced(cfg.dividendDigits, cfg.divisorDigits, cfg.remainders);
  throw new Error(`Unknown operation: ${op}`);
}

function drawHorizontalProblem(page: any, x: number, y: number, p: any, font: any, size = 13) {
  page.drawText(`${p.a} ${p.op} ${p.b} = ______`, { x, y, size, font, color: INK });
}

function drawVerticalProblem(page: any, x: number, y: number, p: any, font: any, size = 16) {
  const aStr = String(p.a), bStr = `${p.op} ${p.b}`;
  const w = Math.max(font.widthOfTextAtSize(aStr, size), font.widthOfTextAtSize(bStr, size)) + 6;
  page.drawText(aStr, { x: x + w - font.widthOfTextAtSize(aStr, size), y, size, font, color: INK });
  page.drawText(bStr, { x: x + w - font.widthOfTextAtSize(bStr, size), y: y - 20, size, font, color: INK });
  page.drawLine({ start: { x, y: y - 26 }, end: { x: x + w, y: y - 26 }, thickness: 1, color: INK });
  return w;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, op, mode, config = {}, title, bundleId } = (await request.json()) || {};
    if (!userId || !op || !mode) return NextResponse.json({ error: 'userId, op, and mode are required' }, { status: 400 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const opSymbol: any = { addition: '+', subtraction: '-', multiplication: '×', division: '÷' };
    const docTitle = title?.trim() || `${op[0].toUpperCase()}${op.slice(1)} Practice`;

    if (mode === 'basic') {
      const perPage = config.problemsPerPage === 50 ? 50 : 25;
      const cols = 5, rows = perPage / cols;
      let page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, `${perPage} problems`, theme);
      const startY = PAGE_H - 130, cellW = (PAGE_W - 108) / cols, cellH = (startY - 60) / rows;
      let count = 0;
      const totalProblems = perPage; // one page per generation for basic mode
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (count >= totalProblems) break;
          const p = generateProblem(op, mode, config);
          drawHorizontalProblem(page, 54 + c * cellW, startY - r * cellH, p, helv, 12);
          count++;
        }
      }
      const bytes = await doc.save();
      const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'math', `${docTitle}.pdf`);
      return new NextResponse(new Uint8Array(bytes), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
      });
    }

    // Advanced mode
    const count = Math.max(4, Math.min(30, parseInt(config.count, 10) || 12));
    const orientation = config.orientation === 'horizontal' ? 'horizontal' : 'vertical';
    const wordProblems = op === 'addition' && !!config.wordProblems;

    let page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, wordProblems ? 'Word problems' : undefined, theme);
    let y = PAGE_H - 140;

    if (wordProblems) {
      for (let i = 0; i < count; i++) {
        const p = generateProblem(op, mode, config);
        const template = WORD_TEMPLATES[i % WORD_TEMPLATES.length];
        const text = `${i + 1}. ${template(p.a, p.b)}`;
        const lines = wrapLines(text, helv, 11, PAGE_W - 108);
        for (const line of lines) {
          if (y < 80) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
          page.drawText(line, { x: 54, y, size: 11, font: helv, color: INK });
          y -= 15;
        }
        y -= 8;
        if (y < 80) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        page.drawText('Answer: ___________________', { x: 70, y, size: 10, font: helv, color: INK });
        y -= 24;
      }
    } else if (orientation === 'vertical') {
      const cols = 3, colW = (PAGE_W - 108) / cols;
      let col = 0;
      for (let i = 0; i < count; i++) {
        const p = generateProblem(op, mode, config);
        if (y < 100) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; col = 0; }
        drawVerticalProblem(page, 54 + col * colW, y, p, helvBold, 16);
        col++;
        if (col >= cols) { col = 0; y -= 100; }
      }
    } else {
      for (let i = 0; i < count; i++) {
        const p = generateProblem(op, mode, config);
        if (y < 80) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        drawHorizontalProblem(page, 54, y, p, helv, 14);
        y -= 30;
      }
    }

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'math', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
