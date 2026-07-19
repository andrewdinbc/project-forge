import { NextResponse } from 'next/server';
import { listResources, createResource, updateResource, getResource, flattenIncludedLayerText, pushToSteering } from '@/lib/style-lab';
import { extractPdfText } from '@/lib/pdf-extract';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Strips non-instructional boilerplate before content is pushed into AI
// Steering, per Aj 2026-07-19: cover pages, tables of contents, teacher
// information/instruction pages, terms of use, and credits pages are noise
// as generation context and can actively pollute it. Keeps everything else
// verbatim -- this is a removal pass, not a rewrite, so real instructional
// content, activities, and text are preserved exactly as extracted.
async function cleanForSteering(text, title) {
  if (!text || text.length < 200) return text; // too short to bother -- avoid AI mangling short/edge-case content

  const prompt = `You are cleaning extracted PDF/web text before it is used as background context for AI content generation. Remove ONLY the following, if present, and nothing else:
- Cover page text (title-page-only content like a big title, subtitle, byline, or decorative cover text with no instructional value)
- Table of contents listings
- Teacher information / "how to use this resource" instruction pages
- Terms of use / copyright license / usage rights text
- Credits pages (font credits, clipart credits, "made by" attributions)

Keep EVERYTHING else exactly as written, including all actual instructional content, activities, passages, questions, answer keys, and any other real educational material. Do not summarize, rewrite, or paraphrase anything you keep -- only remove the categories listed above. If none of those categories are present, return the text completely unchanged.

Document title: "${title || 'Untitled'}"

TEXT:
${text.slice(0, 18000)}

Respond with ONLY the cleaned text, no commentary, no markdown fences, no explanation of what you removed.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  const cleaned = response.content.find((b) => b.type === 'text')?.text || text;
  return cleaned.trim() || text;
}

// GET  /api/style-lab/resources?userId=...
// POST /api/style-lab/resources  { userId, action, ... }
//   action: 'upload' (multipart: userId, file, subject?, unitName?)
//         | 'add_url' (json: userId, url, subject?, unitName?)
//         | 'bulk_upload_tpt' (multipart: userId, files[])
//         | 'toggle_observation' | 'edit_observation' | 'set_layer_preference'
//           (json: userId, id, layerKey, ...)

// Uploads the original file bytes to the forge-resources bucket (same one
// lesson-planner's upload routes write to) and returns a public URL.
// Best-effort -- upload still succeeds text-only if this fails.
async function uploadOriginalFile(userId, file, buffer) {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error } = await supabaseAdmin.storage.from('forge-resources').upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) throw error;
    const { data: urlData } = supabaseAdmin.storage.from('forge-resources').getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.error('forge-resources file upload failed:', e.message);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  try {
    const resources = await listResources(userId);
    return NextResponse.json({ resources });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const userId = formData.get('userId');
      const action = formData.get('action');
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      if (action === 'bulk_upload_tpt') {
        const files = formData.getAll('files');
        const imported = [];
        const errors = [];
        for (const file of files) {
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const extracted = await extractPdfText(buffer);
            const fileUrl = await uploadOriginalFile(userId, file, buffer);
            const row = await createResource(userId, {
              source_type: 'pdf', origin: 'tpt_purchase',
              title: file.name.replace(/\.pdf$/i, ''),
              original_text: extracted.text.slice(0, 20000),
              file_url: fileUrl,
            });
            imported.push(row);
          } catch (e) {
            errors.push({ filename: file.name, error: e.message });
          }
        }
        return NextResponse.json({ imported, errors });
      }

      // default: single-file upload (from Resources-equivalent flow)
      const file = formData.get('file');
      const subject = formData.get('subject') || null;
      const unitName = formData.get('unitName') || null;
      if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractPdfText(buffer);
      const fileUrl = await uploadOriginalFile(userId, file, buffer);
      const row = await createResource(userId, {
        source_type: 'pdf', origin: 'manual_upload', subject, unit_name: unitName,
        title: file.name.replace(/\.pdf$/i, ''),
        original_text: extracted.text.slice(0, 20000),
        file_url: fileUrl,
      });
      return NextResponse.json({ resource: row });
    }

    const body = await request.json();
    const { userId, action, id } = body;
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    if (action === 'add_url') {
      const { url, subject, unitName } = body;
      if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });
      let title = url;
      let text = '';
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyleLab/1.0)' } });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();
        text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000);
      } catch (e) {
        return NextResponse.json({ error: `Couldn't fetch that URL: ${e.message}` }, { status: 422 });
      }
      const row = await createResource(userId, {
        source_type: 'url', origin: 'manual_upload', subject: subject || null, unit_name: unitName || null,
        title, source_url: url, original_text: text,
      });
      return NextResponse.json({ resource: row });
    }

    if (action === 'save_edit') {
      const { editedText } = body;
      const row = await updateResource(userId, id, { edited_text: editedText, status: 'edited' });
      return NextResponse.json({ ok: true, resource: row });
    }

    if (action === 'set_layer_preference') {
      const { layerKey, preference } = body;
      const existing = await getResource(userId, id);
      const prefs = { ...(existing?.layer_preferences || {}) };
      if (preference) prefs[layerKey] = preference;
      else delete prefs[layerKey];
      const row = await updateResource(userId, id, { layer_preferences: prefs });
      return NextResponse.json({ ok: true, layer_preferences: prefs, resource: row });
    }

    if (action === 'toggle_observation' || action === 'edit_observation') {
      const { layerKey, observationId, included, text } = body;
      const existing = await getResource(userId, id);
      const layers = { ...(existing?.layer_notes || {}) };
      layers[layerKey] = (layers[layerKey] || []).map((item) => {
        if (item.id !== observationId) return item;
        return action === 'toggle_observation' ? { ...item, included } : { ...item, text };
      });
      const flatSummary = flattenIncludedLayerText(layers);
      const row = await updateResource(userId, id, { layer_notes: layers, style_notes: flatSummary });
      return NextResponse.json({ ok: true, layer_notes: layers, style_notes: flatSummary, resource: row });
    }

    if (action === 'mark_for_tpt') {
      const row = await updateResource(userId, id, { status: 'marked_for_tpt' });
      return NextResponse.json({ ok: true, resource: row });
    }

    // Pre-existing gap fixed 2026-07-19: the Style Lab UI has always had a
    // "Push to AI Steering" button per-resource that POSTs this action, but
    // no handler for it existed here -- every click silently returned
    // "Unknown action: push_to_steering". Copies this resource's content
    // (the teacher's edited version if they made one, otherwise the raw
    // extracted text) into steering_documents, where it's live in AI
    // generation immediately, same as a Style Lab blend push.
    //
    // 2026-07-19: added an AI cleanup pass right before the push, per Aj --
    // extracted PDF text carries whatever boilerplate the source document
    // had (cover page, table of contents, teacher instructions, terms of
    // use, credits), none of which is useful as generation context and can
    // actively pollute it. This runs unconditionally on whatever text is
    // about to be pushed (including teacher-edited text, since manual
    // edits don't necessarily already strip this out), and the cleaned
    // result is saved back as edited_text so what's visible afterward
    // matches what actually got pushed.
    if (action === 'push_to_steering') {
      const existing = await getResource(userId, id);
      if (!existing) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      const rawText = existing.edited_text || existing.original_text || '';
      if (!rawText.trim()) return NextResponse.json({ error: 'No content on this resource to push' }, { status: 400 });

      let text = rawText;
      try {
        text = await cleanForSteering(rawText, existing.title);
      } catch (e) {
        console.error('AI cleanup before steering push failed, pushing original text:', e.message);
      }

      const doc = await pushToSteering(userId, {
        title: existing.title,
        full_text: text,
        category: 'actionable_resources',
        source_type: existing.source_type === 'url' ? 'url' : 'upload',
        source_url: existing.source_url || null,
        char_count: text.length,
      });
      const row = await updateResource(userId, id, { status: 'pushed_to_steering', pushed_to_steering_doc_id: doc.id, edited_text: text });
      return NextResponse.json({ ok: true, steering_doc_id: doc.id, resource: row });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
