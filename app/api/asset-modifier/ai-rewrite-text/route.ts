import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { errorMessage } from '@/lib/error-message';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Asset Modifier's per-field AI rewrite box (Aj, 2026-07-20): "there
// should also be an AI writing box to upload into that spot." The
// existing AI instruction box in this editor (ai-edit/route.ts) operates
// on the whole canvas as an IMAGE via FLUX Kontext -- fine for borders/
// illustrations, wrong tool for rewriting a specific piece of TEXT (e.g.
// one comprehension question) on a loaded Reading Passage. This is a
// plain text-in/text-out Claude call scoped to exactly the selected
// text box's current content, so the rest of the passage is untouched.
//
// POST { userId, currentText, instruction, context? }
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId, currentText, instruction, context } = (await request.json()) || {};
    if (!userId || !currentText || !instruction?.trim()) {
      return NextResponse.json({ error: 'userId, currentText, and instruction are required' }, { status: 400 });
    }

    const prompt = `${context ? `${context}\n\n` : ''}Here is the current text of one piece of it:\n"""\n${currentText}\n"""\n\nRewrite it following this instruction: "${instruction.trim()}"\n\nKeep it roughly the same length and purpose unless the instruction says otherwise. Respond with ONLY the rewritten text -- no quotes, no preamble, no explanation.`;

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (res.content.find((b: any) => b.type === 'text') as any)?.text?.trim() || '';
    if (!text) return NextResponse.json({ error: 'AI did not return any text' }, { status: 502 });

    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
