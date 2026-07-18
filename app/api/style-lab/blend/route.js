import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { listStyleProfiles, createStyleProfile, updateStyleProfile } from '@/lib/style-lab';
import { averageDialEstimates, defaultDialValues } from '@/lib/style-dials';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  try {
    const profiles = await listStyleProfiles(userId);
    return NextResponse.json({ profiles });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, action } = body;
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    if (action === 'update_dials') {
      const { id, dialValues } = body;
      const profile = await updateStyleProfile(userId, id, { dial_values: dialValues });
      return NextResponse.json({ ok: true, profile });
    }

    const { name, resourceIds, personalTwist } = body;
    if (!name || !resourceIds?.length) return NextResponse.json({ error: 'name and resourceIds are required' }, { status: 400 });

    const { data: resources, error } = await supabase
      .from('forge_resources')
      .select('title, style_notes, dial_estimates, layer_notes, layer_preferences')
      .eq('user_id', userId)
      .in('id', resourceIds);
    if (error) throw error;

    const withNotes = (resources || []).filter((r) => r.style_notes);
    if (!withNotes.length) return NextResponse.json({ error: 'None of the selected resources have extracted style patterns yet -- extract a style pattern from each one first.' }, { status: 400 });

    const dialValues = averageDialEstimates(resources.map((r) => r.dial_estimates).filter(Boolean));

    const likedLines = [];
    const dislikedLines = [];
    for (const r of withNotes) {
      const prefs = r.layer_preferences || {};
      for (const [layerKey, pref] of Object.entries(prefs)) {
        const items = (r.layer_notes?.[layerKey] || []).filter((i) => i.included);
        if (!items.length) continue;
        const text = items.map((i) => i.text).join(', ');
        if (pref === 'like') likedLines.push(`From "${r.title}" (${layerKey}): ${text}`);
        if (pref === 'dislike') dislikedLines.push(`From "${r.title}" (${layerKey}): ${text}`);
      }
    }

    const prompt = `You are blending multiple abstract STYLE patterns (structure, tone, pacing, format -- never content) into one coherent, named "genre feel" for a teacher's original resources.

Style patterns to blend:
${withNotes.map((r, i) => `${i + 1}. From "${r.title}": ${r.style_notes}`).join('\n')}

${likedLines.length ? `EMPHASIZE these specifically-liked elements:\n${likedLines.join('\n')}` : ''}
${dislikedLines.length ? `DELIBERATELY AVOID these specifically-disliked elements:\n${dislikedLines.join('\n')}` : ''}
${personalTwist ? `The teacher's own personal twist to layer in: ${personalTwist}` : ''}

Write ONE blended style description that combines these patterns into a coherent feel. This describes HOW future original content should be written/structured/paced/formatted, not WHAT it should say. 3-5 sentences.

Respond with ONLY JSON, no markdown fences:
{"blendedStyle": "the blended style description"}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b) => b.type === 'text')?.text || '{}';
    const { blendedStyle } = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const profile = await createStyleProfile(userId, {
      name, blended_style_text: blendedStyle, source_resource_ids: resourceIds,
      dial_values: dialValues || defaultDialValues(),
      source_dial_estimates: dialValues,
    });

    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
