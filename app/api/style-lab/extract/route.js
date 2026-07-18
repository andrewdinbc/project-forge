import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getResource, updateResource, flattenIncludedLayerText } from '@/lib/style-lab';
import { STYLE_DIALS } from '@/lib/style-dials';

// Extracts ONLY abstract structural/stylistic observations from a resource,
// broken into named layers and then into small independent atomic
// observations -- never content, facts, specific text, or exercises. See
// the equivalent lesson-planner route this was ported from for the full
// rationale on why Content/Branding/Credits layers are excluded.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LAYER_KEYS = ['visuals', 'structure', 'interaction', 'assessmentFormat', 'teacherDirections', 'studentDirections', 'extension', 'digital'];

export async function POST(request) {
  try {
    const { userId, id } = await request.json();
    if (!userId || !id) return NextResponse.json({ error: 'userId and id are required' }, { status: 400 });

    const row = await getResource(userId, id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const text = (row.edited_text || row.original_text || '').slice(0, 8000);
    const dialList = STYLE_DIALS.map((d) => `- ${d.key}: 0 = "${d.loLabel}", 100 = "${d.hiLabel}"`).join('\n');

    const prompt = `You are analyzing a teaching resource to extract its STYLE and FORMAT only, broken into layers and then into small independent observations -- never its actual content.

Resource: ${row.title}
Text:
${text}

For each layer below, list 1-4 SEPARATE, SHORT, ATOMIC observations (each just a few words to one short phrase) -- never specific facts, questions, passages, examples, answer key content, or exact text from the source. Each observation should stand alone. If a layer isn't present/inferable, use an empty array.

- visuals: layout/formatting conventions (e.g. "color-coded sections") -- describe the STYLE, never reproduce or describe specific clipart/images, those are separately licensed assets
- structure: how it's organized/sequenced
- interaction: the TYPE of student engagement as a generic format
- assessmentFormat: the FORMAT of how understanding is checked -- not actual key/rubric content
- teacherDirections: format of setup/prep notes if present
- studentDirections: format of how instructions are presented to students
- extension: format of any early-finisher/enrichment provision
- digital: which digital format(s) exist as plain facts

Additionally, estimate a 0-100 value for each of these style dials, based purely on structural/tonal impressions (not content):
${dialList}
If you can't confidently estimate a dial, use 50 (neutral).

Respond with ONLY JSON, no markdown fences:
{"visuals": ["...", "..."], "structure": ["..."], "interaction": ["..."], "assessmentFormat": ["..."], "teacherDirections": ["..."], "studentDirections": ["..."], "extension": ["..."], "digital": ["..."], "dials": {${STYLE_DIALS.map((d) => `"${d.key}": 0`).join(', ')}}}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const { dials, ...rawLayers } = parsed;

    const previousLayers = row.layer_notes || {};
    const layers = {};
    for (const key of LAYER_KEYS) {
      const items = Array.isArray(rawLayers[key]) ? rawLayers[key] : (rawLayers[key] ? [rawLayers[key]] : []);
      const previousItems = Array.isArray(previousLayers[key]) ? previousLayers[key] : [];
      layers[key] = items.map((itemText, i) => {
        const matchPrev = previousItems.find((p) => p.text === itemText);
        return { id: matchPrev?.id || `${key}-${i}-${Date.now()}`, text: itemText, included: matchPrev ? matchPrev.included : true };
      });
    }

    const flatSummary = flattenIncludedLayerText(layers);
    await updateResource(userId, id, { layer_notes: layers, style_notes: flatSummary, dial_estimates: dials || null });

    return NextResponse.json({ layers, styleNotes: flatSummary, dials });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
