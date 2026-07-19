import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Lets a teacher describe in plain English which tagged components they
// want included (e.g. "I like the interactive notebook aspects of Force
// and Motion, apply that to Human Body Systems") and has the AI translate
// that into specific component include/exclude decisions, rather than
// making them find and toggle each item by hand. Additive by design: the
// AI only returns components it has an opinion on; anything it doesn't
// mention is left as whatever the teacher already had set, so a vague or
// partial instruction can't silently blow away unrelated manual choices.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ComponentSummary {
  id: string;
  category: string;
  categoryLabel: string;
  label: string;
  notes: string | null;
  productTitle: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instruction, components } = body as { instruction: string; components: ComponentSummary[] };

    if (!instruction || !instruction.trim()) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }
    if (!components || components.length === 0) {
      return NextResponse.json({ error: 'No tagged components available to choose from' }, { status: 400 });
    }

    const componentList = components
      .map((c) => `- id="${c.id}" | category: ${c.categoryLabel} (${c.category}) | product: "${c.productTitle}" | label: "${c.label}"${c.notes ? ` | notes: ${c.notes}` : ''}`)
      .join('\n');

    const prompt = `A teacher is building a hybrid TPT (Teachers Pay Teachers) resource by mixing tagged sections from several source products. Here are all the tagged components available to choose from:

${componentList}

The teacher's instruction:
"${instruction}"

Decide which components should be INCLUDED and which should be EXCLUDED based on this instruction. Only make a decision about a component if the instruction is genuinely relevant to it (mentions its product, its category/type, or a clear synonym/description of it) -- if the instruction says nothing that relates to a component, leave it out of both lists entirely so the teacher's existing choice for it is preserved.

Respond with ONLY a JSON object, no markdown fences, no other text:
{"include": ["id1", "id2"], "exclude": ["id3"], "reasoning": "one short sentence explaining the key decisions"}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const validIds = new Set(components.map((c) => c.id));
    const include = Array.isArray(parsed.include) ? parsed.include.filter((id: string) => validIds.has(id)) : [];
    const exclude = Array.isArray(parsed.exclude) ? parsed.exclude.filter((id: string) => validIds.has(id)) : [];

    return NextResponse.json({ include, exclude, reasoning: parsed.reasoning || '' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
