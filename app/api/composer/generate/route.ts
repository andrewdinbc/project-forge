import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { getComponentsForProducts, createHybridProduct } from '@/lib/product-components';
import { ASSEMBLY_ORDER } from '@/lib/component-categories';

interface GenerateRequestBody {
  userId: string;
  title: string;
  productIds: string[];
  // Per-category pick: which componentId to use, or null to exclude that
  // category entirely from the hybrid. This is what the composer's
  // sliders resolve to on the client before calling this endpoint.
  selections: Record<string, string | null>;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequestBody = await request.json();
    const { userId, title, productIds, selections } = body;

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

    // Assemble in a fixed, sensible order (front matter, then
    // instructional content, then classroom materials) regardless of the
    // order categories were selected in, so the output reads like a real
    // TPT resource rather than a random shuffle.
    for (const categoryKey of ASSEMBLY_ORDER) {
      const componentId = selections[categoryKey];
      if (!componentId) continue; // excluded for this category

      const component: any = componentsById.get(componentId);
      if (!component) {
        skipped.push(`${categoryKey}: component not found`);
        continue;
      }

      const sourceFileUrl = component.products?.file_url;
      if (!sourceFileUrl) {
        skipped.push(`${categoryKey}: source product has no file_url`);
        continue;
      }

      try {
        const pdfRes = await fetch(sourceFileUrl);
        if (!pdfRes.ok) {
          skipped.push(`${categoryKey}: failed to fetch source PDF (${pdfRes.status})`);
          continue;
        }
        const pdfBytes = await pdfRes.arrayBuffer();
        const sourceDoc = await PDFDocument.load(pdfBytes);

        // page_start/page_end are 1-indexed and inclusive as tagged by the user.
        const pageCount = sourceDoc.getPageCount();
        const startIdx = Math.max(0, component.page_start - 1);
        const endIdx = Math.min(pageCount - 1, component.page_end - 1);
        if (startIdx > endIdx) {
          skipped.push(`${categoryKey}: invalid page range for source PDF (${pageCount} pages)`);
          continue;
        }
        const indices = [];
        for (let i = startIdx; i <= endIdx; i++) indices.push(i);

        const copiedPages = await hybridDoc.copyPages(sourceDoc, indices);
        copiedPages.forEach((p) => hybridDoc.addPage(p));
        included.push(categoryKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        skipped.push(`${categoryKey}: ${msg}`);
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
