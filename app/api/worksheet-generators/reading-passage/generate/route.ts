import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import {
  newWorksheetDoc, drawThemeBorder, drawThemeHeader, wrapLines, uploadWorksheetPdf,
  PAGE_W, PAGE_H, INK, NAVY, GRAY, LINE, asciiSafeFilename, sanitizeAiJsonText} from '@/lib/worksheet-pdf';
import { fleschKincaidGrade } from '@/lib/readability';
import { errorMessage } from '@/lib/error-message';
import { CURRICULUM_ELABORATIONS, ELABORATIONS_SUBJECT_MAP } from '@/lib/curriculum-full-elaborations';
import { buildSteeringContext } from '@/lib/style-lab';
import { incrementGenerationCount } from '@/lib/schema-lab';
import { generateImageBuffer } from '@/lib/design-assets-gen';

// Schema Lab IDs this route fulfills -- used to actually increment
// generation_count on success, which this route never did before (2026-
// 07-22 fix, same class of dead-tracking bug already fixed on the INB and
// Choice Board generators): single-level runs count against the basic
// Reading Comprehension Packet schema, differentiated runs count against
// the Differentiated Reading Passage (Lexile-Leveled) schema.
const SCHEMA_ID_BASIC = '373eb4ea-72e2-45ea-b444-a533c7c030b0';
const SCHEMA_ID_DIFFERENTIATED = '667e6e22-4c65-45e7-8507-19d0d26991db';
const BC_ALIASES = ['bc', 'british columbia', 'british columbia, canada'];

// Reading Passage Generator (Aj, 2026-07-20): "Pick the topic (for example
// dinosaurs), it will pull up the schema, input or create relevant art,
// use some of my pre made borders, illustrations, etc, and encode the
// content in this way using all of the parts together."
//
// Structurally follows Schema Lab schema id 373eb4ea-72e2-45ea-b444-a533c7c030b0
// ("Reading Comprehension Packet: Passage + Questions", synthesized from
// StudentSavvy's Ancient Egypt passages + a BC Grade 5 governance unit):
// Informational Reading Passage -> Comprehension Response Page -> Answer
// Key -> Strategy Guide/Template (here, the annotation-symbol legend).
// For 3-tier mode, also follows schema 667e6e22-... (Differentiated
// Reading Passage, Lexile-Leveled) -- same story/facts across all 3
// tiers, differing only in vocabulary/sentence complexity.
//
// Leveling is grounded against helps_reference_passages -- the 100 real,
// professionally-leveled passages from the free HELPS Curriculum (Begeny
// et al.), used as few-shot STYLE exemplars only (never content to copy).
// This directly closes a logged bug from schema #5's first build: the
// model's own claimed Lexile numbers weren't reliable ("generated
// 420L-520L for a grade band the table puts at 600-800L" -- structure
// worked, the arithmetic didn't). Here, every generated passage is
// independently re-scored with lib/readability.js's Flesch-Kincaid
// calculator and the ACTUAL computed grade is returned alongside the
// target, so a mismatch is visible and actionable rather than silently
// trusted.
export const maxDuration = 180;

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TIERS = [
  { key: 'support', label: 'Support (Below Level)', offset: -1.5 },
  { key: 'onlevel', label: 'On-Level', offset: 0 },
  { key: 'challenge', label: 'Challenge (Above Level)', offset: 1.5 },
];

async function getHelpsExemplars(targetGrade: number, count = 3) {
  const { data, error } = await admin
    .from('helps_reference_passages')
    .select('passage_num, title, text, word_count, flesch_kincaid_grade');
  if (error || !data?.length) return [];
  const sorted = [...data].sort(
    (a: any, b: any) => Math.abs(a.flesch_kincaid_grade - targetGrade) - Math.abs(b.flesch_kincaid_grade - targetGrade)
  );
  return sorted.slice(0, count);
}

// Standing process (Aj, 2026-07-21, applied here 2026-07-22): every content
// generator grounds its writing in (1) BC curriculum content for the
// subject+grade if available, then (2) Aj's steering documents, before the
// AI writes anything -- same pattern already standing on the Comic
// Generator. A topic like "how volcanoes form" only becomes genuinely
// curriculum-aligned content (not just generically accurate) when it's
// actually checked against what BC Grade 4 Science says to teach.
function buildCurriculumBlock(subject: string, gradeLevel: number, jurisdiction: string): string {
  const jur = (jurisdiction || 'British Columbia, Canada').trim();
  const isBC = BC_ALIASES.includes(jur.toLowerCase());
  const gradeKey = String(Math.round(gradeLevel));
  if (!isBC) {
    return `Jurisdiction: ${jur}. Use general knowledge of ${jur}'s official curriculum standards for ${subject}, Grade ${gradeKey}. Stay conservative rather than inventing specific standard codes you're not confident about.`;
  }
  const subjectKey = (ELABORATIONS_SUBJECT_MAP as any)[subject];
  const curriculumGrade = subjectKey ? (CURRICULUM_ELABORATIONS as any)[subjectKey]?.[gradeKey] : null;
  if (!curriculumGrade) {
    return `No structured BC curriculum data found for ${subject} Grade ${gradeKey} -- use general grade-appropriate BC curriculum knowledge.`;
  }
  return `Official BC Curriculum for ${subject}, Grade ${gradeKey}:\nBig Ideas: ${curriculumGrade.bigIdeas.join(' | ')}\nContent: ${curriculumGrade.content.join(' | ')}`;
}

function buildLevelPrompt(topic: string, targetGrade: number, levelLabel: string | null, exemplars: any[], groundingBlock: string) {
  const exemplarBlock = exemplars
    .map((e, i) => `Example ${i + 1} (Flesch-Kincaid grade ${e.flesch_kincaid_grade}, ${e.word_count} words):\n${e.text}`)
    .join('\n\n---\n\n');

  return `You are writing an ORIGINAL reading passage for a classroom reading-comprehension worksheet.

Topic: "${topic}"
Target reading level: US grade ${targetGrade.toFixed(1)} (Flesch-Kincaid)${levelLabel ? ` -- this is the "${levelLabel}" tier of a differentiated set covering the same facts at 3 complexity levels` : ''}
${groundingBlock ? `\n${groundingBlock}\n\nGround the passage's factual content in the curriculum info above where relevant -- don't just write generic facts about the topic if a specific Big Idea or content point applies. Aj's steering guidance (writing style/pedagogy preferences), if present above, should also shape tone and approach.\n` : ''}
Below are real examples from the HELPS Curriculum (Begeny et al., a published, professionally-leveled reading fluency program), at or near this exact grade level. Study their SENTENCE LENGTH, VOCABULARY DIFFICULTY, and PARAGRAPH STRUCTURE and match that style closely. Do NOT reuse their topics, characters, names, or phrases in any way -- write something entirely new about "${topic}".

${exemplarBlock}

Write:
1. A short passage title
2. The passage itself (150-220 words, matching the sentence-length/vocabulary complexity of the examples above, never copying their content)
3. A short "while you're reading" annotation guide: 3 symbols a student marks in the margin while reading (e.g. an exclamation mark for something interesting, a question mark for something confusing, an asterisk for something important), each with a one-line meaning
4. Comprehension questions answered AFTER reading, from memory, without the passage in front of them: exactly 2 fill-in-the-blank sentence completions, 2 short-answer questions (open response, 1-2 sentence expected answer), and 1 true/false statement. Each must have one clear correct answer grounded in the passage.

Respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "title": "...",
  "passage": "...",
  "annotationGuide": [{"symbol": "!", "meaning": "..."}, {"symbol": "?", "meaning": "..."}, {"symbol": "*", "meaning": "..."}],
  "questions": [
    {"type": "fill_blank", "prompt": "The ___ helped the plant grow.", "answer": "sunlight"},
    {"type": "fill_blank", "prompt": "...", "answer": "..."},
    {"type": "short_answer", "prompt": "...", "answer": "..."},
    {"type": "short_answer", "prompt": "...", "answer": "..."},
    {"type": "true_false", "prompt": "...", "answer": "True"}
  ]
}`;
}

async function generateLevel(topic: string, targetGrade: number, levelLabel: string | null, groundingBlock: string) {
  const exemplars = await getHelpsExemplars(targetGrade, 3);
  const prompt = buildLevelPrompt(topic, targetGrade, levelLabel, exemplars, groundingBlock);
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '';
  let parsed: any;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  }
  if (!parsed?.passage) throw new Error(`Could not parse generated passage for target grade ${targetGrade}`);
  // Sanitize every generated string in one pass so downstream drawText
  // calls never choke on a smart quote/em dash pdf-lib's base WinAnsi
  // font can't encode -- this route never had this guard before (2026-
  // 07-22 fix); same choke point pattern the comic/INB generators use.
  parsed = sanitizeAiJsonText(parsed);

  const scored = fleschKincaidGrade(parsed.passage);
  return {
    levelLabel: levelLabel || 'Passage',
    targetGrade,
    actualGrade: scored.grade,
    gradeGapFlag: Math.abs(scored.grade - targetGrade) > 2.5, // sanity-check flag, not a hard failure
    exemplarsUsed: exemplars.map((e: any) => e.passage_num),
    ...parsed,
  };
}

async function loadPartsTheme(userId: string, borderPartId?: string, headerPartId?: string) {
  if (!borderPartId && !headerPartId) return null;
  const fetchPart = async (id?: string) => {
    if (!id) return null;
    const { data } = await admin.from('library_parts').select('file_url').eq('id', id).eq('user_id', userId).single();
    return data;
  };
  const [b, h] = await Promise.all([fetchPart(borderPartId), fetchPart(headerPartId)]);
  if (!b?.file_url && !h?.file_url) return null;
  return { borderUrl: b?.file_url || null, headerUrl: h?.file_url || null };
}

async function embedIllustration(doc: any, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Illustration fetch failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  try { return await doc.embedPng(bytes); } catch { return await doc.embedJpg(bytes); }
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId, topic, mode, gradeLevel, borderPartId, headerPartId, illustrationUrl, title,
      precomposedLevels, returnJson, subject = 'General', jurisdiction = 'British Columbia, Canada',
      autoIllustrate = true, imageProvider = 'gemini',
    } = (await request.json()) || {};
    if (!userId || !topic?.trim()) return NextResponse.json({ error: 'userId and topic are required' }, { status: 400 });
    if (!gradeLevel || Number.isNaN(Number(gradeLevel))) return NextResponse.json({ error: 'gradeLevel (a number, e.g. 3) is required' }, { status: 400 });
    const baseGrade = Number(gradeLevel);
    const isDifferentiated = mode === 'differentiated';

    // Standing process step 1+2: BC curriculum, then steering documents.
    // Best-effort -- a steering fetch failure shouldn't block generation.
    const curriculumBlock = buildCurriculumBlock(subject, baseGrade, jurisdiction);
    const steeringContext = await buildSteeringContext(userId).catch(() => '');
    const groundingBlock = [
      curriculumBlock,
      steeringContext ? `Aj's steering guidance (writing style/pedagogy preferences to follow):\n${steeringContext}` : '',
    ].filter(Boolean).join('\n\n');

    // Asset Modifier handoff (Aj, 2026-07-20): "loaded into asset modifier
    // so I can adjust and modify... AI writing box... drag tool." Two new
    // paths share this same route rather than forking a parallel one:
    // - precomposedLevels: skip the AI-writing call entirely and use this
    //   exact (possibly hand-edited in Asset Modifier) text, but still run
    //   it through fleschKincaidGrade scoring and the real PDF/theme
    //   pipeline -- so an edited passage still gets a proper polished PDF,
    //   not a rasterized screenshot of the editor canvas.
    // - returnJson: skip PDF assembly and return the structured level data
    //   as JSON instead, for the generator UI to hand off into Asset
    //   Modifier as separate editable Textbox objects.
    let levels: any[];
    if (Array.isArray(precomposedLevels) && precomposedLevels.length) {
      levels = precomposedLevels.map((lvl: any) => {
        const scored = fleschKincaidGrade(lvl.passage);
        return {
          levelLabel: lvl.levelLabel || 'Passage',
          targetGrade: Number(lvl.targetGrade),
          actualGrade: scored.grade,
          gradeGapFlag: Math.abs(scored.grade - Number(lvl.targetGrade)) > 2.5,
          exemplarsUsed: [],
          title: lvl.title, passage: lvl.passage,
          annotationGuide: lvl.annotationGuide || [], questions: lvl.questions || [],
        };
      });
    } else {
      const levelPlan = isDifferentiated
        ? TIERS.map((t) => ({ label: t.label, grade: Math.max(0.5, baseGrade + t.offset) }))
        : [{ label: null, grade: baseGrade }];
      levels = await Promise.all(levelPlan.map((p) => generateLevel(topic.trim(), p.grade, p.label, groundingBlock)));
    }

    if (returnJson) {
      const docTitleForJson = title?.trim() || `Reading Passage: ${topic.trim()}`;
      return NextResponse.json({ docTitle: docTitleForJson, levels });
    }

    const theme = await loadPartsTheme(userId, borderPartId, headerPartId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || `Reading Passage: ${topic.trim()}`;
    let illustrationImg: any = null;
    if (illustrationUrl) {
      try { illustrationImg = await embedIllustration(doc, illustrationUrl); } catch { illustrationImg = null; /* decorative, never block generation */ }
    } else if (autoIllustrate) {
      // Matches the original "Informational article pages... with
      // accompanying images" component from the Classroom Current Events
      // Periodical schema this whole generator branch exists to fulfill --
      // one image, generated once and reused across all levels of a
      // differentiated set, so Support/On-Level/Challenge genuinely look
      // like the same worksheet (Aj: "differentiated without looking
      // different"), not three different-looking documents.
      try {
        const { buffer, contentType } = await generateImageBuffer({
          prompt: `an editorial illustration for a classroom reading article about "${topic.trim()}", clean simple line art with light shading, black and white, plain white background, no text or labels in the image, journalistic non-fiction magazine illustration style`,
          provider: imageProvider,
        });
        illustrationImg = contentType === 'image/jpeg' ? await doc.embedJpg(buffer) : await doc.embedPng(buffer);
      try {
        const { buffer, contentType } = await generateImageBuffer({
          prompt: `an editorial illustration for a classroom reading article about "${topic.trim()}", clean simple line art with light shading, black and white, plain white background, no text or labels in the image, journalistic non-fiction magazine illustration style`,
          provider: imageProvider,
        });
        illustrationImg = contentType === 'image/jpeg' ? await doc.embedJpg(buffer) : await doc.embedPng(buffer);
      } catch (e) {
        console.error('reading-passage auto-illustration failed (non-fatal, passage still generates without an image):', errorMessage(e));
        illustrationImg = null; // decorative, never block generation
      }
    }

    for (const level of levels) {
      // ---- Passage page ----
      let page = doc.addPage([PAGE_W, PAGE_H]);
      await drawThemeBorder(doc, page, theme);
      let y = PAGE_H - 56;
      page.drawText(docTitle, { x: 54, y, size: 18, font: helvBold, color: NAVY });
      y -= 20;
      const subtitle = level.levelLabel && level.levelLabel !== 'Passage'
        ? `${level.levelLabel} -- Grade ${level.targetGrade.toFixed(1)} reading level`
        : `Grade ${level.targetGrade.toFixed(1)} reading level`;
      page.drawText(subtitle, { x: 54, y, size: 10, font: helv, color: GRAY });
      y -= 18;
      page.drawText('Name: _______________________________     Date: _______________', { x: 54, y, size: 11, font: helv, color: INK });
      y -= 28;

      let textWidth = PAGE_W - 108;
      if (illustrationImg) {
        const boxSize = 130;
        const scale = Math.min(boxSize / illustrationImg.width, boxSize / illustrationImg.height);
        const w = illustrationImg.width * scale, h = illustrationImg.height * scale;
        page.drawImage(illustrationImg, { x: PAGE_W - 54 - w, y: y - h + 20, width: w, height: h });
      }

      page.drawText(level.title || docTitle, { x: 54, y, size: 14, font: helvBold, color: NAVY });
      y -= 22;

      // Annotation guide legend box
      if (Array.isArray(level.annotationGuide) && level.annotationGuide.length) {
        page.drawText('WHILE YOU\'RE READING:', { x: 54, y, size: 9, font: helvBold, color: GRAY });
        y -= 13;
        for (const g of level.annotationGuide) {
          page.drawText(`${g.symbol}  ${g.meaning}`, { x: 60, y, size: 9, font: helv, color: GRAY });
          y -= 12;
        }
        y -= 8;
        page.drawLine({ start: { x: 54, y }, end: { x: PAGE_W - 54, y }, thickness: 0.5, color: LINE });
        y -= 16;
      }

      const bodyWidth = illustrationImg ? textWidth - 150 : textWidth;
      for (const line of wrapLines(level.passage, helv, 11.5, bodyWidth)) {
        if (y < 60) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
        page.drawText(line, { x: 54, y, size: 11.5, font: helv, color: INK });
        y -= 16;
      }

      // ---- Comprehension worksheet page ----
      let wPage = doc.addPage([PAGE_W, PAGE_H]);
      await drawThemeBorder(doc, wPage, theme);
      let wy = PAGE_H - 56;
      wPage.drawText('Show What You Know!', { x: 54, y: wy, size: 16, font: helvBold, color: NAVY });
      wy -= 18;
      wPage.drawText(level.levelLabel && level.levelLabel !== 'Passage' ? level.levelLabel : '', { x: 54, y: wy, size: 10, font: helv, color: GRAY });
      wy -= 24;

      const qs = Array.isArray(level.questions) ? level.questions : [];
      qs.forEach((q: any, i: number) => {
        if (wy < 100) { wPage = doc.addPage([PAGE_W, PAGE_H]); drawThemeBorder(doc, wPage, theme); wy = PAGE_H - 60; }
        const label = q.type === 'true_false' ? 'True or False' : q.type === 'fill_blank' ? 'Fill in the Blank' : 'Short Answer';
        for (const line of wrapLines(`${i + 1}. (${label}) ${q.prompt}`, helvBold, 11, PAGE_W - 108)) {
          wPage.drawText(line, { x: 54, y: wy, size: 11, font: helvBold, color: INK });
          wy -= 16;
        }
        if (q.type === 'short_answer') {
          for (let l = 0; l < 3; l++) {
            wy -= 16;
            wPage.drawLine({ start: { x: 54, y: wy }, end: { x: PAGE_W - 54, y: wy }, thickness: 0.75, color: LINE });
          }
        } else if (q.type === 'true_false') {
          wy -= 16;
          wPage.drawText('True          False', { x: 64, y: wy, size: 11, font: helv, color: INK });
        } else {
          wy -= 16;
          wPage.drawLine({ start: { x: 64, y: wy }, end: { x: 300, y: wy }, thickness: 0.75, color: LINE });
        }
        wy -= 18;
      });

      // ---- Answer key page ----
      let kPage = doc.addPage([PAGE_W, PAGE_H]);
      await drawThemeBorder(doc, kPage, theme);
      let ky = PAGE_H - 56;
      kPage.drawText(`Answer Key${level.levelLabel && level.levelLabel !== 'Passage' ? ` -- ${level.levelLabel}` : ''}`, { x: 54, y: ky, size: 16, font: helvBold, color: NAVY });
      ky -= 26;
      qs.forEach((q: any, i: number) => {
        if (ky < 80) { kPage = doc.addPage([PAGE_W, PAGE_H]); drawThemeBorder(doc, kPage, theme); ky = PAGE_H - 60; }
        for (const line of wrapLines(`${i + 1}. ${q.answer}`, helv, 11, PAGE_W - 108)) {
          kPage.drawText(line, { x: 54, y: ky, size: 11, font: helv, color: INK });
          ky -= 16;
        }
        ky -= 6;
      });
    }

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'reading-passage', `${docTitle}.pdf`);

    try { await incrementGenerationCount(userId, isDifferentiated ? SCHEMA_ID_DIFFERENTIATED : SCHEMA_ID_BASIC); } catch { /* non-fatal -- a tracking failure shouldn't fail a generation that already succeeded */ }

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`,
        'X-File-Url': encodeURIComponent(fileUrl),
        'X-Levels-Meta': encodeURIComponent(JSON.stringify(levels.map((l) => ({
          label: l.levelLabel, targetGrade: l.targetGrade, actualGrade: l.actualGrade, gradeGapFlag: l.gradeGapFlag, exemplarsUsed: l.exemplarsUsed,
        })))),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
