import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getComponentsForProducts } from '@/lib/product-components';
import { ASSEMBLY_ORDER } from '@/lib/component-categories';

// Live preview companion to /api/composer/generate -- same page-assembly
// logic, but returns the PDF inline (for embedding in an <iframe>) instead
// of as a download, and never records composition history. Called on
// every toggle change in the Composer UI (debounced client-side) so a
// teacher can see exactly what removing a cover page, an extension
// activity, etc. actually looks like before committing to it. Per Aj,
// 2026-07-19: "I want to see what that looks like live."
interface GeneratedContentItem {
  category: string;
  label: string;
  content: string;
}

interface PreviewRequestBody {
  productIds: string[];
  selections: Record<string, string[]>;
  generatedContent?: GeneratedContentItem[];
  libraryParts?: { category: string; fileUrl: string; title: string }[];
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const BODY_SIZE = 11;
const TITLE_SIZE = 18;
const LINE_HEIGHT = 15;

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

// Mirrors renderImagePage in /api/composer/generate -- same reasoning,
// kept as a parallel copy rather than a shared import since preview and
// generate were already two independent copies of the assembly logic
// before this (wrapLine, renderGeneratedContentPages) and this follows
// that existing pattern rather than introducing a partial refactor.
async function renderImagePage(pdfDoc: PDFDocument, imageUrl: string, label: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let image;
  try {
    image = await pdfDoc.embedPng(bytes);
  } catch {
    image = await pdfDoc.embedJpg(bytes);
  }
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const maxW = PAGE_WIDTH - MARGIN * 2;
  const maxH = PAGE_HEIGHT - MARGIN * 2 - 24;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const w = image.width * scale, h = image.height * scale;
  page.drawImage(image, { x: (PAGE_WIDTH - w) / 2, y: (PAGE_HEIGHT - h) / 2 - 12, width: w, height: h });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(label, { x: MARGIN, y: MARGIN / 2, size: 9, font, color: rgb(0.55, 0.55, 0.55) });
}

export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequestBody = await request.json();
    const { productIds, selections, generatedContent, libraryParts } = body;

    if (!productIds?.length || !selections) {
      return NextResponse.json({ error: 'productIds and selections are required' }, { status: 400 });
    }

    const hasAnySelection = Object.values(selections).some((ids) => ids.length > 0) || (generatedContent?.length || 0) > 0 || (libraryParts?.length || 0) > 0;
    if (!hasAnySelection) {
      return NextResponse.json({ error: 'Nothing selected yet' }, { status: 422 });
    }

    const allComponents = await getComponentsForProducts(productIds);
    const componentsById = new Map(allComponents.map((c: any) => [c.id, c]));
    const previewDoc = await PDFDocument.create();

    const generatedByCategory = new Map<string, GeneratedContentItem[]>();
    for (const g of generatedContent || []) {
      const list = generatedByCategory.get(g.category) || [];
      list.push(g);
      generatedByCategory.set(g.category, list);
    }

    const libraryByCategory = new Map<string, { category: string; fileUrl: string; title: string }[]>();
    for (const p of libraryParts || []) {
      if (!p.category || !p.fileUrl) continue;
      const list = libraryByCategory.get(p.category) || [];
      list.push(p);
      libraryByCategory.set(p.category, list);
    }

    let anyPageAdded = false;

    for (const categoryKey of ASSEMBLY_ORDER) {
      const componentIds = selections[categoryKey];
      if (componentIds && componentIds.length > 0) {
        for (const componentId of componentIds) {
          const component: any = componentsById.get(componentId);
          if (!component?.products?.file_url) continue;
          try {
            const pdfRes = await fetch(component.products.file_url);
            if (!pdfRes.ok) continue;
            const pdfBytes = await pdfRes.arrayBuffer();
            const sourceDoc = await PDFDocument.load(pdfBytes);
            const pageCount = sourceDoc.getPageCount();
            const startIdx = Math.max(0, component.page_start - 1);
            const endIdx = Math.min(pageCount - 1, component.page_end - 1);
            if (startIdx > endIdx) continue;
            const indices = [];
            for (let i = startIdx; i <= endIdx; i++) indices.push(i);
            const copiedPages = await previewDoc.copyPages(sourceDoc, indices);
            copiedPages.forEach((p) => previewDoc.addPage(p));
            anyPageAdded = true;
          } catch {
            // Preview is best-effort -- silently skip pages that fail to
            // load rather than surfacing an error for a live-updating view.
          }
        }
      }

      for (const g of generatedByCategory.get(categoryKey) || []) {
        try {
          await renderGeneratedContentPages(previewDoc, g);
          anyPageAdded = true;
        } catch {
          // best-effort, same as above
        }
      }

      for (const p of libraryByCategory.get(categoryKey) || []) {
        try {
          await renderImagePage(previewDoc, p.fileUrl, `${categoryKey} (Parts Library: ${p.title})`);
          anyPageAdded = true;
        } catch {
          // best-effort, same as above
        }
      }
    }

    if (!anyPageAdded) {
      return NextResponse.json({ error: 'None of the selected pages could be loaded for preview' }, { status: 422 });
    }

    const previewBytes = await previewDoc.save();
    return new NextResponse(new Uint8Array(previewBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
