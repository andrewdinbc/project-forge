import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { errorMessage } from '@/lib/error-message';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Find free, commercial-use-safe alternatives to a font detected in a Style
// Lab resource (Aj, 2026-07-19: "I want a button that will find similar and
// it will search for similar free fonts"). Uses Claude's web_search tool to
// research the ORIGINAL font's actual look (rather than guessing from the
// name alone) and suggest close, genuinely-free-for-commercial-use
// alternatives -- prioritizing Google Fonts, since those carry an OFL
// license that needs no separate purchase for any use, commercial included.
//
// Deliberately does NOT try to find a "buy this font" URL via AI search --
// too easy to hallucinate or link to the wrong vendor. The buy link is a
// plain constructed search URL, built client-side, no API call needed.
//
// POST { fontName }
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  try {
    const { fontName } = (await request.json()) || {};
    if (!fontName || !String(fontName).trim()) {
      return NextResponse.json({ error: 'fontName is required' }, { status: 400 });
    }
    const name = String(fontName).trim();

    const prompt = `A teacher-made worksheet uses a font called "${name}" (likely a small independent/boutique font, common in the TPT teacher-resource community — think playful, handwriting-style, or bold display fonts made for classroom materials). Use web search to find out what this specific font actually looks like and who makes it, if you can.

Then suggest 3 free, commercial-use-friendly alternative fonts that are visually close to it — strongly prefer fonts hosted on Google Fonts, since those are free for any use (including commercial) with no separate license needed.

Respond with ONLY this JSON, no other text before or after it:
{"originalStyle": "one sentence, in your own words, describing what the original font looks like and its general vibe", "alternatives": [{"name": "exact Google Fonts name", "reason": "one short sentence on why it's a good match"}]}`;

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlocks = resp.content.filter((b: any) => b.type === 'text') as any[];
    const raw = (textBlocks[textBlocks.length - 1]?.text || '').replace(/```json|```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Vision/search sometimes wraps JSON in a sentence despite instructions; try to salvage it.
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { originalStyle: '', alternatives: [] };
    }

    const alternatives = (parsed.alternatives || [])
      .slice(0, 3)
      .map((a: any) => ({
        name: String(a.name || '').trim(),
        reason: String(a.reason || '').trim(),
        previewUrl: `https://fonts.google.com/specimen/${encodeURIComponent(String(a.name || '').trim().replace(/\s+/g, '+'))}`,
      }))
      .filter((a: any) => a.name);

    return NextResponse.json({
      ok: true,
      fontName: name,
      originalStyle: String(parsed.originalStyle || ''),
      alternatives,
      buyUrl: `https://www.google.com/search?q=${encodeURIComponent(`"${name}" font commercial license buy`)}`,
    });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
