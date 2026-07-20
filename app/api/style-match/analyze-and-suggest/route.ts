import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import Anthropic from '@anthropic-ai/sdk';
import { getPdfPageCount, renderPdfPageToPng } from '@/lib/pdf-page-render';
import { getPageFonts } from '@/lib/pdf-layer-render';
import { extractPalette } from '@/lib/style-lab-vision';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

export const maxDuration = 60;

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const RENDER_SCALE = 1.5;

// Style Match & Meld (Aj, 2026-07-20): "when I upload a product, based on
// my free borders section heads fonts etc, [AI] picks the most similar
// ones to them that are free... AI tell me it is kind of like these two
// free ones melded together."
//
// This is deliberately a DIFFERENT pipeline from Separator, not a variant
// of it. Separator crops actual pixels out of the uploaded PDF (which is
// why those crops land in Needs Review pending copyright-safe editing).
// This route never crops or saves a single pixel from the upload -- it
// only asks Claude to DESCRIBE the border/header/icon style in its own
// words (the same as a person writing a review of a book without
// reproducing its text), then matches that description against Aj's own
// library_parts rows that are ALREADY source_type external_license or
// edited_derivative -- i.e. assets he already has clear rights to. The
// uploaded file's pixels never leave this function and are never stored.
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const userId = form.get('userId') as string;
    const file = form.get('file') as unknown as File | null;
    if (!userId || !file) {
      return NextResponse.json({ error: 'userId and file are required' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

    let pagePng: Buffer;
    if (isPdf) {
      const pageCount = await getPdfPageCount(bytes);
      pagePng = await renderPdfPageToPng(bytes, 1, RENDER_SCALE);
      void pageCount;
    } else {
      pagePng = bytes; // already an image (png/jpg upload)
    }

    // Palette is a deterministic pixel read, not a description of anyone's
    // creative expression -- colors aren't copyrightable, same reasoning
    // Separator already relies on for its own palette extraction.
    const img = await loadImage(pagePng);
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const palette = extractPalette(canvas);
    const fonts = isPdf ? await getPageFonts(bytes, 1) : [];

    // One vision call, description only -- explicitly told NOT to transcribe
    // any text or reproduce specifics, just characterize the visual style
    // in general terms (same standard as a design brief).
    const descRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pagePng.toString('base64') } },
          {
            type: 'text',
            text: `Describe the VISUAL STYLE of this teaching-resource page in general terms only -- do not transcribe any text, do not describe specific unique details that would identify the exact source. For each element present, describe: overall motif/theme, color family, line weight/style, shape/geometry. Return ONLY JSON, no markdown fences:
{"border": "<style description or null>", "section_header": "<style description or null>", "icon_illustration": "<style description or null>", "font_feel": "<e.g. 'playful rounded handwriting' or 'clean formal serif' or null>"}`,
          },
        ],
      }],
    });
    const raw = (descRes.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
    let styleDesc: any = {};
    try { styleDesc = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { styleDesc = {}; }

    // Match against Aj's OWN already-cleared library only -- never against
    // anything still in Needs Review, and never touching the upload again.
    const imageCategories = ['border', 'section_header', 'icon_illustration'] as const;
    const suggestions: Record<string, any> = {};

    for (const cat of imageCategories) {
      const description = styleDesc[cat];
      if (!description) { suggestions[cat] = null; continue; }

      const { data: candidates } = await admin
        .from('library_parts')
        .select('id, title, file_url, notes')
        .eq('user_id', userId).eq('category', cat).eq('pending_review', false)
        .in('source_type', ['external_license', 'edited_derivative'])
        .not('file_url', 'is', null)
        .limit(20);

      if (!candidates?.length) { suggestions[cat] = { description, matches: [], note: 'No free items in this category yet -- try Find Free Match in Needs Review first, or Style Match Search.' }; continue; }

      const content: any[] = [
        { type: 'text', text: `Target style to match: "${description}"\n\nHere are ${candidates.length} free-license items already in this teacher's library, each labeled with an index number:` },
      ];
      candidates.forEach((c: any, i: number) => {
        content.push({ type: 'text', text: `[${i}] "${c.title}"` });
        content.push({ type: 'image', source: { type: 'url', url: c.file_url } });
      });
      content.push({
        type: 'text',
        text: `Pick the 2 items whose visual style best matches the target (closest color family, motif, line style -- they don't need to be identical, just the closest available). Explain briefly how melding those two together would approximate the target style. Return ONLY JSON, no markdown fences: {"pickIndexes": [<int>, <int>], "rationale": "<1-2 sentences>"}`,
      });

      try {
        const matchRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-5', max_tokens: 300,
          messages: [{ role: 'user', content }],
        });
        const matchRaw = (matchRes.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
        const parsed = JSON.parse(matchRaw.replace(/```json|```/g, '').trim());
        const picks = (parsed.pickIndexes || []).map((i: number) => candidates[i]).filter(Boolean);
        suggestions[cat] = { description, matches: picks, rationale: parsed.rationale || null };
      } catch (e) {
        suggestions[cat] = { description, matches: candidates.slice(0, 2), rationale: null, matchError: errorMessage(e) };
      }
    }

    // Fonts: text-only match against Aj's own font_reference rows (already
    // derived data, not pixels, so no source_type filter needed -- every
    // font_reference row is safe by construction).
    let fontSuggestion: any = null;
    if (styleDesc.font_feel) {
      const { data: fontRows } = await admin
        .from('library_parts')
        .select('id, title')
        .eq('user_id', userId).eq('category', 'font_reference')
        .limit(50);
      if (fontRows?.length) {
        try {
          const fontRes = await anthropic.messages.create({
            model: 'claude-sonnet-4-5', max_tokens: 200,
            messages: [{
              role: 'user',
              content: `Target font feel: "${styleDesc.font_feel}"\n\nFonts already in this teacher's library: ${fontRows.map((f: any) => f.title).join(', ')}\n\nPick the single closest match. Return ONLY JSON: {"pick": "<exact font name from the list, or null if none are close>"}`,
            }],
          });
          const fontRaw = (fontRes.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
          const fontParsed = JSON.parse(fontRaw.replace(/```json|```/g, '').trim());
          fontSuggestion = { description: styleDesc.font_feel, match: fontRows.find((f: any) => f.title === fontParsed.pick) || null };
        } catch {
          fontSuggestion = { description: styleDesc.font_feel, match: null };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      palette: palette.map((c: any) => c.hex),
      detectedFonts: fonts,
      suggestions,
      fontSuggestion,
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
