import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureRasterImage } from '@/lib/flux-kontext';
import { sniffImageType } from '@/lib/design-assets-gen';

const admin: any = supabaseAdmin;

// Visual Integrity Auditor (Aj, 2026-07-24): built after a debugging
// session found FOUR real, silent bugs in one sample comic -- Maya's
// "B&W" production image still had real color in it, Owl Professor's
// SVG silently dropped his panel because pdf-lib can't embed SVG, none
// of that session's new character work was actually reachable by the
// generator, and none of it was caught by anything until Aj personally
// looked and asked why. Design doc: docs/visual-integrity-auditor-design.txt.
//
// Phase 1 (this file): Checks A (colorspace mismatch), B (format /
// embeddability, auto-fixed), D (silent partial-failure diagnosis).
// Checks C (reachability manifest), E (lineage tracking), and F
// (duplicate-in-deliverable) are later phases per the design doc.

const BW_MEAN_DIFF_THRESHOLD = 3; // calibrated from real numbers: Maya's
// contaminated image measured 6.36, clean B&W images measured 0.4-0.8.

// CHECK A: colorspace mismatch. Downloads the image, decodes raw pixels,
// and measures how far R/G/B channels deviate from each other. True
// black-and-white line art has near-zero deviation; real color content
// (even muted) measures clearly higher. This is the exact diagnostic
// run by hand on Maya's image on 2026-07-24, now automated.
export async function checkColorspace(imageBuffer: Buffer): Promise<{ meanDiff: number; isBW: boolean }> {
  const { data, info } = await sharp(imageBuffer).ensureAlpha(0).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  if (channels < 3) return { meanDiff: 0, isBW: true }; // already single-channel/grayscale at the format level

  let totalDiff = 0;
  let pixelCount = 0;
  // Sample every 4th pixel for speed on large images -- plenty of signal,
  // far less work than every single pixel.
  const stride = channels * 4;
  for (let i = 0; i + 2 < data.length; i += stride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalDiff += Math.abs(r - g) + Math.abs(g - b);
    pixelCount++;
  }
  const meanDiff = pixelCount > 0 ? totalDiff / pixelCount : 0;
  return { meanDiff, isBW: meanDiff < BW_MEAN_DIFF_THRESHOLD };
}

// CHECK B: format / embeddability. Some cast library images are stored
// as .svg (Recraft vector output from an earlier pass), but pdf-lib can
// only embed actual raster pixel data -- this silently dropped Owl
// Professor's panel on 2026-07-24. Detects the real file type from
// bytes (not the URL extension) and, if it's SVG, rasterizes it via the
// existing ensureRasterImage helper and returns the new URL so the
// caller can update the library_parts row in place.
export async function checkAndFixFormat(
  imageUrl: string,
  imageBuffer: Buffer
): Promise<{ wasSvg: boolean; fixedUrl: string | null }> {
  const { contentType } = sniffImageType(imageBuffer);
  if (contentType !== 'image/svg+xml') return { wasSvg: false, fixedUrl: null };
  const fixedUrl = await ensureRasterImage(imageUrl);
  return { wasSvg: true, fixedUrl };
}

async function recordFinding(opts: {
  userId: string;
  libraryPartId: string;
  checkType: string;
  severity: 'flag' | 'auto_fixed';
  details: Record<string, any>;
}) {
  const { error } = await admin.from('visual_audit_findings').insert({
    user_id: opts.userId,
    library_part_id: opts.libraryPartId,
    check_type: opts.checkType,
    severity: opts.severity,
    details: opts.details,
  });
  if (error) throw new Error(`Failed to record audit finding: ${error.message}`);
}

// Audits ONE library_parts row: runs Check B first (format), since a
// fixed raster image needs to be re-checked for Check A (colorspace) --
// auditing the pre-fix SVG for color content isn't meaningful the same
// way. Auto-applies the Check B fix; only flags Check A.
export async function auditLibraryPart(row: { id: string; user_id: string; file_url: string; title?: string }) {
  const findings: any[] = [];
  const res = await fetch(row.file_url);
  if (!res.ok) {
    findings.push({ check: 'fetch', ok: false, error: `Could not fetch (${res.status})` });
    return { partId: row.id, findings, fixedUrl: null };
  }
  let buffer = Buffer.from(await res.arrayBuffer());
  let currentUrl = row.file_url;

  // Check B first -- fix format before checking color, since an SVG
  // can't be meaningfully raster-analyzed for colorspace anyway.
  const formatResult = await checkAndFixFormat(currentUrl, buffer);
  if (formatResult.wasSvg && formatResult.fixedUrl) {
    await admin.from('library_parts').update({ file_url: formatResult.fixedUrl }).eq('id', row.id);
    await recordFinding({
      userId: row.user_id,
      libraryPartId: row.id,
      checkType: 'format',
      severity: 'auto_fixed',
      details: { title: row.title, oldUrl: currentUrl, newUrl: formatResult.fixedUrl, reason: 'SVG cannot be embedded by pdf-lib; rasterized automatically.' },
    });
    currentUrl = formatResult.fixedUrl;
    const rerastered = await fetch(currentUrl);
    buffer = Buffer.from(await rerastered.arrayBuffer());
    findings.push({ check: 'format', ok: false, autoFixed: true });
  } else {
    findings.push({ check: 'format', ok: true });
  }

  // Check A -- colorspace, on whatever the current (possibly just-fixed) raster is.
  try {
    const colorResult = await checkColorspace(buffer);
    if (!colorResult.isBW) {
      await recordFinding({
        userId: row.user_id,
        libraryPartId: row.id,
        checkType: 'colorspace',
        severity: 'flag',
        details: { title: row.title, meanDiff: colorResult.meanDiff, threshold: BW_MEAN_DIFF_THRESHOLD, reason: 'Image has real color content but lives in a black-and-white-only category.' },
      });
      findings.push({ check: 'colorspace', ok: false, meanDiff: colorResult.meanDiff });
    } else {
      findings.push({ check: 'colorspace', ok: true, meanDiff: colorResult.meanDiff });
    }
  } catch (e: any) {
    findings.push({ check: 'colorspace', ok: false, error: e?.message || String(e) });
  }

  return { partId: row.id, findings, fixedUrl: formatResult.wasSvg ? currentUrl : null };
}

// Sweeps every row in a given library_parts category for the current
// user, running Checks A + B on each. Used both for the on-demand sweep
// endpoint and the (future) scheduled cron pass.
export async function auditCategory(userId: string, category: string) {
  const { data: rows, error } = await admin
    .from('library_parts')
    .select('id, user_id, file_url, title')
    .eq('user_id', userId)
    .eq('category', category)
    .eq('kind', 'image');
  if (error) throw new Error(`library_parts query failed: ${error.message}`);

  const results = await Promise.allSettled((rows || []).map((row: any) => auditLibraryPart(row)));
  const audited = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { partId: rows![i].id, findings: [{ check: 'audit', ok: false, error: r.reason?.message || String(r.reason) }], fixedUrl: null };
  });

  const formatFixed = audited.filter((a) => a.findings.some((f: any) => f.check === 'format' && f.autoFixed)).length;
  const colorFlagged = audited.filter((a) => a.findings.some((f: any) => f.check === 'colorspace' && f.ok === false)).length;

  return { category, totalChecked: audited.length, formatFixed, colorFlagged, details: audited };
}

// CHECK D: silent partial-failure diagnosis. Given a character image URL
// that failed to embed during real comic generation, re-runs the exact
// same fetch+format logic that generation used, to say WHY it failed
// instead of just counting it. Called from the comic-generator route
// whenever a panel comes back with zero images.
export async function diagnosePanelFailure(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return `Source image fetch failed (HTTP ${res.status}).`;
    const buffer = Buffer.from(await res.arrayBuffer());
    const { contentType } = sniffImageType(buffer);
    if (contentType === 'image/svg+xml') {
      return 'Source image is SVG, which cannot be embedded directly -- this should now auto-rasterize (fixed 2026-07-24); if you see this, the fix did not apply.';
    }
    return `Unknown embed failure -- image fetched fine (${contentType}) but embedding still failed.`;
  } catch (e: any) {
    return `Diagnosis fetch itself failed: ${e?.message || String(e)}`;
  }
}
