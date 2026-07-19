import { supabaseAdmin } from './supabase';

// Schema Lab (Aj, 2026-07-19): "Schema Creator... Schema Lab... Schema
// Library." Not a resource's content, and not just its abstract style --
// this is the reusable ACTIVITY TYPE / GENRE STRUCTURE (e.g. "Interactive
// Notebook": cut/fold/glue foldables, title page, KWL chart, prefilled
// answer key), synthesized across multiple example resources so it captures
// what's common to the genre rather than one seller's specific product.

export async function listSchemas(userId) {
  const { data, error } = await supabaseAdmin
    .from('activity_schemas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSchema(userId, id) {
  const { data, error } = await supabaseAdmin
    .from('activity_schemas')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function createSchema(userId, payload) {
  const { data, error } = await supabaseAdmin
    .from('activity_schemas')
    .insert({ user_id: userId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSchema(userId, id) {
  const { error } = await supabaseAdmin.from('activity_schemas').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function incrementGenerationCount(userId, id) {
  const { data } = await supabaseAdmin
    .from('activity_schemas')
    .select('generation_count')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  await supabaseAdmin
    .from('activity_schemas')
    .update({ generation_count: (data?.generation_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
}
