import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSchema, incrementGenerationCount } from '@/lib/schema-lab';
import { getStyleProfile, createResource, buildSteeringContext } from '@/lib/style-lab';
import { CURRICULUM_ELABORATIONS, ELABORATIONS_SUBJECT_MAP } from '@/lib/curriculum-full-elaborations';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BC_ALIASES = ['bc', 'british columbia', 'british columbia, canada'];

// Schema Lab step 3 (Aj, 2026-07-19): "apply it to a new learning setting...
// have AI use it as inspiration in conjunction with design assets I have
// made to create it for me on new subject matter." Mirrors
// /api/style-lab/generate-content's curriculum-grounding pattern, but
// structured around the SCHEMA's defined components (e.g. "Title Page",
// "Foldable: Flap 1", "Prefilled Answer Key") instead of generic
// question/problem/prompt items -- because that structure is the whole
// point of picking a schema.
//
// Honest boundary: this generates the STRUCTURAL TEXT CONTENT for each
// component (what a title page should say, what each flap's content is,
// what the answer key contains) -- it does NOT generate a finished, laid-
// out foldable-template PDF with correct cut/fold lines; no image model
// reliably produces precise geometric templates like that today. The
// output is meant to be taken into Composer/Asset Modifier/Font Modifier
// (with your own design assets) to actually lay it out, same as any other
// AI-generated content already flows into Composer.
//
// POST { userId, schemaId, subject, grade, topic?, jurisdiction?, styleProfileId? }
export async function POST(request: NextRequest) {
  try {
    const { userId, schemaId, subject, grade, topic, jurisdiction, styleProfileId } = (await request.json()) || {};
    if (!userId || !schemaId || !subject || !grade) {
      return NextResponse.json({ error: 'userId, schemaId, subject, and grade are required' }, { status: 400 });
    }

    const schema = await getSchema(userId, schemaId);
    if (!schema) return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    let schemaData: any;
    try { schemaData = JSON.parse(schema.structural_summary); } catch { schemaData = { structuralSummary: schema.structural_summary, components: [] }; }

    const jur = (jurisdiction || 'British Columbia, Canada').trim();
    const isBC = BC_ALIASES.includes(jur.toLowerCase());
    let curriculumBlock: string;
    let curriculumConfidence = 'grounded';
    if (isBC) {
      const subjectKey = (ELABORATIONS_SUBJECT_MAP as any)[subject];
      const curriculumGrade = subjectKey ? (CURRICULUM_ELABORATIONS as any)[subjectKey]?.[grade] : null;
      curriculumBlock = curriculumGrade
        ? `Official BC Curriculum for ${subject}, Grade ${grade}:\nBig Ideas: ${curriculumGrade.bigIdeas.join(' | ')}\nContent: ${curriculumGrade.content.join(' | ')}`
        : `No structured BC curriculum data found for ${subject} Grade ${grade} -- use general grade-appropriate BC curriculum knowledge.`;
      if (!curriculumGrade) curriculumConfidence = 'general_knowledge';
    } else {
      curriculumBlock = `Jurisdiction: ${jur}. Use your general knowledge of ${jur}'s official curriculum standards for ${subject}, Grade ${grade}. Stay conservative and general rather than inventing specific standard codes you're not confident about.`;
      curriculumConfidence = 'general_knowledge';
    }

    const styleProfile = styleProfileId ? await getStyleProfile(userId, styleProfileId).catch(() => null) : null;
    const steeringContext = await buildSteeringContext(userId).catch(() => '');

    const componentList = (schemaData.components || []).map((c: any) => `- ${c.name}: ${c.purpose}`).join('\n');

    const prompt = `You are writing WHOLLY ORIGINAL instructional content for a NEW activity, following a specific reusable activity-type SCHEMA, on a NEW subject. Do not reference or reproduce any existing published resource's specific content -- this is new material built to fit the schema's structure.

Activity type: "${schema.name}"
Schema definition: ${schemaData.structuralSummary}
Physical format: ${schemaData.physicalFormat || 'not specified'}
Structural components to fill in:
${componentList || '- Main content'}

New subject: ${subject}
Grade: ${grade}
${topic ? `Topic/focus: ${topic}` : ''}

${curriculumBlock}
${styleProfile ? `\nWrite in this blended style (format/tone/pacing, not content to copy): ${styleProfile.blended_style_text}` : ''}
${steeringContext}

For EACH structural component listed above, write the actual content that would go in it for this new subject -- concrete, usable, grade-accurate for ${jur}. Keep the same component breakdown the schema defines; don't add or drop components without reason.

Respond with ONLY valid JSON, no prose, no markdown:
{"title": "a title for this new activity", "components": [{"name": "component name matching the schema", "content": "the actual original content for this component"}]}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b: any) => (b as any).type === 'text') as any;
    const text = (raw?.text || '{}').replace(/```json|```/g, '').trim();
    let generated: any;
    try {
      generated = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      generated = match ? JSON.parse(match[0]) : { title: `${schema.name} — ${subject}`, components: [] };
    }

    const bodyText = (generated.components || [])
      .map((c: any) => `## ${c.name}\n${c.content}`)
      .join('\n\n');

    const saved = await createResource(userId, {
      subject, source_type: 'pdf', origin: 'schema_generated',
      title: generated.title || `${schema.name} — ${subject} Grade ${grade} (${jur})`,
      original_text: bodyText, edited_text: bodyText, status: 'edited',
    });

    await incrementGenerationCount(userId, schemaId).catch(() => {});

    return NextResponse.json({
      ok: true, content: generated, savedResourceId: saved.id,
      schemaName: schema.name, jurisdiction: jur, curriculumConfidence,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
