import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/lib/error-message';

// Composer "From URL" (Aj, 2026-07-19): "I also want to be able to call on
// URL websites for this as well." Reuses the exact same crude-but-proven
// text extraction Style Lab's add_url action already uses (strip
// script/style/tags, collapse whitespace, cap length) rather than adding a
// new HTML-parsing dependency for a second, slightly different extractor.
// No DB write here -- kept ephemeral like AI-generated content, since the
// person picks a category and includes/excludes it right in the Composer
// session rather than managing it as a persistent Style Lab resource.
//
// POST { url }
export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) || {};
    if (!url || !String(url).trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(String(url).trim());
    } catch {
      return NextResponse.json({ error: 'That doesn\'t look like a valid URL' }, { status: 400 });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 });
    }

    let title = parsed.href;
    let text = '';
    try {
      const res = await fetch(parsed.href, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyleLab/1.0)' } });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20000);
    } catch (e) {
      const message = errorMessage(e);
      return NextResponse.json({ error: `Couldn't fetch that URL: ${message}` }, { status: 422 });
    }
    if (!text) {
      return NextResponse.json({ error: 'No readable text found on that page' }, { status: 422 });
    }

    return NextResponse.json({ ok: true, url: parsed.href, title, text });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
