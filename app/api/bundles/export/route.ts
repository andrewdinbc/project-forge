import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const {
      format,
      bundleName,
      bundleDescription,
      bundledProducts,
      totalPrice,
    } = await request.json();

    if (format === 'pdf' || format === 'both') {
      const pdfBuffer = await generatePDF({
        bundleName,
        bundleDescription,
        bundledProducts,
        totalPrice,
      });

      if (format === 'pdf') {
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${bundleName.replace(/\s+/g, '-')}-bundle.pdf"`,
          },
        });
      }

      if (format === 'both') {
        const zipBuffer = await generateZip({
          bundleName,
          bundleDescription,
          bundledProducts,
          totalPrice,
          pdfBuffer,
        });

        return new NextResponse(zipBuffer, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${bundleName.replace(/\s+/g, '-')}-bundle.zip"`,
          },
        });
      }
    }

    if (format === 'zip') {
      const pdfBuffer = await generatePDF({
        bundleName,
        bundleDescription,
        bundledProducts,
        totalPrice,
      });

      const zipBuffer = await generateZip({
        bundleName,
        bundleDescription,
        bundledProducts,
        totalPrice,
        pdfBuffer,
      });

      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${bundleName.replace(/\s+/g, '-')}-bundle.zip"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export bundle' },
      { status: 500 }
    );
  }
}

async function generatePDF({
  bundleName,
  bundleDescription,
  bundledProducts,
  totalPrice,
}: {
  bundleName: string;
  bundleDescription: string;
  bundledProducts: any[];
  totalPrice: number;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const fontSize = 12;
  const boldFontSize = 14;
  const titleFontSize = 24;
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let yPosition = height - 50;

  // Title
  page.drawText(bundleName, {
    x: 50,
    y: yPosition,
    size: titleFontSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  // Description
  if (bundleDescription) {
    page.drawText(bundleDescription, {
      x: 50,
      y: yPosition,
      size: fontSize,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
      maxWidth: width - 100,
    });
    yPosition -= 40;
  }

  // Products Header
  page.drawText('Bundle Contents', {
    x: 50,
    y: yPosition,
    size: boldFontSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;

  // Products Table Header
  const tableX = 50;
  const colWidths = { name: 300, qty: 80, price: 100 };

  page.drawText('Product', {
    x: tableX,
    y: yPosition,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Qty', {
    x: tableX + colWidths.name,
    y: yPosition,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Price', {
    x: tableX + colWidths.name + colWidths.qty,
    y: yPosition,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 15;

  // Draw separator line
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  yPosition -= 15;

  // Products
  for (const product of bundledProducts) {
    const itemTotal = (product.price * product.quantity).toFixed(2);

    page.drawText(product.title.substring(0, 35), {
      x: tableX,
      y: yPosition,
      size: fontSize,
      font: helvetica,
      color: rgb(0, 0, 0),
    });

    page.drawText(product.quantity.toString(), {
      x: tableX + colWidths.name,
      y: yPosition,
      size: fontSize,
      font: helvetica,
      color: rgb(0, 0, 0),
    });

    page.drawText(`$${itemTotal}`, {
      x: tableX + colWidths.name + colWidths.qty,
      y: yPosition,
      size: fontSize,
      font: helvetica,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;

    // Check if we need a new page
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
      page = newPage;
    }
  }

  // Separator
  yPosition -= 10;
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  yPosition -= 20;

  // Total
  page.drawText('Total Price:', {
    x: tableX + colWidths.name,
    y: yPosition,
    size: boldFontSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  page.drawText(`$${totalPrice.toFixed(2)}`, {
    x: tableX + colWidths.name + colWidths.qty,
    y: yPosition,
    size: boldFontSize,
    font: helveticaBold,
    color: rgb(0.2, 0.6, 0.2),
  });

  // Footer
  page.drawText(
    `Generated on ${new Date().toLocaleDateString()} • Chalk & Circuit`,
    {
      x: 50,
      y: 30,
      size: 10,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    }
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function generateZip({
  bundleName,
  bundleDescription,
  bundledProducts,
  totalPrice,
  pdfBuffer,
}: {
  bundleName: string;
  bundleDescription: string;
  bundledProducts: any[];
  totalPrice: number;
  pdfBuffer: Buffer;
}): Promise<Buffer> {
  const zip = new JSZip();

  // Add PDF
  zip.file(`${bundleName.replace(/\s+/g, '-')}.pdf`, pdfBuffer);

  // Add JSON manifest
  const manifest = {
    bundleName,
    bundleDescription,
    createdAt: new Date().toISOString(),
    totalPrice,
    itemCount: bundledProducts.reduce((sum, p) => sum + p.quantity, 0),
    productCount: bundledProducts.length,
    products: bundledProducts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      quantity: p.quantity,
      subtotal: p.price * p.quantity,
    })),
  };

  zip.file('bundle-manifest.json', JSON.stringify(manifest, null, 2));

  // Add CSV for spreadsheet compatibility
  const csvHeader = 'Product,Quantity,Price,Subtotal\n';
  const csvRows = bundledProducts
    .map(
      (p) =>
        `"${p.title.replace(/"/g, '""')}",${p.quantity},$${p.price.toFixed(2)},$${(p.price * p.quantity).toFixed(2)}`
    )
    .join('\n');
  const csv = csvHeader + csvRows + `\n\nTotal,,,${totalPrice.toFixed(2)}`;

  zip.file('bundle-contents.csv', csv);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return zipBuffer;
}

