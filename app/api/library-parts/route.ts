import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const admin: any = supabaseAdmin;

// Parts Library: save/list/remove favorite individual components or
// Style Lab resources for reuse across future products. Aj, 2026-07-19.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  try {
    const { data, error } = await admin
      .from('library_parts')
      .select('*, products:source_product_id (id, title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ parts: data || [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, kind, sourceId, sourceProductId, title, category, notes, fileUrl } = body;
    if (!userId || !kind || !sourceId || !title) {
      return NextResponse.json({ error: 'userId, kind, sourceId, and title are required' }, { status: 400 });
    }
    if (kind !== 'component' && kind !== 'resource' && kind !== 'image') {
      return NextResponse.json({ error: 'kind must be "component", "resource", or "image"' }, { status: 400 });
    }

    // Avoid duplicate stars for the same source item.
    const { data: existing } = await admin
      .from('library_parts')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('source_id', sourceId)
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, alreadySaved: true, id: existing[0].id });
    }

    const { data, error } = await admin
      .from('library_parts')
      .insert({
        user_id: userId, kind, source_id: sourceId,
        source_product_id: sourceProductId || null,
        title, category: category || null, notes: notes || null,
        file_url: fileUrl || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, part: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const id = searchParams.get('id');
    if (!userId || !id) return NextResponse.json({ error: 'userId and id are required' }, { status: 400 });
    const { error } = await admin.from('library_parts').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
