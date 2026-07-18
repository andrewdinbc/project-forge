import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getResource, updateResource } from '@/lib/style-lab';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { userId, id } = await request.json();
    if (!userId || !id) return NextResponse.json({ error: 'userId and id are required' }, { status: 400 });

    const row = await getResource(userId, id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const text = (row.edited_text || row.original_text || '').slice(0, 8000);

    const prompt = `You are helping a BC teacher prepare a Teachers Pay Teachers (TPT) listing for a resource they've made, sold under their store "Chalk & Circuit".

Resource title: ${row.title}
Subject/context: ${[row.subject, row.unit_name].filter(Boolean).join(' -- ') || 'not specified'}
Resource content:
${text}

Write TPT listing prep material. Respond with ONLY JSON, no markdown fences:
{
  "productTitle": "a catchy, keyword-rich TPT product title (under 100 chars)",
  "description": "a 3-4 paragraph TPT product description in an encouraging, teacher-to-teacher voice",
  "previewBlurb": "1-2 sentences suitable for the short preview/thumbnail text",
  "suggestedTags": ["5-8 relevant TPT search tags/keywords"],
  "suggestedPriceRange": "a realistic price range in USD, e.g. '$3-$6'",
  "sellerNote": "a short private note reminding the seller to also mention their full TeacherAssist ecosystem somewhere in the listing or a follow-up email -- 1-2 sentences, for the seller's eyes only"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.find((b) => b.type === 'text')?.text || '{}';
    const tpt_package = JSON.parse(raw.replace(/```json|```/g, '').trim());

    await updateResource(userId, id, { status: 'tpt_package_ready', tpt_package });

    return NextResponse.json({ tpt_package });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
