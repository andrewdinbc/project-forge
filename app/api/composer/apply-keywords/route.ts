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

    // 2026-07-19 rewrite, per Aj: a prior version of this prompt matched on
    // category/format alone (e.g. "color by number") without checking
    // whether the SUBJECT MATTER actually fit the instruction -- asked for
    // "a color by number out of the Force and Motion content," it grabbed
    // an unrelated Human Body Systems color-by-number and even an
    // unrelated coloring page from a completely different product, just
    // because they shared the "color by number" label. That's wrong: a
    // component only qualifies if it matches BOTH the format/type AND the
    // subject/topic the instruction actually named. Also added an explicit
    // capability check -- this endpoint can only select among EXISTING
    // tagged components, it cannot write new content (e.g. a real color-
    // by-number worksheet needs brand-new trivia questions written from
    // scratch, which is a generation task, not a selection task). If
    // nothing tagged genuinely satisfies the instruction, the correct
    // answer is an empty include list and an honest explanation -- never a
    // loose substitute.
    const prompt = `A teacher is building a hybrid TPT (Teachers Pay Teachers) resource by mixing tagged sections from several source products. Here are all the tagged components available to choose from:

${componentList}

The teacher's instruction:
"${instruction}"

Think this through carefully and take your time before deciding -- do not pattern-match on surface keywords alone.

Step 1: What is the teacher actually asking for? Identify BOTH the subject/topic they named (e.g. "Force and Motion") AND the format/type they named (e.g. "color by number"), if any.

Step 2: For EACH component, check whether it genuinely satisfies BOTH the topic AND the format the instruction asked for -- not just one of the two. A component whose category/label matches the requested format but whose actual subject matter (judge this from its product title and label, not just the category name) is unrelated to the requested topic is NOT a match, even if the label text looks similar (e.g. a "Human Body Systems" color-by-number is not a match for "Force and Motion color by number" just because both are color-by-numbers). Only include components you are genuinely confident satisfy the full instruction.

Step 3: Be honest about capability. This tool can only INCLUDE OR EXCLUDE existing tagged components -- it cannot write, generate, or invent new content. If the instruction is asking for something that doesn't exist among the tagged components (e.g. no product has a genuine Force and Motion color-by-number tagged), do NOT substitute a loosely-related component just to return something. Instead, return an empty include list and explain in your reasoning that no existing tagged component actually matches, and that generating brand-new content in that format would need Style Lab (which writes wholly original content in a chosen style) rather than Composer (which only recombines real existing pages).

Only make an EXCLUDE decision about a component if the instruction is genuinely relevant to it. If the instruction says nothing that relates to a component, leave it out of both lists entirely so the teacher's existing choice for it is preserved.

Respond with ONLY a JSON object, no markdown fences, no other text:
{"include": ["id1", "id2"], "exclude": ["id3"], "reasoning": "1-3 sentences explaining what you found (or didn't find) and why"}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
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
