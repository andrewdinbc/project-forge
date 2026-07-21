import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateImageBuffer, STYLE_SUFFIXES, LINE_ART_STYLE_SUFFIX } from '@/lib/design-assets-gen';

// supabaseAdmin is a lazily-initialized Proxy from a plain .js file (see
// lib/supabase.js), so TypeScript sees it as `{}` with no properties --
// this compiled fine in every other .js route that uses it, but breaks
// strict TS compilation here since this route is .ts. Cast to any at the
// call site rather than changing the shared client's type broadly.
const admin: any = supabaseAdmin;

// Generates a design asset (line art / illustration) from a text prompt
// using either Gemini or Recraft, then stores it in the design-assets
// bucket and returns a public URL. Built specifically to compare the two
// for coloring-page-style line art, per Aj 2026-07-19 -- Composer's
// gap-fill feature can write the TEXT content of something like a color
// by number, but can't draw the actual illustration; this is the missing
// piece. Requires GEMINI_API_KEY and/or RECRAFT_API_KEY to be set in this
// project's Vercel environment variables -- neither key is provided by
// this code, each requires Aj's own account/billing with that provider.
//
// 2026-07-21: the actual Gemini/Recraft call+poll logic now lives in
// lib/design-assets-gen.ts (generateImageBuffer) so the new Comic
// Generator can call it directly as a function -- this route is now a
// thin wrapper: apply the style suffix, generate, upload, return URL.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, prompt, provider, referenceImage, style } = body as {
      userId: string;
      prompt: string;
      provider: 'gemini' | 'recraft';
      referenceImage?: string; // data URL (data:image/png;base64,...)
      style?: 'line_art' | 'flat_color_icon';
    };

    if (!userId || !prompt?.trim() || !provider) {
      return NextResponse.json({ error: 'userId, prompt, and provider are required' }, { status: 400 });
    }
    if (provider !== 'gemini' && provider !== 'recraft') {
      return NextResponse.json({ error: 'provider must be "gemini" or "recraft"' }, { status: 400 });
    }
    const styleSuffix = STYLE_SUFFIXES[style || 'line_art'] || LINE_ART_STYLE_SUFFIX;
    const fullPrompt = `${prompt}${styleSuffix}`;

    const { buffer, contentType, ext } = await generateImageBuffer({ prompt: fullPrompt, provider, referenceImage });

    const path = `${userId}/${Date.now()}-${provider}.${ext}`;
    const { error: uploadError } = await admin.storage.from('design-assets').upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl, provider });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Provider quota / rate-limit conditions reflect the caller's own account
    // state, not a server fault — return 429 so they aren't miscounted as 500s
    // in error dashboards / by the auditor. The client already shows a friendly
    // "check your plan/billing" explanation for these.
    const isQuota = /\b429\b/.test(message) || /quota|rate[\s-]?limit/i.test(message);
    return NextResponse.json({ error: message }, { status: isQuota ? 429 : 500 });
  }
}
