// lib/pdf-image-extract.js
// Pulls embedded raster images out of a PDF as standalone files, reading
// each page's XObject resources directly via pdf-lib's low-level object
// model. Aj, 2026-07-19: step 1 of "disassemble a PDF to reuse the parts
// I like" -- this handles genuinely discrete objects (real embedded
// images), which is the reliable, non-lossy case. Cropping arbitrary
// regions (diagrams, single questions, vector art) is a separate,
// harder feature (step 2) since PDFs don't have a clean object boundary
// around hand-drawn/vector content the way they do around images.
//
// Coverage, honestly scoped:
// - DCTDecode (JPEG) and JPXDecode (JPEG2000) images: extracted directly --
//   the raw stream bytes ARE already a valid image file, no decoding needed.
//   This covers the large majority of photos/clipart in real-world PDFs.
// - FlateDecode raw bitmaps: supported ONLY for 8-bit DeviceRGB or
//   DeviceGray, since those are unambiguous to decode correctly. Encoded
//   to PNG via pngjs after zlib inflation.
// - Everything else (Indexed/CMYK color spaces, non-8-bit depth, CCITT fax,
//   unsupported filter combos) is reported as skipped with a reason,
//   rather than guessed at and risk producing a corrupted/wrong-looking
//   image.
// - Images smaller than 40x40px are skipped by default (bullets, dividers,
//   decorative icons) -- not real reusable content.

import { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFArray, PDFNumber } from 'pdf-lib';
import zlib from 'zlib';
import { PNG } from 'pngjs';

function filterNames(filterObj) {
  if (!filterObj) return [];
  if (filterObj instanceof PDFArray) {
    return filterObj.asArray().map((f) => f.toString().replace(/^\//, ''));
  }
  return [filterObj.toString().replace(/^\//, '')];
}

function colorSpaceName(csObj) {
  if (!csObj) return null;
  const s = csObj.toString();
  if (s === '/DeviceRGB') return 'DeviceRGB';
  if (s === '/DeviceGray') return 'DeviceGray';
  if (s === '/DeviceCMYK') return 'DeviceCMYK';
  return null; // Indexed, ICCBased, CalRGB, etc. -- not handled
}

export async function extractImagesFromPdf(pdfBytes, { minWidth = 40, minHeight = 40 } = {}) {
  const images = [];
  const skipped = [];

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageNumber = pageIndex + 1;
    let resources;
    try {
      resources = pages[pageIndex].node.Resources();
    } catch {
      continue;
    }
    if (!resources) continue;

    let xObjectDict;
    try {
      xObjectDict = resources.lookup(PDFName.of('XObject'), PDFDict);
    } catch {
      continue;
    }
    if (!xObjectDict) continue;

    let imgIndexOnPage = 0;
    for (const key of xObjectDict.keys()) {
      try {
        const ref = xObjectDict.get(key);
        const xObject = pdfDoc.context.lookup(ref);
        if (!(xObject instanceof PDFRawStream)) continue;

        const dict = xObject.dict;
        const subtype = dict.lookup(PDFName.of('Subtype'));
        if (!subtype || subtype.toString() !== '/Image') continue;

        const widthObj = dict.lookup(PDFName.of('Width'));
        const heightObj = dict.lookup(PDFName.of('Height'));
        const width = widthObj instanceof PDFNumber ? widthObj.asNumber() : null;
        const height = heightObj instanceof PDFNumber ? heightObj.asNumber() : null;
        const label = `page ${pageNumber}, image ${imgIndexOnPage + 1}`;

        if (!width || !height) {
          skipped.push({ label, reason: 'missing width/height' });
          continue;
        }
        if (width < minWidth || height < minHeight) {
          skipped.push({ label, reason: `too small (${width}x${height}) -- likely a bullet/icon, not extracted` });
          continue;
        }

        const filters = filterNames(dict.lookup(PDFName.of('Filter')));
        const rawBytes = Buffer.from(xObject.contents);

        if (filters.includes('DCTDecode')) {
          images.push({ pageNumber, index: imgIndexOnPage, buffer: rawBytes, ext: 'jpg', width, height });
          imgIndexOnPage++;
          continue;
        }
        if (filters.includes('JPXDecode')) {
          images.push({ pageNumber, index: imgIndexOnPage, buffer: rawBytes, ext: 'jp2', width, height });
          imgIndexOnPage++;
          continue;
        }
        if (filters.length === 0 || filters.every((f) => f === 'FlateDecode')) {
          const bpc = dict.lookup(PDFName.of('BitsPerComponent'));
          const bitsPerComponent = bpc instanceof PDFNumber ? bpc.asNumber() : null;
          const cs = colorSpaceName(dict.lookup(PDFName.of('ColorSpace')));

          if (bitsPerComponent !== 8 || !cs || cs === 'DeviceCMYK') {
            skipped.push({ label, reason: `unsupported color format (${cs || 'unknown color space'}, ${bitsPerComponent || '?'}-bit) -- not decoded` });
            continue;
          }

          let raw;
          try {
            raw = filters.length === 0 ? rawBytes : zlib.inflateSync(rawBytes);
          } catch (e) {
            skipped.push({ label, reason: `failed to decompress: ${e.message}` });
            continue;
          }

          const components = cs === 'DeviceRGB' ? 3 : 1;
          if (raw.length !== width * height * components) {
            skipped.push({ label, reason: 'decoded pixel data size mismatch -- likely has an unhandled soft mask or extra data' });
            continue;
          }

          const png = new PNG({ width, height });
          for (let i = 0; i < width * height; i++) {
            if (components === 3) {
              png.data[i * 4] = raw[i * 3];
              png.data[i * 4 + 1] = raw[i * 3 + 1];
              png.data[i * 4 + 2] = raw[i * 3 + 2];
            } else {
              const v = raw[i];
              png.data[i * 4] = v;
              png.data[i * 4 + 1] = v;
              png.data[i * 4 + 2] = v;
            }
            png.data[i * 4 + 3] = 255; // opaque -- soft masks (transparency) aren't reconstructed in this pass
          }
          const pngBuffer = PNG.sync.write(png);
          images.push({ pageNumber, index: imgIndexOnPage, buffer: pngBuffer, ext: 'png', width, height });
          imgIndexOnPage++;
          continue;
        }

        skipped.push({ label, reason: `unsupported filter: ${filters.join(', ') || 'none'}` });
      } catch (e) {
        skipped.push({ label: `page ${pageNumber}`, reason: `extraction error: ${e.message}` });
      }
    }
  }

  return { images, skipped };
}
