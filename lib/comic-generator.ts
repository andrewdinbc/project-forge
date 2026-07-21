// lib/comic-generator.ts (Aj, 2026-07-21): "Classroom Current Events
// Periodical" Schema's comic-book-style branch -- a black-and-white,
// cheap-to-print comic reader generator usable for ANY subject, in two
// modes:
//   - 'topic': a standalone comic-book article on a subject/topic of choice
//   - 'weekly': curates this actual school week's Daily Planner subjects
//     (via daily_plans) plus assemblies/guest speakers/special events (via
//     calendar_events) into ONE cross-subject narrative "weekly reader"
//     comic -- see app/api/comic-generator/generate/route.ts for the
//     digest query, this file only knows about already-formatted context.
//
// Panels are real vector geometry (borders, caption boxes, speech
// bubbles) drawn with pdf-lib, same approach as lib/foldable-shapes.ts --
// only the panel ILLUSTRATION itself is an AI-generated image (via
// lib/design-assets-gen.ts, 'line_art' B&W style), embedded inside the
// vector panel border so it prints cleanly in black and white.

import { rgb } from 'pdf-lib';
import { wrapLines } from './worksheet-pdf';

export const PAGE_W = 612; // US Letter portrait
export const PAGE_H = 792;

export interface ComicDialogueLine {
  speaker: string;
  line: string;
}

export interface ComicPanelScript {
  sceneDescription: string;
  caption?: string;
  dialogue?: ComicDialogueLine[];
}

export interface ComicScript {
  title: string;
  panels: ComicPanelScript[];
  literacyQuestions: string[];
}

// A single reusable B&W line-art suffix for comic panels specifically --
// distinct from lib/design-assets-gen.ts's LINE_ART_STYLE_SUFFIX (which is
// tuned for a full-bleed coloring-page illustration) because a comic panel
// needs to compose cleanly INSIDE a drawn border rather than fight it, and
// benefits from dynamic "comic framing" language a coloring page doesn't.
export const COMIC_PANEL_STYLE_SUFFIX =
  ', black and white comic book panel illustration, clean bold ink outlines, no shading, no color, no gradients, high contrast line art, dynamic comic framing, designed to print clearly on a black and white printer, no text or speech bubbles in the image itself';

export function buildComicScriptPrompt(opts: {
  mode: 'topic' | 'weekly';
  subject?: string;
  topic?: string;
  gradeLevel: string;
  panelCount: number;
  weeklyContext?: string;
}): string {
  const { mode, subject, topic, gradeLevel, panelCount, weeklyContext } = opts;

  const base = mode === 'weekly'
    ? `You are writing a SHORT COMIC-BOOK-STYLE SCRIPT for a Grade ${gradeLevel} classroom "weekly reader" comic. Weave together, as ONE light narrative (two or three recurring student characters moving through their actual school week), everything really happening this week per the digest below -- each subject's topic and each special event (assembly, guest speaker, etc.) should show up as a real story beat that actually teaches or references that content, not a random list bolted together.\n\nThis week's digest:\n${weeklyContext}`
    : `You are writing a SHORT COMIC-BOOK-STYLE SCRIPT that teaches Grade ${gradeLevel} students about a real subject topic through a narrative story with characters, not a dry list of facts.\n\nSubject: ${subject}\nTopic: ${topic}`;

  return `${base}

Write exactly ${panelCount} panels that tell one coherent short story start-to-finish (a setup, a small complication or question, a resolution that lands on the real content). Each panel needs:
- "sceneDescription": a vivid, concrete visual description of what's happening in THIS SINGLE panel (characters, setting, action) -- written as an image-generation prompt for a black-and-white line-art illustrator. Do not mention any real, named public figure or any existing copyrighted character. Invent simple, friendly original characters (name two or three recurring ones once and reuse them across panels) rather than existing copyrighted characters.
- "caption": OPTIONAL short narrator caption box text (use an empty string if not needed for this panel).
- "dialogue": array of {"speaker": short character name, "line": short spoken line, grade-${gradeLevel}-appropriate} -- 0 to 2 lines per panel, each line under 15 words so it fits a speech bubble. Use an empty array if this panel is silent.

Then write "literacyQuestions": exactly 4 short reading-response questions a teacher could hand out after reading the comic -- a mix of recall ("What happened when...?"), personal connection ("Has something like this ever happened to you?"), and inference/opinion ("Why do you think...?") style questions, grade-${gradeLevel}-appropriate.

Also write "title": a short, fun title for this comic issue.

Respond with ONLY valid JSON, no prose, no markdown fences:
{
  "title": string,
  "panels": [{"sceneDescription": string, "caption": string, "dialogue": [{"speaker": string, "line": string}]}],
  "literacyQuestions": [string]
}`;
}

function truncateLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = kept[max - 1].replace(/\s*\S*$/, '') + '...';
  return kept;
}

export function drawComicCoverPage(page: any, opts: {
  width: number; height: number; title: string; subtitle: string; grade: string | number; font: any; boldFont: any;
}) {
  const { width, height, title, subtitle, grade, font, boldFont } = opts;
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: rgb(0, 0, 0), borderWidth: 3, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 24, y: height - 140, width: width - 48, height: 116, borderColor: rgb(0, 0, 0), borderWidth: 2, color: rgb(0, 0, 0) });

  const titleLines = wrapLines(title.toUpperCase(), boldFont, 30, width - 100);
  const startY = height - 60;
  titleLines.slice(0, 3).forEach((line: string, i: number) => {
    const w = boldFont.widthOfTextAtSize(line, 30);
    page.drawText(line, { x: (width - w) / 2, y: startY - i * 34, size: 30, font: boldFont, color: rgb(1, 1, 1) });
  });

  const subLines = wrapLines(subtitle, font, 13, width - 140);
  subLines.slice(0, 2).forEach((line: string, i: number) => {
    const w = font.widthOfTextAtSize(line, 13);
    page.drawText(line, { x: (width - w) / 2, y: height - 200 - i * 18, size: 13, font, color: rgb(0, 0, 0) });
  });

  const gradeText = `Grade ${grade}  |  Comic Reader`;
  const gw = font.widthOfTextAtSize(gradeText, 11);
  page.drawText(gradeText, { x: (width - gw) / 2, y: 60, size: 11, font, color: rgb(0.3, 0.3, 0.3) });

  // Simple burst/star accents around the title block, purely decorative
  // vector shapes (no image call needed for the cover).
  const starPositions = [[60, height - 170], [width - 90, height - 170], [60, 100], [width - 90, 100]];
  starPositions.forEach(([sx, sy]) => {
    page.drawText('*', { x: sx, y: sy, size: 22, font: boldFont, color: rgb(0, 0, 0) });
  });
}

// Draws up to 6 panels (2 cols x 3 rows) on one page: bordered panel with
// the AI-generated B&W illustration fitted inside, an optional caption box
// in the top-left corner, and up to 2 stacked speech bubbles along the
// bottom -- classic comic-strip composition, kept simple and high-contrast
// so it photocopies/prints well.
export function drawComicPage(page: any, panels: { image: any; caption?: string; dialogue?: ComicDialogueLine[] }[], opts: {
  width: number; height: number; font: any; boldFont: any; issueTitle: string; pageLabel: string;
}) {
  const { width, height, font, boldFont, issueTitle, pageLabel } = opts;
  const margin = 28;
  const headerH = 26;

  page.drawText(issueTitle, { x: margin, y: height - 20, size: 11, font: boldFont, color: rgb(0, 0, 0) });
  const labelW = font.widthOfTextAtSize(pageLabel, 9);
  page.drawText(pageLabel, { x: width - margin - labelW, y: height - 20, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawLine({ start: { x: margin, y: height - headerH - 2 }, end: { x: width - margin, y: height - headerH - 2 }, thickness: 1, color: rgb(0, 0, 0) });

  const cols = 2;
  const rows = 3;
  const gap = 10;
  const gridTop = height - headerH - margin;
  const gridBottom = margin;
  const gridLeft = margin;
  const gridRight = width - margin;
  const cellW = (gridRight - gridLeft - gap * (cols - 1)) / cols;
  const cellH = (gridTop - gridBottom - gap * (rows - 1)) / rows;

  panels.slice(0, cols * rows).forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridLeft + col * (cellW + gap);
    const yTop = gridTop - row * (cellH + gap);
    const yBottom = yTop - cellH;

    page.drawRectangle({ x, y: yBottom, width: cellW, height: cellH, borderColor: rgb(0, 0, 0), borderWidth: 2.5, color: rgb(1, 1, 1) });

    const inset = 5;
    if (p.image) {
      try {
        const dims = p.image.scale(1);
        const availW = cellW - inset * 2;
        const availH = cellH - inset * 2;
        const scale = Math.min(availW / dims.width, availH / dims.height);
        const drawW = dims.width * scale;
        const drawH = dims.height * scale;
        page.drawImage(p.image, {
          x: x + (cellW - drawW) / 2,
          y: yBottom + (cellH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      } catch { /* fall through to blank panel -- caption/dialogue still render */ }
    } else {
      // No image available (generation failed for this panel) -- draw a
      // light diagonal placeholder pattern rather than leaving it looking
      // broken, so the comic still reads as intentional.
      page.drawLine({ start: { x: x + inset, y: yBottom + inset }, end: { x: x + cellW - inset, y: yTop - inset }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      page.drawLine({ start: { x: x + inset, y: yTop - inset }, end: { x: x + cellW - inset, y: yBottom + inset }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    }

    if (p.caption && p.caption.trim()) {
      const capSize = 7;
      const capW = cellW * 0.72;
      let capLines = wrapLines(p.caption, font, capSize, capW - 10);
      capLines = truncateLines(capLines, 3);
      const capH = capLines.length * (capSize + 2) + 6;
      page.drawRectangle({ x: x + 4, y: yTop - 4 - capH, width: capW, height: capH, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 });
      capLines.forEach((line: string, li: number) => {
        page.drawText(line, { x: x + 9, y: yTop - 4 - capSize - 4 - li * (capSize + 2), size: capSize, font, color: rgb(0, 0, 0) });
      });
    }

    const dlg = (p.dialogue || []).filter((d) => d.line && d.line.trim()).slice(0, 2);
    let bubbleY = yBottom + inset;
    dlg.forEach((d) => {
      const text = `${d.speaker}: ${d.line}`;
      const bSize = 6.5;
      const bubbleW = cellW - inset * 2;
      let lines = wrapLines(text, font, bSize, bubbleW - 10);
      lines = truncateLines(lines, 3);
      const bubbleH = lines.length * (bSize + 2) + 6;
      page.drawRectangle({ x: x + inset, y: bubbleY, width: bubbleW, height: bubbleH, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 });
      // small pointer tail so it reads as a speech bubble, not a caption box
      page.drawSvgPath(`M 0 0 L 8 0 L 0 -8 Z`, {
        x: x + inset + 14, y: bubbleY, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1,
      });
      lines.forEach((line: string, li: number) => {
        page.drawText(line, { x: x + inset + 5, y: bubbleY + bubbleH - bSize - 4 - li * (bSize + 2), size: bSize, font, color: rgb(0, 0, 0) });
      });
      bubbleY += bubbleH + 5;
    });
  });
}

export function drawLiteracyQuestionsPage(page: any, questions: string[], opts: {
  width: number; height: number; font: any; boldFont: any; title: string;
}) {
  const { width, height, font, boldFont, title } = opts;
  const margin = 54;
  page.drawText('Comic Reader Response Questions', { x: margin, y: height - 60, size: 18, font: boldFont, color: rgb(0.11, 0.21, 0.34) });
  page.drawText(title, { x: margin, y: height - 82, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawLine({ start: { x: margin, y: height - 92 }, end: { x: width - margin, y: height - 92 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

  let y = height - 130;
  const qList = (questions && questions.length ? questions : ['What happened in this comic?', 'Has something like this ever happened to you?', 'Why do you think the characters made that choice?', 'What do you think happens next?']);
  qList.slice(0, 6).forEach((q, i) => {
    const lines = wrapLines(`${i + 1}. ${q}`, boldFont, 12, width - margin * 2);
    lines.forEach((line: string, li: number) => {
      page.drawText(line, { x: margin, y, size: 12, font: li === 0 ? boldFont : font, color: rgb(0, 0, 0) });
      y -= 16;
    });
    // three ruled response lines per question
    for (let r = 0; r < 3; r++) {
      y -= 16;
      page.drawLine({ start: { x: margin + 14, y }, end: { x: width - margin, y }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });
    }
    y -= 20;
  });
}
