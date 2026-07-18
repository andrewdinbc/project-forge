import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';
import { getProduct } from '@/lib/products';
import { deleteAllComponentsForProduct, addComponents } from '@/lib/product-components';
import { CATEGORY_GROUPS } from '@/lib/component-categories';

// AI auto-tagging: reads a product's PDF page-by-page and identifies which
// pages belong to which structural category (Cover Page, Answer Keys,
// Teacher Instructions, etc.), replacing the need to manually tag every
// page one at a time. Per Aj, 2026-07-18: "I want the AI to identify these
// components and 'tag' them."
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Categories that genuinely map to a distinct page or page range in a
// real document. The four "Visual & Professional Polish" categories
// (clean_fonts, borders_layout, branding_copyright, student_ready_formatting)
// are cross-cutting style attributes, not discrete sections -- told to the
// model as optional/skippable rather than forced onto a page range that
// doesn't really represent them.
const STYLE_ONLY = ['clean_fonts', 'borders_layout', 'branding_copyright', 'student_ready_formatting'];

export async function POST(request: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const body = await request.json();
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const product = await getProduct(params.productId, userId);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.file_url) return NextResponse.json({ error: 'This product has no file uploaded yet' }, { status: 400 });

    const pdfRes = await fetch(product.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const buffer = Buffer.from(await pdfRes.arrayBuffer());

    // Extract text per page (not just the whole-document blob) so the
    // model can reason about which SPECIFIC pages a category belongs to.
    const pages: string[] = [];
    function renderPage(pageData: any) {
      return pageData.getTextContent().then((textContent: any) => {
        const text = textContent.items.map((item: any) => item.str).join(' ');
        pages.push(text);
        return text;
      });
    }
    await pdfParse(buffer, { pagerender: renderPage });

    if (pages.length === 0) {
      return NextResponse.json({ error: 'Could not read any pages from this PDF' }, { status: 422 });
    }

    const pageSummaries = pages
      .map((text, i) => `Page ${i + 1}: ${text.replace(/\s+/g, ' ').trim().slice(0, 400) || '(no extractable text -- likely an image-heavy page)'}`)
      .join('\n\n');

    const categoryList = CATEGORY_GROUPS.flatMap((g) => g.categories)
      .map((c) => `- ${c.key}: ${c.label} -- ${c.description}`)
      .join('\n');

    const prompt = `You are identifying the structural components of a TPT (Teachers Pay Teachers) educational resource by reading its pages.

Document: "${product.title}" (${pages.length} pages)

Page-by-page text:
${pageSummaries}

Categories to identify (only tag a category if you're genuinely confident a page or page range matches it -- skip anything uncertain, don't force every category to exist):
${categoryList}

Notes:
- ${STYLE_ONLY.join(', ')} are document-wide style attributes, not distinct pages -- only include them if there's a clearly representative page/section, otherwise omit them entirely.
- Page ranges are 1-indexed and inclusive.
- Most documents won't have every category -- that's normal, only tag what's actually there.

Respond with ONLY a JSON array, no markdown fences, no other text:
[{"category": "category_key", "label": "short label", "page_start": 1, "page_end": 1, "notes": "brief reason for this tag"}]`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b) => b.type === 'text')?.text || '[]';
    const tagged = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const validKeys = new Set(CATEGORY_GROUPS.flatMap((g) => g.categories.map((c) => c.key)));
    const cleaned = tagged.filter((t: any) =>
      validKeys.has(t.category) && Number.isInteger(t.page_start) && Number.isInteger(t.page_end) &&
      t.page_start >= 1 && t.page_end <= pages.length && t.page_end >= t.page_start
    );

    // Re-running auto-tag replaces the previous AI pass rather than piling
    // duplicates on top -- manual tags a teacher added by hand are a
    // separate concern (component IDs from this route are all new anyway,
    // this doesn't distinguish AI-tagged from manually-tagged, which is a
    // known limitation worth revisiting if that mix becomes common).
    await deleteAllComponentsForProduct(params.productId);
    const saved = await addComponents(params.productId, cleaned);

    return NextResponse.json({ components: saved, pageCount: pages.length, taggedCount: saved.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
