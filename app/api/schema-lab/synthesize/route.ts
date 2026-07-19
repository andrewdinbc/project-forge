import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { createSchema } from '@/lib/schema-lab';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Schema Lab step 2 (Aj, 2026-07-19): "I have millions of ways I want to be
// able to use that... One of many I have from different companies." Takes
// several resources' already-run structural analyses (see analyze-structure)
// and cross-synthesizes them into ONE named Schema -- the point of using
// MULTIPLE examples (ideally from different sellers) is to find what's
// actually DEFINING about the genre versus what's just one company's
// specific take on it.
//
// POST { userId, name, resourceIds }
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  try {
    const { userId, name, resourceIds } = (await request.json()) || {};
    if (!userId || !name || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return NextResponse.json({ error: 'userId, name, and at least one resourceId are required' }, { status: 400 });
    }

    const { data: resources, error } = await admin
      .from('forge_resources')
      .select('id, title, activity_structure_notes')
      .eq('user_id', userId)
      .in('id', resourceIds);
    if (error) throw error;

    const withNotes = (resources || []).filter((r: any) => r.activity_structure_notes);
    if (withNotes.length === 0) {
      return NextResponse.json(
        { error: "None of the selected resources have a structural analysis yet -- run 'Analyze Structure' on each one first." },
        { status: 400 }
      );
    }

    const prompt = `You are defining a reusable ACTIVITY-TYPE SCHEMA by finding what's common across ${withNotes.length} example resource(s) that are all meant to be the SAME genre of activity (e.g. all "interactive notebook" resources, or all "color-by-number" resources) -- even though they're from different sources and cover different subjects.

${withNotes.map((r: any, i: number) => {
  const n = r.activity_structure_notes;
  return `Example ${i + 1}: "${r.title}"
  Physical format: ${n.physicalFormat}
  Structural components: ${(n.structuralComponents || []).join(', ')}
  Sequence: ${n.sequencePattern}
  Constraints: ${n.notableConstraints}`;
}).join('\n\n')}

Write ONE schema that captures what defines this activity type as a genre -- generalize across the examples (if they disagree on a detail, describe the common core and note the variation briefly rather than picking one example's specific choice). This must describe FORMAT/STRUCTURE only, reusable for ANY future subject matter -- never mention the actual subject content (human body, etc.) of these specific examples.

Respond with ONLY valid JSON, no prose, no markdown:
{
  "structuralSummary": "2-4 sentences defining this activity type as a genre, written so it could be handed to someone building a brand-new example on a completely different subject",
  "components": [{"name": "short component name, e.g. Title Page", "purpose": "one sentence on what it's for and what goes in it"}],
  "physicalFormat": "one sentence on the core physical mechanic (cut/fold/glue/color/etc)"
}`;

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = resp.content.find((b: any) => b.type === 'text') as any;
    const raw = (textBlock?.text || '').replace(/```json|```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed) return NextResponse.json({ error: 'Could not parse the synthesized schema -- try again' }, { status: 502 });

    const schema = await createSchema(userId, {
      name: String(name).trim(),
      structural_summary: JSON.stringify({
        structuralSummary: String(parsed.structuralSummary || ''),
        components: Array.isArray(parsed.components) ? parsed.components : [],
        physicalFormat: String(parsed.physicalFormat || ''),
      }),
      source_resource_ids: withNotes.map((r: any) => r.id),
      source_titles: withNotes.map((r: any) => r.title),
    });

    return NextResponse.json({ ok: true, schema, usedResourceCount: withNotes.length });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
