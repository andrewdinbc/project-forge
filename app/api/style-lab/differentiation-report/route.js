import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { getStyleProfile, updateStyleProfile } from '@/lib/style-lab';
import { STYLE_DIALS } from '@/lib/style-dials';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { userId, id } = await request.json();
    if (!userId || !id) return NextResponse.json({ error: 'userId and id are required' }, { status: 400 });

    const profile = await getStyleProfile(userId, id);
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let resources = [];
    if (profile.source_resource_ids?.length) {
      const { data } = await supabase
        .from('forge_resources')
        .select('title, layer_preferences, layer_notes')
        .eq('user_id', userId)
        .in('id', profile.source_resource_ids);
      resources = data || [];
    }

    const dialDeltas = STYLE_DIALS.map((dial) => {
      const source = profile.source_dial_estimates?.[dial.key] ?? dial.default;
      const final = profile.dial_values?.[dial.key] ?? dial.default;
      return { key: dial.key, label: dial.label, source, final, delta: final - source };
    });

    const likedItems = [];
    const dislikedItems = [];
    for (const r of resources) {
      for (const [layerKey, pref] of Object.entries(r.layer_preferences || {})) {
        const target = pref === 'like' ? likedItems : pref === 'dislike' ? dislikedItems : null;
        if (target) target.push(`${r.title} — ${layerKey}`);
      }
    }

    const deltaLines = dialDeltas
      .filter((d) => Math.abs(d.delta) >= 5)
      .map((d) => `- ${d.label}: source-average ${d.source}/100 -> this blend ${d.final}/100 (${d.delta > 0 ? '+' : ''}${d.delta} point deliberate shift)`);

    const prompt = `Write a short, factual documentation paragraph (not legal advice, just a factual record) describing how this style blend was deliberately differentiated from its source style patterns. Be specific and reference the actual numbers.

Blend name: ${profile.name}
Blend description: ${profile.blended_style_text}

Dial deltas (only meaningful shifts of 5+ points):
${deltaLines.length ? deltaLines.join('\n') : 'No individual dial shows a meaningful shift from the source average.'}

Emphasized: ${likedItems.length ? likedItems.join('; ') : 'none specifically flagged'}
Avoided: ${dislikedItems.length ? dislikedItems.join('; ') : 'none specifically flagged'}

Write 2-3 sentences. State plainly that no content/text from source resources was used -- only abstract style/format patterns.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const summary = response.content.find((b) => b.type === 'text')?.text || '';

    const report = `DIFFERENTIATION REPORT
Style Blend: ${profile.name}
Generated: ${new Date().toISOString()}

SUMMARY
${summary}

DIAL-BY-DIAL RECORD (source average -> final value)
${dialDeltas.map((d) => `${d.label}: ${d.source}/100 -> ${d.final}/100 (${d.delta > 0 ? '+' : ''}${d.delta})`).join('\n')}

LAYER PREFERENCES APPLIED
Emphasized: ${likedItems.length ? likedItems.join('; ') : 'none'}
Avoided: ${dislikedItems.length ? dislikedItems.join('; ') : 'none'}

SOURCE MATERIAL NOTE
This blend was built from abstract style/format pattern extractions only -- no source resource's actual content, text, questions, or exercises were used at any point. This document is a factual record for the creator's own files, not a legal opinion.
`;

    await updateStyleProfile(userId, id, { differentiation_report: report });

    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
