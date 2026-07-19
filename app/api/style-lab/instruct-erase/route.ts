import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { getPageCount, renderPageWithLayers } from '@/lib/pdf-layer-render';
import { runLamaInpaint, buildMaskBuffer } from '@/lib/style-lab-inpaint';
import { loadImage } from '@napi-rs/canvas';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI Instruction Removal (Aj, 2026-07-19): "I want there to be an AI box
// that I can write instructions in such as 'remove Morpho Science from each
// page'." A free-text alternative to manually toggling components: describe
// what to remove, and it locates + blends it out across one page or the
// whole document, without needing analyze-components to have already run.
//
// Per page: render it, ask Claude vision to locate whatever matches the
// instruction (usually a small watermark/credit line/logo, not the main
// content), and if found, run it through the same LaMa fill as Smart Erase
// (app/api/style-lab/inpaint-view) via the shared lib/style-lab-inpaint.js.
// A page where nothing matches is reported as "not found", not an error --
// and one page erroring never blocks the rest (Promise.allSettled), same
// spirit as Hyperion never letting one bad task abort a whole run.
//
// POST { userId, resourceId, instruction, pages? }
//   pages -- optional array of page numbers. Omit to run every page.
export const maxDuration = 280;

async function processPage(
  pdfBytes: Buffer,
  page: number,
  instruction: string,
  resourceTitle: string,
  userId: string,
  resourceId: string
) {
  const png = await renderPageWithLayers(pdfBytes, page, { text: true, images: true }, 1.5);
  const img = await loadImage(png);
  const W = img.width, H = img.height;

  const prompt = `You are looking at page ${page} of a teaching-resource worksheet. Find the region(s) that match this removal instruction: "${instruction}"

This is almost always a small element -- a watermark, publisher credit line, logo, or specific text/label -- not the main worksheet content. If nothing on THIS page matches the instruction, say so; don't guess or return the whole page.

Respond with ONLY valid JSON, no prose, no markdown:
{"found": true, "boxes": [{"x":0,"y":0,"w":0,"h":0}]}
or
{"found": false, "boxes": []}
Boxes are FRACTIONS of the image (0..1), x/y = top-left corner.`;

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  const textBlock = resp.content.find((b: any) => b.type === 'text') as any;
  const raw = (textBlock?.text || '').replace(/```json|```/g, '').trim();
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { parsed = { found: false, boxes: [] }; }

  if (!parsed.found || !Array.isArray(parsed.boxes) || parsed.boxes.length === 0) {
    return { page, status: 'not_found' as const };
  }

  const maskBuf = await buildMaskBuffer(parsed.boxes, W, H);
  const maskPath = `${userId}/style-lab-masks/${resourceId}/instruct-${page}-${Date.now()}.png`;
  const { error: maskErr } = await admin.storage.from('design-assets').upload(maskPath, maskBuf, { contentType: 'image/png', upsert: true });
  if (maskErr) throw new Error(`Mask upload failed: ${maskErr.message}`);
  const { data: maskUrlData } = admin.storage.from('design-assets').getPublicUrl(maskPath);

  const srcPath = `${userId}/style-lab-instruct-src/${resourceId}/${page}-${Date.now()}.png`;
  const { error: srcErr } = await admin.storage.from('design-assets').upload(srcPath, png, { contentType: 'image/png', upsert: true });
  if (srcErr) throw new Error(`Source upload failed: ${srcErr.message}`);
  const { data: srcUrlData } = admin.storage.from('design-assets').getPublicUrl(srcPath);

  const resultUrl = await runLamaInpaint(srcUrlData.publicUrl, maskUrlData.publicUrl);
  const resultRes = await fetch(resultUrl);
  const resultBuf = Buffer.from(await resultRes.arrayBuffer());
  const outPath = `${userId}/style-lab-parts/${resourceId}/instruct-p${page}-${Date.now()}.png`;
  const { error: outErr } = await admin.storage.from('design-assets').upload(outPath, resultBuf, { contentType: 'image/png', upsert: true });
  if (outErr) throw new Error(`Result upload failed: ${outErr.message}`);
  const { data: outUrlData } = admin.storage.from('design-assets').getPublicUrl(outPath);

  const { data: inserted, error: insErr } = await admin
    .from('library_parts')
    .insert({
      user_id: userId,
      kind: 'image',
      source_id: `stylelab-instruct:${resourceId}:${page}:${Date.now()}`,
      title: `${resourceTitle || 'Resource'} — page ${page} cleaned`,
      category: 'style_lab_instruct_erase',
      notes: `Instruction: "${instruction}"`,
      file_url: outUrlData.publicUrl,
    })
    .select()
    .single();
  if (insErr) throw new Error(insErr.message);

  return { page, status: 'cleaned' as const, imageUrl: outUrlData.publicUrl, part: inserted };
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN is not set on this Vercel project yet. Add one from replicate.com/account/api-tokens, then this will work with no other changes.' },
        { status: 400 }
      );
    }

    const { userId, resourceId, instruction, pages } = (await request.json()) || {};
    if (!userId || !resourceId || !instruction || !String(instruction).trim()) {
      return NextResponse.json({ error: 'userId, resourceId, and instruction are required' }, { status: 400 });
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
    let targetPages: number[];
    if (Array.isArray(pages) && pages.length > 0) {
      targetPages = pages.filter((p: any) => Number.isInteger(p) && p >= 1 && p <= pageCount);
    } else {
      targetPages = Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    if (targetPages.length === 0) {
      return NextResponse.json({ error: 'No valid pages to process' }, { status: 400 });
    }

    const instructionStr = String(instruction).trim();
    const results = await Promise.allSettled(
      targetPages.map((p) => processPage(pdfBytes, p, instructionStr, resource.title, userId, resourceId))
    );

    const pageResults = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { page: targetPages[i], status: 'error' as const, error: r.reason?.message || String(r.reason) };
    });

    const cleaned = pageResults.filter((r) => r.status === 'cleaned').length;
    const notFound = pageResults.filter((r) => r.status === 'not_found').length;
    const errored = pageResults.filter((r) => r.status === 'error').length;

    return NextResponse.json({ ok: true, pageCount: targetPages.length, cleaned, notFound, errored, results: pageResults });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
