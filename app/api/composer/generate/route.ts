import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getComponentsForProducts, createHybridProduct } from '@/lib/product-components';
import { ASSEMBLY_ORDER } from '@/lib/component-categories';

interface GeneratedContentItem {
  category: string;
  label: string;
  content: string;
}

interface GenerateRequestBody {
  userId: string;
  title: string;
  productIds: string[];
  // Per-category picks: which componentIds to include (0, 1, or many --
  // multiple tagged items within the same category, even from different
  // source products, can all be included at once now). Empty/missing
  // array means that category is excluded entirely. This is what the
  // composer's per-item toggles resolve to on the client before calling
  // this endpoint. (2026-07-19: widened from a single componentId per
  // category to an array, so items no longer have to compete for one slot.)
  selections: Record<string, string[]>;
  // 2026-07-19: AI-generated text content filling a genuine gap (e.g. no
  // tagged product has a real Force and Motion color-by-number) --
  // written by /api/composer/apply-keywords, approved for inclusion by
  // the teacher in the composer UI. Not a real source page -- rendered
  // fresh onto new PDF page(s) here rather than copied from a file.
  generatedContent?: GeneratedContentItem[];
}

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const BODY_SIZE = 11;
const TITLE_SIZE = 18;
const LINE_HEIGHT = 15;

// Wraps a single line of text to fit within maxWidth, using the given font
// and size. pdf-lib doesn't do this for you.
function wrapLine(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Renders AI-generated text content onto one or more new PDF pages
// (paginating automatically as content overflows a page), since this
// content has no source PDF to copy pages from.
async function renderGeneratedContentPages(pdfDoc: PDFDocument, item: GeneratedContentItem) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(item.label, { x: MARGIN, y, size: TITLE_SIZE, font: boldFont, color: rgb(0.11, 0.21, 0.34) });
  y -= TITLE_SIZE + 10;
  page.drawText('AI-Generated', { x: MARGIN, y, size: 9, font, color: rgb(0.55, 0.55, 0.55) });
  y -= 20;

  const paragraphs = item.content.split('\n');
  for (const paragraph of paragraphs) {
    const lines = paragraph.trim() ? wrapLine(paragraph, font, BODY_SIZE, maxWidth) : [''];
    for (const line of lines) {
      if (y < MARGIN + LINE_HEIGHT) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      if (line) page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE_HEIGHT;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequestBody = await request.json();
    const { userId, title, productIds, selections, generatedContent } = body;

    if (!userId || !title || !productIds?.length || !selections) {
      return NextResponse.json(
        { error: 'userId, title, productIds, and selections are required' },
        { status: 400 }
      );
    }

    const allComponents = await getComponentsForProducts(productIds);
    const componentsById = new Map(allComponents.map((c: any) => [c.id, c]));

    const hybridDoc = await PDFDocument.create();
    const skipped: string[] = [];
    const included: string[] = [];

    const generatedByCategory = new Map<string, GeneratedContentItem[]>();
    for (const g of generatedContent || []) {
      const list = generatedByCategory.get(g.category) || [];
      list.push(g);
      generatedByCategory.set(g.category, list);
    }

    // Assemble in a fixed, sensible order (front matter, then
    // instructional content, then classroom materials) regardless of the
    // order categories were selected in, so the output reads like a real
    // TPT resource rather than a random shuffle. Within a category,
    // multiple included items are appended in the order their IDs appear
    // in the selection array (client sends them in tagged/sort_order),
    // followed by any AI-generated fill content for that category.
    for (const categoryKey of ASSEMBLY_ORDER) {
      const componentIds = selections[categoryKey];
      if (componentIds && componentIds.length > 0) {
        for (const componentId of componentIds) {
          const component: any = componentsById.get(componentId);
          const label = `${categoryKey}${component ? ` (${component.products?.title || 'unknown source'})` : ''}`;
          if (!component) {
            skipped.push(`${label}: component not found`);
            continue;
          }

          const sourceFileUrl = component.products?.file_url;
          if (!sourceFileUrl) {
            skipped.push(`${label}: source product has no file_url`);
            continue;
          }

          try {
            const pdfRes = await fetch(sourceFileUrl);
            if (!pdfRes.ok) {
              skipped.push(`${label}: failed to fetch source PDF (${pdfRes.status})`);
              continue;
            }
            const pdfBytes = await pdfRes.arrayBuffer();
            const sourceDoc = await PDFDocument.load(pdfBytes);

            // page_start/page_end are 1-indexed and inclusive as tagged by the user.
            const pageCount = sourceDoc.getPageCount();
            const startIdx = Math.max(0, component.page_start - 1);
            const endIdx = Math.min(pageCount - 1, component.page_end - 1);
            if (startIdx > endIdx) {
              skipped.push(`${label}: invalid page range for source PDF (${pageCount} pages)`);
              continue;
            }
            const indices = [];
            for (let i = startIdx; i <= endIdx; i++) indices.push(i);

            const copiedPages = await hybridDoc.copyPages(sourceDoc, indices);
            copiedPages.forEach((p) => hybridDoc.addPage(p));
            included.push(label);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            skipped.push(`${label}: ${msg}`);
          }
        }
      }

      const generatedForCategory = generatedByCategory.get(categoryKey) || [];
      for (const g of generatedForCategory) {
        try {
          await renderGeneratedContentPages(hybridDoc, g);
          included.push(`${categoryKey} (AI-generated: ${g.label})`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          skipped.push(`${categoryKey} (AI-generated: ${g.label}): ${msg}`);
        }
      }
    }

    if (included.length === 0) {
      return NextResponse.json(
        { error: 'No components could be assembled', skipped },
        { status: 422 }
      );
    }

    const hybridBytes = await hybridDoc.save();

    // Record composition history/provenance before returning the file, so
    // it's tracked even if the download itself never completes client-side.
    await createHybridProduct(userId, {
      title,
      source_product_ids: productIds,
      selections,
    });

    return new NextResponse(new Uint8Array(hybridBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title.replace(/\s+/g, '-')}-hybrid.pdf"`,
        'X-Included-Categories': included.join(','),
        'X-Skipped-Categories': skipped.length ? encodeURIComponent(skipped.join(' | ')) : '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
