import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { errorMessage } from '@/lib/error-message';

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Style Match Finder (Aj, 2026-07-20): "the separator isolate those parts,
// then search [free/open-license sites] for near equivalent ones... anything
// free and open source, both from my list and others."
//
// Deliberately narrow to sources that are genuinely open-license or public
// domain -- not just "free to use with attribution." Freepik, Vecteezy,
// DaFont, Noun Project etc. are real options but need per-item license
// checking or owed attribution, which doesn't fit "open source." Those stay
// out of automated search; add them as manual search links if wanted later.
//
//   font              -> Google Fonts (every font is OFL/Apache -- no key
//                         needed, using the public metadata endpoint the
//                         fonts.google.com site itself uses)
//   border /
//   section_header /
//   icon_illustration -> OpenClipart (100% public domain / CC0) +
//                         Openverse (aggregates CC0 + openly-licensed work
//                         across many collections) -- merged, each result
//                         tagged with its real license, CC0/PDM surfaced
//                         first since those need no attribution at all.

type Candidate = {
  title: string;
  previewUrl: string;
  sourceUrl: string;
  source: string;
  license: string;
  licenseUrl: string | null;
  requiresAttribution: boolean;
  attributionText: string | null;
};

async function searchGoogleFonts(query: string): Promise<Candidate[]> {
  const res = await fetch('https://fonts.google.com/metadata/fonts');
  if (!res.ok) throw new Error(`Google Fonts metadata fetch failed (${res.status})`);
  // Response is prefixed with ")]}'" (XSSI protection) before the JSON body.
  const raw = await res.text();
  const jsonText = raw.replace(/^\)\]\}'/, '').trim();
  const data = JSON.parse(jsonText);
  const families: any[] = data.familyMetadataList || [];

  // Cheap pre-filter on category/name keyword match before spending an AI
  // call, so we're not shipping the entire ~1700-family catalog to Claude.
  const q = query.toLowerCase();
  const styleWords = ['serif', 'sans', 'display', 'handwriting', 'script', 'monospace', 'rounded', 'bold', 'playful', 'whimsical', 'decorative', 'hand-drawn', 'casual', 'formal', 'elegant'];
  const matchedStyleWords = styleWords.filter((w) => q.includes(w));
  const categoryGuess = families.length
    ? (matchedStyleWords.find((w) => ['serif', 'sans', 'display', 'handwriting', 'monospace'].includes(w)) ||
       (matchedStyleWords.includes('script') || matchedStyleWords.includes('hand-drawn') || matchedStyleWords.includes('casual') ? 'handwriting' : null))
    : null;

  let pool = families;
  if (categoryGuess) {
    pool = families.filter((f) => (f.category || '').toLowerCase().includes(categoryGuess));
  }
  pool = pool.slice(0, 120); // keep the AI-ranking prompt reasonably sized

  const listForPrompt = pool.map((f) => `${f.family} (${f.category})`).join('\n');
  const prompt = `A teacher wants a free, open-source font similar to this style description, sourced from Google Fonts (every entry below is OFL/Apache licensed):

"${query}"

Candidate fonts (name (category)):
${listForPrompt}

Pick the 6 best matches. Return ONLY JSON, no markdown fences: {"picks": ["Family Name", ...]}`;

  const aiRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-5', max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = (aiRes.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
  let picks: string[] = [];
  try { picks = JSON.parse(text.replace(/```json|```/g, '').trim()).picks || []; } catch { picks = []; }

  const chosen = picks.length ? families.filter((f) => picks.includes(f.family)) : pool.slice(0, 6);
  return chosen.map((f) => ({
    title: f.family,
    previewUrl: `https://fonts.google.com/specimen/${encodeURIComponent(f.family.replace(/ /g, '+'))}`,
    sourceUrl: `https://fonts.google.com/specimen/${encodeURIComponent(f.family.replace(/ /g, '+'))}`,
    source: 'Google Fonts',
    license: 'OFL / Apache 2.0 (open source)',
    licenseUrl: 'https://fonts.google.com/attribution',
    requiresAttribution: false,
    attributionText: null,
  }));
}

async function searchOpenClipart(query: string): Promise<Candidate[]> {
  const res = await fetch(`https://openclipart.org/search/json/?query=${encodeURIComponent(query)}&amount=10`);
  if (!res.ok) throw new Error(`OpenClipart search failed (${res.status})`);
  const data = await res.json();
  const items = Object.values(data.payload || {}) as any[];
  return items.slice(0, 10).map((it: any) => ({
    title: it.title || 'Untitled',
    previewUrl: it.svg?.png_thumb || it.svg?.png_full || '',
    sourceUrl: it.svg?.url || it.detail_link || `https://openclipart.org/detail/${it.id}`,
    source: 'OpenClipart',
    license: 'Public Domain (CC0)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    requiresAttribution: false,
    attributionText: null,
  }));
}

async function searchOpenverse(query: string): Promise<Candidate[]> {
  const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12`);
  if (!res.ok) throw new Error(`Openverse search failed (${res.status})`);
  const data = await res.json();
  const items = (data.results || []) as any[];
  return items.map((it: any) => {
    const lic = (it.license || '').toLowerCase();
    const isCC0 = lic === 'cc0' || lic === 'pdm';
    return {
      title: it.title || 'Untitled',
      previewUrl: it.thumbnail || it.url,
      sourceUrl: it.foreign_landing_url || it.url,
      source: `Openverse (via ${it.source || 'unknown'})`,
      license: isCC0 ? 'Public Domain / CC0' : `CC ${(it.license || '').toUpperCase()} ${it.license_version || ''}`.trim(),
      licenseUrl: it.license_url || null,
      requiresAttribution: !isCC0,
      attributionText: !isCC0 ? `${it.title || 'Image'} by ${it.creator || 'unknown creator'}, ${(it.license || '').toUpperCase()} via ${it.source || 'Openverse'}` : null,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const { category, query } = await request.json();
    if (!category || !query) {
      return NextResponse.json({ error: 'category and query are required' }, { status: 400 });
    }

    if (category === 'font' || category === 'font_reference') {
      const results = await searchGoogleFonts(query);
      return NextResponse.json({ ok: true, results, sourcesQueried: ['Google Fonts'] });
    }

    // border, section_header, icon_illustration all search the same two
    // open-license image sources -- merged, CC0/public-domain results
    // sorted first since those need zero attribution tracking.
    const errors: string[] = [];
    const [openclipart, openverse] = await Promise.all([
      searchOpenClipart(query).catch((e) => { errors.push(`OpenClipart: ${errorMessage(e)}`); return []; }),
      searchOpenverse(query).catch((e) => { errors.push(`Openverse: ${errorMessage(e)}`); return []; }),
    ]);
    const merged = [...openclipart, ...openverse].sort((a, b) => Number(a.requiresAttribution) - Number(b.requiresAttribution));
    return NextResponse.json({ ok: true, results: merged, sourcesQueried: ['OpenClipart', 'Openverse'], errors: errors.length ? errors : undefined });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
