import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { renderPageAsImage } from 'unpdf';
import Anthropic from '@anthropic-ai/sdk';
import { getSchema } from '@/lib/schema-lab';
import { createResource, buildSteeringContext } from '@/lib/style-lab';
import { CURRICULUM_ELABORATIONS, ELABORATIONS_SUBJECT_MAP } from '@/lib/curriculum-full-elaborations';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';
import { classifyComponents, drawCoverPage, drawTOCPage, drawDirectionsPage, drawTextPage } from '@/lib/inb-generator';
import { FOLDABLE_SHAPES, drawFlapBook, drawLayeredBook, drawRadialFoldable, drawTwoPanelComparison, drawPuzzlePiece, drawSilhouetteCard } from '@/lib/foldable-shapes';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BC_ALIASES = ['bc', 'british columbia', 'british columbia, canada'];
const PAGE_W = 612; // US Letter portrait -- unlike the landscape Foldable Shapes preview page,
const PAGE_H = 792; // a full notebook reads better portrait; shape draw functions are orientation-agnostic.
const MARGIN = 40;

const SHAPE_DRAWERS: Record<string, (page: any, opts: any) => void> = {
  'flap-book': drawFlapBook,
  'layered-book': drawLayeredBook,
  'radial-foldable': drawRadialFoldable,
  'two-panel-comparison': drawTwoPanelComparison,
  'puzzle-piece': drawPuzzlePiece,
  'silhouette-card': drawSilhouetteCard,
};

export const maxDuration = 180;

// Interactive Notebook Generator (Aj, 2026-07-20): the closing piece of
// Schema Lab -> Foldable Shape Library. POST { userId, schemaId, subject,
// grade, topic?, jurisdiction?, styleProfileId? } (same inputs as
// /api/schema-lab/generate) -> ONE assembled, printable, multi-page PDF
// with real cut/fold geometry, not just structural text content.
//
// Single AI call generates content for every component that needs actual
// subject-matter writing (shape sub-items + free-text pages) together, so
// the model can cross-reference itself (e.g. the auto-written Answer Key
// page can accurately summarize the foldables it just wrote). Cover, table
// of contents, and assembly directions are 100% code -- no AI call, no risk
// of hallucinated page order -- see lib/inb-generator.ts classifyComponents.
export async function POST(request: NextRequest) {
  try {
    const { userId, schemaId, subject, grade, topic, jurisdiction, styleProfileId } = (await request.json()) || {};
    if (!userId || !schemaId || !subject || !grade) {
      return NextResponse.json({ error: 'userId, schemaId, subject, and grade are required' }, { status: 400 });
    }

    const schema = await getSchema(userId, schemaId);
    if (!schema) return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    let schemaData: any;
    try { schemaData = JSON.parse(schema.structural_summary); } catch { schemaData = { structuralSummary: schema.structural_summary, components: [] }; }
    const rawComponents = (schemaData.components || []).map((c: any) => ({ name: c.name, purpose: c.purpose || '' }));
    if (rawComponents.length === 0) {
      return NextResponse.json({ error: 'This schema has no structural components to generate from.' }, { status: 400 });
    }
    const classified = classifyComponents(rawComponents);

    const jur = (jurisdiction || 'British Columbia, Canada').trim();
    const isBC = BC_ALIASES.includes(jur.toLowerCase());
    let curriculumBlock: string;
    if (isBC) {
      const subjectKey = (ELABORATIONS_SUBJECT_MAP as any)[subject];
      const curriculumGrade = subjectKey ? (CURRICULUM_ELABORATIONS as any)[subjectKey]?.[grade] : null;
      curriculumBlock = curriculumGrade
        ? `Official BC Curriculum for ${subject}, Grade ${grade}:\nBig Ideas: ${curriculumGrade.bigIdeas.join(' | ')}\nContent: ${curriculumGrade.content.join(' | ')}`
        : `No structured BC curriculum data found for ${subject} Grade ${grade} -- use general grade-appropriate BC curriculum knowledge.`;
    } else {
      curriculumBlock = `Jurisdiction: ${jur}. Use general knowledge of ${jur}'s official curriculum standards for ${subject}, Grade ${grade}. Stay conservative rather than inventing specific standard codes you're not confident about.`;
    }
    const steeringContext = await buildSteeringContext(userId).catch(() => '');

    // Build the per-component generation spec -- this is what turns free-text
    // schema components into a concrete, parseable AI task.
    const genSpecs = classified
      .filter((c) => c.kind === 'shape' || c.kind === 'text')
      .map((c) => {
        if (c.kind === 'shape' && c.shape) {
          const outlineNote = c.shape.shapeKey === 'silhouette-card' ? ' Also choose "outline": one of "circle"|"banner"|"badge"|"cloud" that best fits the term.' : '';
          return `- "${c.name}" (purpose: ${c.purpose}) -> SHAPE type "${c.shape.shapeName}", needs exactly ${c.shape.count} labeled sub-items. Return "labels" (array of ${c.shape.count} short 2-5 word labels) and "contents" (array of ${c.shape.count} matching 1-2 sentence, grade-${grade}-appropriate explanations).${outlineNote}`;
        }
        return `- "${c.name}" (purpose: ${c.purpose}) -> TEXT page. Return "content": 3-5 sentences of real, grade-${grade}-appropriate subject content. If this is an answer-key/summary-style component, accurately summarize the other components' content you are writing in this same response.`;
      })
      .join('\n');

    const prompt = `You are writing WHOLLY ORIGINAL instructional content for a NEW interactive notebook, following a specific reusable activity-type SCHEMA, on a NEW subject. Do not reference or reproduce any existing published resource's specific content.

Activity type: "${schema.name}"
Schema definition: ${schemaData.structuralSummary}

New subject: ${subject}
Grade: ${grade}
${topic ? `Topic/focus: ${topic}` : ''}

${curriculumBlock}
${steeringContext}

For EACH component below, generate exactly the fields specified:
${genSpecs}

Respond with ONLY valid JSON, no prose, no markdown:
{"title": "a title for this notebook", "components": [{"name": "component name exactly matching one above", "content": "...(TEXT components only)", "labels": ["..."], "contents": ["..."], "outline": "...(silhouette-card only)"}]}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b: any) => (b as any).type === 'text') as any;
    const text = (raw?.text || '{}').replace(/```json|```/g, '').trim();
    let generated: any;
    try {
      generated = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      generated = match ? JSON.parse(match[0]) : { title: `${schema.name} \u2014 ${subject}`, components: [] };
    }
    const genByName: Record<string, any> = {};
    for (const c of generated.components || []) genByName[c.name] = c;

    // ---- Assemble the actual PDF ----
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const title = generated.title || `${schema.name} \u2014 ${subject} Grade ${grade}`;

    const coverPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawCoverPage(coverPage, { width: PAGE_W, height: PAGE_H, title, subject, grade, jurisdiction: jur, font, boldFont });

    const renderable = classified.filter((c) => c.kind !== 'skip' && c.kind !== 'auto');
    const tocItems = renderable.map((c) => c.name);
    const tocPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawTOCPage(tocPage, { width: PAGE_W, height: PAGE_H, items: tocItems, font, boldFont });

    const directionsItems: { label: string; instructions: string }[] = [];
    const skippedComponents: string[] = classified.filter((c) => c.kind === 'skip').map((c) => c.name);
    const failedComponents: string[] = [];

    for (const c of renderable) {
      const g = genByName[c.name];
      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      if (c.kind === 'shape' && c.shape) {
        const shapeDef = FOLDABLE_SHAPES.find((s: any) => s.key === c.shape!.shapeKey) as any;
        const count = Math.max(shapeDef.minCount, Math.min(shapeDef.maxCount, (g?.labels || []).length || c.shape.count));
        const labels = (g?.labels || []).slice(0, count);
        const contents = (g?.contents || []).slice(0, count);
        if (labels.length === 0) {
          failedComponents.push(c.name);
          drawTextPage(page, { width: PAGE_W, height: PAGE_H, title: c.name, content: '(Content generation for this foldable did not return usable data -- try regenerating.)', font, boldFont });
        } else {
          const drawOpts: any = {
            x: MARGIN, y: MARGIN + 30, width: PAGE_W - MARGIN * 2, height: PAGE_H - MARGIN * 2 - 90,
            count, labels, contents, font, boldFont,
          };
          if (c.shape.shapeKey === 'silhouette-card') drawOpts.outline = g?.outline || 'circle';
          page.drawText(c.name, { x: MARGIN, y: PAGE_H - MARGIN, size: 14, font: boldFont, color: rgbNavy() });
          SHAPE_DRAWERS[c.shape.shapeKey](page, drawOpts);
          directionsItems.push({ label: c.name, instructions: `Cut/fold this ${shapeDef.name} as shown on the page, then glue it into your notebook.` });
        }
      } else {
        const content = g?.content || `(No content generated for "${c.name}" -- try regenerating.)`;
        if (!g?.content) failedComponents.push(c.name);
        drawTextPage(page, { width: PAGE_W, height: PAGE_H, title: c.name, content, font, boldFont });
        directionsItems.push({ label: c.name, instructions: 'Glue this page directly into your notebook (no cutting/folding needed).' });
      }
    }

    const directionsPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawDirectionsPage(directionsPage, { width: PAGE_W, height: PAGE_H, items: directionsItems, font, boldFont });

    const pdfBytes = await pdfDoc.save();
    const pdfDataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`;

    const coverPng = await renderPageAsImage(new Uint8Array(pdfBytes), 1, { canvas: (() => import('@napi-rs/canvas')) as any, scale: 1.3 });

    const basePath = `${userId}/inb-generated/${Date.now()}`;
    const { error: pdfUpErr } = await admin.storage.from('design-assets').upload(`${basePath}.pdf`, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true });
    if (pdfUpErr) throw new Error(`PDF storage upload failed: ${pdfUpErr.message}`);
    const { data: pdfUrlData } = admin.storage.from('design-assets').getPublicUrl(`${basePath}.pdf`);

    await admin.storage.from('design-assets').upload(`${basePath}-cover.png`, coverPng, { contentType: 'image/png', upsert: true }).catch(() => null);
    const { data: coverUrlData } = admin.storage.from('design-assets').getPublicUrl(`${basePath}-cover.png`);

    const saved = await createResource(userId, {
      subject, source_type: 'pdf', origin: 'inb_generated',
      title, file_url: pdfUrlData.publicUrl,
      original_text: `Interactive Notebook generated from schema "${schema.name}" for ${subject} Grade ${grade} (${jur}).`,
    });

    return NextResponse.json({
      ok: true,
      title,
      pdfDataUrl,
      pdfUrl: pdfUrlData.publicUrl,
      coverImageUrl: coverUrlData.publicUrl,
      pageCount: renderable.length + 3,
      savedResourceId: saved.id,
      schemaName: schema.name,
      componentPlan: classified.map((c) => ({ name: c.name, kind: c.kind, shapeKey: c.shape?.shapeKey || null })),
      skippedComponents,
      failedComponents,
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

function rgbNavy() {
  // local import avoidance -- pdf-lib's rgb() is cheap to re-call here
  const { rgb } = require('pdf-lib');
  return rgb(0.11, 0.21, 0.34);
}
