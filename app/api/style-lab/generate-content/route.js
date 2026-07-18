import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStyleProfile, createResource, buildSteeringContext } from '@/lib/style-lab';
import { CURRICULUM_ELABORATIONS, ELABORATIONS_SUBJECT_MAP } from '@/lib/curriculum-full-elaborations';

// Generates WHOLLY ORIGINAL content, grade- and jurisdiction-driven by the
// end user's selection, in a blended style. Never derived from any
// uploaded/purchased resource's content -- ported from lesson-planner,
// including the BC curriculum data file, so BC grounding isn't lost in
// the move. See that repo's version for the full rationale.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BC_ALIASES = ['bc', 'british columbia', 'british columbia, canada'];

export async function POST(request) {
  try {
    const { userId, styleProfileId, subject, grade, topic, jurisdiction } = await request.json();
    if (!userId || !subject || !grade) return NextResponse.json({ error: 'userId, subject, and grade are required' }, { status: 400 });
    const jur = (jurisdiction || 'British Columbia, Canada').trim();
    const isBC = BC_ALIASES.includes(jur.toLowerCase());

    const profile = styleProfileId ? await getStyleProfile(userId, styleProfileId) : null;

    let curriculumBlock;
    let curriculumConfidence = 'grounded';
    if (isBC) {
      const subjectKey = ELABORATIONS_SUBJECT_MAP[subject];
      const curriculumGrade = subjectKey ? CURRICULUM_ELABORATIONS[subjectKey]?.[grade] : null;
      curriculumBlock = curriculumGrade
        ? `Official BC Curriculum for ${subject}, Grade ${grade}:\nBig Ideas: ${curriculumGrade.bigIdeas.join(' | ')}\nContent: ${curriculumGrade.content.join(' | ')}`
        : `No structured BC curriculum data found for ${subject} Grade ${grade} -- use general grade-appropriate BC curriculum knowledge.`;
      if (!curriculumGrade) curriculumConfidence = 'general_knowledge';
    } else {
      curriculumBlock = `Jurisdiction: ${jur}. Use your general knowledge of ${jur}'s official curriculum standards for ${subject}, Grade ${grade}. Stay conservative and general rather than inventing specific standard codes you're not confident about.`;
      curriculumConfidence = 'general_knowledge';
    }

    const steeringContext = await buildSteeringContext(userId).catch(() => '');

    const styleBlock = profile
      ? `Style/genre to write in (format, tone, pacing -- NOT content to copy): ${profile.blended_style_text}`
      : 'No specific style profile selected -- use clear, grade-appropriate, engaging style.';

    const prompt = `You are writing WHOLLY ORIGINAL instructional content for a teaching resource. This content must be entirely your own creation -- do not reference or reproduce any existing published resource's specific questions, passages, or exercises.

Subject: ${subject}
Grade: ${grade}
${topic ? `Topic/focus: ${topic}` : ''}

${curriculumBlock}

${styleBlock}
${steeringContext}

Write original instructional content appropriate for this grade and curriculum: 4-6 concrete items (questions, problems, prompts, or tasks depending on subject) that a teacher could use directly. Make it genuinely new material, grade-accurate for ${jur}, and written in the requested style.

Respond with ONLY JSON, no markdown fences:
{"title": "a title for this content set", "items": [{"type": "question|problem|prompt|task", "text": "the actual original content item"}]}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b) => b.type === 'text')?.text || '{}';
    const generated = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const bodyText = generated.items.map((item, i) => `${i + 1}. [${item.type}] ${item.text}`).join('\n\n');
    const saved = await createResource(userId, {
      subject, source_type: 'pdf', origin: 'ai_generated_original',
      title: generated.title || `Original content — ${subject} Grade ${grade} (${jur})`,
      original_text: bodyText, edited_text: bodyText, status: 'edited',
    });

    return NextResponse.json({ content: generated, savedResourceId: saved.id, jurisdiction: jur, curriculumConfidence });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
