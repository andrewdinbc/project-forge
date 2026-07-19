import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { getPageCount, renderPageWithLayers } from '@/lib/pdf-layer-render';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Schema Lab step 1 (Aj, 2026-07-19): analyzes a single resource's ACTIVITY
// TYPE/FORMAT -- what students physically DO (cut, fold, glue, color, drag,
// match, fill in a blank, flip a flap), and the recurring STRUCTURAL
// COMPONENTS (title page, KWL chart, N-flap foldable, prefilled answer-key
// version). This is a genuinely different question from analyze-components
// (which finds removable visual assets: borders, illustrations, palette) --
// interactive-notebook-style formats are largely conveyed by physical
// layout (fold lines, cut marks, flap shapes), which text extraction alone
// (Style Lab's existing layer_notes.structure) mostly misses. Uses vision
// on a SAMPLE of pages, not the whole document, to keep cost/time bounded --
// a resource's genre is usually legible from a handful of representative
// pages, not all of them.
//
// POST { userId, resourceId, pages? }
//   pages -- optional explicit page numbers to sample. Default: page 1 plus
//            up to 2 more evenly spread through the document (captures a
//            title/intro page AND at least one "in the activity" page).
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const { userId, resourceId, pages } = (await request.json()) || {};
    if (!userId || !resourceId) {
      return NextResponse.json({ error: 'userId and resourceId are required' }, { status: 400 });
    }

    const { data: resource, error } = await admin
      .from('forge_resources')
      .select('file_url, title')
      .eq('id', resourceId)
      .eq('user_id', userId)
      .single();
    if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    if (!resource.file_url) return NextResponse.json({ error: 'This resource has no PDF file' }, { status: 400 });

    const pdfRes = await fetch(resource.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

    const pageCount = await getPageCount(pdfBytes);
    let samplePages: number[];
    if (Array.isArray(pages) && pages.length > 0) {
      samplePages = pages.filter((p: any) => Number.isInteger(p) && p >= 1 && p <= pageCount).slice(0, 5);
    } else if (pageCount <= 3) {
      samplePages = Array.from({ length: pageCount }, (_, i) => i + 1);
    } else {
      samplePages = Array.from(new Set([1, Math.ceil(pageCount / 2), pageCount]));
    }
    if (samplePages.length === 0) samplePages = [1];

    const imageBlocks = [];
    for (const p of samplePages) {
      const png = await renderPageWithLayers(pdfBytes, p, { text: true, images: true }, 1.2);
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } });
    }

    const prompt = `You are looking at ${samplePages.length} sample page(s) (page ${samplePages.join(', ')} of ${pageCount} total) from a teaching resource called "${resource.title}".

Describe its ACTIVITY TYPE / FORMAT as a reusable GENRE -- never the specific subject-matter content (ignore what topic it's actually about; describe the STRUCTURE and INTERACTION pattern only, the way "color-by-number" or "task cards" or "interactive notebook foldable" are genre names independent of subject).

Cover:
- physicalFormat: what the student physically DOES with this page -- cut, fold, glue, color by code, drag/match, fill in blanks, flip a flap, trace, circle, etc. Be concrete about the mechanic (e.g. "folds a 3-panel flap inward, glues the back edge into a notebook" not just "interactive").
- structuralComponents: the recurring named PIECES this kind of resource is typically built from (e.g. "title page", "KWL chart", "foldable template (color version)", "foldable template (black & white version)", "prefilled answer-key version", "directions page"). List each as a short phrase.
- sequencePattern: how these pieces are typically ordered/related (e.g. "title page, then directions, then a color template followed by its matching prefilled answer version").
- notableConstraints: any format-defining constraints (e.g. "each foldable covers exactly one sub-topic", "always paired with an answer key").

Respond with ONLY valid JSON, no prose, no markdown:
{"physicalFormat": "...", "structuralComponents": ["...", "..."], "sequencePattern": "...", "notableConstraints": "..."}`;

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: prompt }],
      }],
    });
    const textBlock = resp.content.find((b: any) => b.type === 'text') as any;
    const raw = (textBlock?.text || '').replace(/```json|```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed) return NextResponse.json({ error: 'Could not parse the structural analysis -- try again' }, { status: 502 });

    const notes = {
      version: 1,
      samplePages,
      pageCount,
      physicalFormat: String(parsed.physicalFormat || ''),
      structuralComponents: Array.isArray(parsed.structuralComponents) ? parsed.structuralComponents.map(String) : [],
      sequencePattern: String(parsed.sequencePattern || ''),
      notableConstraints: String(parsed.notableConstraints || ''),
      analyzedAt: new Date().toISOString(),
    };

    await admin.from('forge_resources').update({ activity_structure_notes: notes }).eq('id', resourceId).eq('user_id', userId);

    return NextResponse.json({ ok: true, notes, title: resource.title });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
