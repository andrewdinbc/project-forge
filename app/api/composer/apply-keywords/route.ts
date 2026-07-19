import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_GROUPS } from '@/lib/component-categories';

// Lets a teacher describe in plain English which tagged components they
// want included (e.g. "I like the interactive notebook aspects of Force
// and Motion, apply that to Human Body Systems") and has the AI translate
// that into specific component include/exclude decisions, rather than
// making them find and toggle each item by hand. Additive by design: the
// AI only returns components it has an opinion on; anything it doesn't
// mention is left as whatever the teacher already had set, so a vague or
// partial instruction can't silently blow away unrelated manual choices.
//
// 2026-07-19: also generates original content to fill genuine gaps -- e.g.
// "make a color by number out of the Force and Motion content" when no
// tagged product has a real Force and Motion color-by-number. Previously
// this either grabbed a loosely-matching unrelated component (wrong) or
// gave up and pointed to Style Lab (safe but not what Aj wants: "when it
// can't be fulfilled from existing content I want it to fill in the gaps
// between them"). Now it identifies what's genuinely missing and writes
// real new content for it, grounded in the actual tagged Force and Motion
// material available (so the generated content is accurate to what's
// being taught, not generic), in the format the instruction asked for.
// This IS new content generation -- a deliberate, explicit exception to
// Composer's normal "only recombine real pages" rule, scoped to filling a
// gap the teacher explicitly asked for. The generated text becomes a new
// page in the final PDF (see app/api/composer/generate), not a real
// source page, and is clearly labeled as AI-generated in the picker.
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

    const validCategoryKeys = CATEGORY_GROUPS.flatMap((g) => g.categories.map((c) => c.key));
    const categoryList = CATEGORY_GROUPS.flatMap((g) => g.categories).map((c) => `${c.key} (${c.label})`).join(', ');

    const prompt = `A teacher is building a hybrid TPT (Teachers Pay Teachers) resource by mixing tagged sections from several source products. Here are all the tagged components available to choose from:

${componentList}

Valid category keys for this product: ${categoryList}

The teacher's instruction:
"${instruction}"

Think this through carefully and take your time before deciding -- do not pattern-match on surface keywords alone.

Step 1: What is the teacher actually asking for? Identify BOTH the subject/topic they named (e.g. "Force and Motion") AND the format/type they named (e.g. "color by number"), if any.

Step 2: For EACH existing component, check whether it genuinely satisfies BOTH the topic AND the format -- not just one of the two. A component whose category/label matches the requested format but whose actual subject matter (judge this from its product title and label, not just the category name) is unrelated to the requested topic is NOT a match, even if the label text looks similar (e.g. a "Human Body Systems" color-by-number is not a match for "Force and Motion color by number" just because both are color-by-numbers). Only include components you are genuinely confident satisfy the full instruction. Include those in "include".

Step 3: Identify the gap. If the instruction asks for something in a format/type that doesn't exist among the tagged components for the requested topic, that's a genuine gap -- selection alone can't fulfill it. When that happens, WRITE the missing content yourself:
- Ground it in the actual subject matter from the tagged components that DO relate to the topic (read their labels/notes to know what content the teacher is actually teaching -- e.g. if Force and Motion vocabulary components exist tagged as force, balanced/unbalanced force, Newton's laws, speed, etc., use those exact concepts as the basis for the new content, don't invent unrelated facts).
- Match the requested FORMAT as a real, usable teaching artifact. For a "color by number," write a real question-and-multiple-choice-answer table structured like this, with a distinct color assigned to the correct answer choice for each question (this is genuinely fillable text content -- the color-by-number picture/illustration itself is a separate design asset this tool cannot draw, so do not attempt to describe or generate imagery):
  Directions: [standard color-by-number instructions]
  1. [question] | A) [choice] [color] | B) [choice] [color] | C) [choice] [color]
  (repeat for a reasonable number of questions, e.g. 8-12)
- For other formats (task cards, quizzes, vocabulary lists, etc.), write genuinely complete, ready-to-use content in that format, not a placeholder or outline.
- Pick the single best-fitting category key from the valid list above for this new content.
- Give it a clear label (e.g. "Force and Motion Color by Number").
- Add it to a "generated" array: {"category": "category_key", "label": "...", "content": "the full ready-to-use text content"}.
- If there is genuinely no related topic content among the tagged components to ground this in (the topic itself doesn't appear anywhere), do not invent content from nothing -- leave "generated" empty and explain why in reasoning instead.

Only make an EXCLUDE decision about an existing component if the instruction is genuinely relevant to it. If the instruction says nothing that relates to a component, leave it out of both lists entirely so the teacher's existing choice for it is preserved.

Respond with ONLY a JSON object, no markdown fences, no other text:
{"include": ["id1"], "exclude": ["id2"], "generated": [{"category": "category_key", "label": "...", "content": "..."}], "reasoning": "2-4 sentences explaining what you found, what gap you filled (if any), and why"}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const validIds = new Set(components.map((c) => c.id));
    const include = Array.isArray(parsed.include) ? parsed.include.filter((id: string) => validIds.has(id)) : [];
    const exclude = Array.isArray(parsed.exclude) ? parsed.exclude.filter((id: string) => validIds.has(id)) : [];
    const generated = Array.isArray(parsed.generated)
      ? parsed.generated
          .filter((g: any) => g && typeof g.content === 'string' && g.content.trim() && validCategoryKeys.includes(g.category))
          .map((g: any, i: number) => ({
            tempId: `generated::${Date.now()}::${i}`,
            category: g.category,
            label: g.label || 'AI-Generated Content',
            content: g.content.trim(),
          }))
      : [];

    return NextResponse.json({ include, exclude, generated, reasoning: parsed.reasoning || '' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
