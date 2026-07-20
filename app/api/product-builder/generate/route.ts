import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getProduct, updateProduct } from '@/lib/products';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

export const maxDuration = 90;

const admin: any = supabaseAdmin;
const PAGE_W = 612, PAGE_H = 792; // US Letter, points
const DEFAULT_PRESET = { marginTop: 54, marginBottom: 54, marginLeft: 54, marginRight: 54, alignment: 'left', lineSpacing: 1.15 };
const NAVY = rgb(0.11, 0.21, 0.34);
const GRAY = rgb(0.55, 0.55, 0.55);
const INK = rgb(0.1, 0.1, 0.1);

// ---- Parts Library lookups ----
async function fetchPart(userId: string, id: string | null) {
  if (!id) return null;
  const { data } = await admin.from('library_parts').select('id, title, file_url, notes').eq('id', id).eq('user_id', userId).single();
  return data || null;
}

async function embedImageFromUrl(doc: any, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  try { return await doc.embedPng(bytes); } catch { return await doc.embedJpg(bytes); }
}

function readPreset(part: any) {
  if (!part?.notes) return DEFAULT_PRESET;
  try { return { ...DEFAULT_PRESET, ...JSON.parse(part.notes) }; } catch { return DEFAULT_PRESET; }
}

// Word-wraps text into lines that fit maxWidth at the given font/size.
function wrapLines(text: string, font: any, size: number, maxWidth: number) {
  const out: string[] = [];
  for (const paragraph of String(text || '').split('\n')) {
    if (!paragraph.trim()) { out.push(''); continue; }
    const words = paragraph.split(' ');
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// x position for one line given the chosen alignment. True full-justify
// (stretching inter-word spacing) isn't implemented -- falls back to left,
// noted in the Product Builder UI.
function alignedX(line: string, font: any, size: number, marginLeft: number, textWidth: number, alignment: string) {
  const w = font.widthOfTextAtSize(line, size);
  if (alignment === 'center') return marginLeft + (textWidth - w) / 2;
  if (alignment === 'right') return marginLeft + (textWidth - w);
  return marginLeft; // left, justify (approximated)
}

// Draws wrapped text starting at (page, y), adding new pages as needed.
// Returns the final { page, y }.
function drawBody(doc: any, page: any, y: number, text: string, font: any, size: number, lineHeight: number, preset: any, color = INK) {
  const marginLeft = preset.marginLeft, marginRight = preset.marginRight, marginBottom = preset.marginBottom;
  const textWidth = PAGE_W - marginLeft - marginRight;
  const lines = wrapLines(text, font, size, textWidth);
  for (const line of lines) {
    if (y < marginBottom) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - preset.marginTop;
    }
    if (line) {
      const x = alignedX(line, font, size, marginLeft, textWidth, preset.alignment);
      page.drawText(line, { x, y, size, font, color });
    }
    y -= lineHeight;
  }
  return { page, y };
}

// POST { userId, productId }
export async function POST(request: NextRequest) {
  try {
    const { userId, productId } = (await request.json()) || {};
    if (!userId || !productId) return NextResponse.json({ error: 'userId and productId are required' }, { status: 400 });

    const product = await getProduct(productId, userId, admin);
    if (!product) return NextResponse.json({ error: 'Product not found -- save the draft first' }, { status: 404 });

    const sel = product.style_selections || {};
    const [borderPart, headerPart, fontPart, spacingPart] = await Promise.all([
      fetchPart(userId, sel.border), fetchPart(userId, sel.section_header),
      fetchPart(userId, sel.font), fetchPart(userId, sel.spacing_alignment),
    ]);
    const iconIds: string[] = Array.isArray(sel.icon_illustration) ? sel.icon_illustration.slice(0, 4) : [];
    const iconParts = (await Promise.all(iconIds.map((id) => fetchPart(userId, id)))).filter(Boolean);

    const preset = readPreset(spacingPart);
    const doc = await PDFDocument.create();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // ---- Cover page: border background + title ----
    let page = doc.addPage([PAGE_W, PAGE_H]);
    if (borderPart?.file_url) {
      try {
        const img = await embedImageFromUrl(doc, borderPart.file_url);
        page.drawImage(img, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
      } catch { /* border optional -- skip silently if it fails to load */ }
    }
    const title = product.title || 'Untitled Product';
    const titleSize = 28;
    const titleLines = wrapLines(title, helvBold, titleSize, PAGE_W - 108);
    let ty = PAGE_H / 2 + (titleLines.length * (titleSize + 6)) / 2;
    for (const line of titleLines) {
      const w = helvBold.widthOfTextAtSize(line, titleSize);
      page.drawText(line, { x: (PAGE_W - w) / 2, y: ty, size: titleSize, font: helvBold, color: NAVY });
      ty -= titleSize + 6;
    }
    // Font is METADATA ONLY -- same principle as Style Lab's font reference
    // save (lib comment in components/VisualComponents.jsx): we never embed
    // or reproduce a licensed font's actual glyph program, only note the
    // referenced name so Aj can license/apply it himself elsewhere.
    if (fontPart?.title) {
      const note = `Styled with reference font: ${fontPart.title} (not embedded -- see Font Editor)`;
      const w = helv.widthOfTextAtSize(note, 9);
      page.drawText(note, { x: (PAGE_W - w) / 2, y: 30, size: 9, font: helv, color: GRAY });
    }

    // ---- Instructions page ----
    page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - preset.marginTop;
    page.drawText('Instructions', { x: preset.marginLeft, y, size: 16, font: helvBold, color: NAVY });
    y -= 16 + 10;
    ({ page, y } = drawBody(doc, page, y, product.instructions_text || '(No instructions written yet.)', helv, 11, 11 * preset.lineSpacing, preset));

    // ---- One page per Learning Content ----
    const contents = Array.isArray(product.learning_contents) ? product.learning_contents : [];
    for (let i = 0; i < contents.length; i++) {
      const item = contents[i];
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - preset.marginTop;

      if (headerPart?.file_url) {
        try {
          const img = await embedImageFromUrl(doc, headerPart.file_url);
          const w = PAGE_W - preset.marginLeft - preset.marginRight;
          const h = (img.height / img.width) * w;
          page.drawImage(img, { x: preset.marginLeft, y: y - h, width: w, height: h });
          y -= h + 12;
        } catch { /* section header optional -- skip silently if it fails to load */ }
      }

      page.drawText(item.label || `Learning Content ${i + 1}`, { x: preset.marginLeft, y, size: 15, font: helvBold, color: NAVY });
      y -= 15 + 10;
      ({ page, y } = drawBody(doc, page, y, item.content || '', helv, 11, 11 * preset.lineSpacing, preset));

      // One icon/illustration per content page, cycling through the picks,
      // placed as a small thumbnail bottom-right -- decorative, not
      // layout-critical, so failures are skipped silently.
      if (iconParts.length) {
        const icon = iconParts[i % iconParts.length];
        if (icon?.file_url) {
          try {
            const img = await embedImageFromUrl(doc, icon.file_url);
            const size = 60;
            const scale = Math.min(size / img.width, size / img.height);
            page.drawImage(img, { x: PAGE_W - preset.marginRight - img.width * scale, y: preset.marginBottom - 10, width: img.width * scale, height: img.height * scale });
          } catch { /* decorative -- skip */ }
        }
      }
    }

    const bytes = await doc.save();

    // Save as this product's file, same as any other generated product.
    const path = `${userId}/product-builder/${productId}-${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from('product-files').upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    const { data: urlData } = admin.storage.from('product-files').getPublicUrl(path);
    await updateProduct(productId, userId, { file_url: urlData.publicUrl }, admin);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title.replace(/\s+/g, '-')}.pdf"`,
        'X-File-Url': encodeURIComponent(urlData.publicUrl),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
