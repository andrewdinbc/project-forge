import { NextResponse } from 'next/server';
import { getStyleProfile, updateStyleProfile, pushToSteering } from '@/lib/style-lab';
import { dialValuesToPromptText } from '@/lib/style-dials';

export async function POST(request) {
  try {
    const { userId, id } = await request.json();
    if (!userId || !id) return NextResponse.json({ error: 'userId and id are required' }, { status: 400 });

    const profile = await getStyleProfile(userId, id);
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const dialText = dialValuesToPromptText(profile.dial_values);
    const fullText = `STYLE/GENRE PREFERENCE (not content to reproduce -- write ORIGINAL material in this style): ${profile.blended_style_text}${dialText ? `\n${dialText}` : ''}`;

    const doc = await pushToSteering(userId, {
      title: `Style Profile: ${profile.name}`,
      full_text: fullText,
      category: 'actionable_resources',
      source_type: 'style_profile',
    });

    await updateStyleProfile(userId, id, { pushed_to_steering_doc_id: doc.id });

    return NextResponse.json({ ok: true, steering_doc_id: doc.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
