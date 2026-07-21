import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { findOrganizer } from '@/lib/graphic-organizer-catalog';
import { errorMessage } from '@/lib/error-message';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Personalization (Aj, 2026-07-19): "The hope is that AI can personalize
// the content to the task at hand instead of the end user having to
// upload all of it." Given the organizer's slot labels + a topic/task,
// writes brief original content for each slot -- never reproducing
// anyone else's text, same principle as Style Lab's content generation.
function slotsForOrganizer(tool: any): string[] {
  if (tool.layout === 'boxes') return tool.slots;
  if (tool.layout === 'columns') return tool.columns;
  if (tool.layout === 'radial' || tool.layout === 'quadrant') return [tool.center, ...tool.slots];
  if (tool.layout === 'venn') return [tool.a, tool.b, tool.both];
  if (tool.layout === 'chain') return Array.from({ length: tool.count }, (_, i) => `Step ${i + 1}`);
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const { organizerKey, task, grade } = (await request.json()) || {};
    if (!organizerKey || !task || !String(task).trim()) {
      return NextResponse.json({ error: 'organizerKey and task are required' }, { status: 400 });
    }
    const tool = findOrganizer(organizerKey);
    if (!tool) return NextResponse.json({ error: 'Unknown organizer type' }, { status: 400 });
    if (tool.layout === 'tree') {
      return NextResponse.json({ error: 'AI-fill isn\'t available for Relationship Trees yet -- generate it blank for students to fill in.' }, { status: 400 });
    }

    const slots = slotsForOrganizer(tool);
    const gradeNote = grade ? ` for ${grade} students` : '';
    const prompt = `You are helping a teacher fill in a "${tool.label}" graphic organizer${gradeNote} on this topic/task: "${String(task).trim()}"

The organizer has these sections: ${slots.map((s) => `"${s}"`).join(', ')}

For each section, write brief, original, age-appropriate content (roughly 1-2 short sentences, or a short phrase where the section is naturally a single word/phrase like "Part of Speech") specific to this topic. Never copy text from any existing book, worksheet, or website -- write it fresh.

Return ONLY JSON, no markdown fences, with exactly these keys: {${slots.map((s) => `"${s}": "..."`).join(', ')}}`;

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = (res.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
    // 2026-07-21: extract the {...} object rather than assuming the whole
    // response is JSON -- the model can show reasoning before the object
    // despite being told not to (see word-ladders fix, same root cause).
    const objMatch = raw.match(/\{[\s\S]*\}/);
    const jsonText = objMatch ? objMatch[0] : raw.replace(/```json|```/g, '').trim();
    let content: any = {};
    try { content = JSON.parse(jsonText); } catch { content = {}; }

    return NextResponse.json({ ok: true, content });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
