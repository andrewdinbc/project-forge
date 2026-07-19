import { supabaseAdmin } from './supabase';

// Data layer for the Style Lab (formerly built as "Forge" inside the
// lesson-planner repo -- moved here 2026-07-18 per Aj, since project-forge
// already exists as the real TPT bundle/publishing app and this is its
// content-origination stage). Uses the SAME shared Supabase project as
// lesson-planner (bxsrnamtutxjzglyqmhc) and the SAME tables
// (forge_resources, style_profiles) -- no data migration needed, this is
// purely porting the application code to live in the right repo.

// 2026-07-19: switched from the anon `supabase` client to `supabaseAdmin`.
// Every function in this file is called only from server-side API routes
// under app/api/style-lab/* (verified: no 'use client' component imports
// this file directly) -- those routes have no browser session/cookies, so
// the anon client's auth.uid() was always null and RLS silently blocked
// every read AND write through this whole file. Same root cause already
// found and fixed in lib/products.js and lib/product-components.js.
// Ownership is still enforced explicitly via .eq('user_id', userId) on
// every query, so this isn't a new access-control gap.

// ---------- Resources ----------

export async function listResources(userId) {
  const { data, error } = await supabaseAdmin
    .from('forge_resources')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createResource(userId, resourceData) {
  const { data, error } = await supabaseAdmin
    .from('forge_resources')
    .insert({ user_id: userId, ...resourceData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getResource(userId, id) {
  const { data, error } = await supabaseAdmin
    .from('forge_resources')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function updateResource(userId, id, patch) {
  const { data, error } = await supabaseAdmin
    .from('forge_resources')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function flattenIncludedLayerText(layers) {
  return Object.entries(layers || {})
    .map(([key, items]) => {
      const inc = (Array.isArray(items) ? items : []).filter((i) => i.included).map((i) => i.text);
      return inc.length ? `${key}: ${inc.join(', ')}` : null;
    })
    .filter(Boolean)
    .join(' ');
}

// ---------- Style profiles (blends) ----------

export async function listStyleProfiles(userId) {
  const { data, error } = await supabaseAdmin
    .from('style_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createStyleProfile(userId, profileData) {
  const { data, error } = await supabaseAdmin
    .from('style_profiles')
    .insert({ user_id: userId, ...profileData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getStyleProfile(userId, id) {
  const { data, error } = await supabaseAdmin
    .from('style_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function updateStyleProfile(userId, id, patch) {
  const { data, error } = await supabaseAdmin
    .from('style_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Steering documents (shared table, also used by lesson-planner) ----------

export async function pushToSteering(userId, doc) {
  const { data, error } = await supabaseAdmin
    .from('steering_documents')
    .insert({ user_id: userId, ...doc })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Building steering context for generation prompts ----------
// Lightweight version of lesson-planner's buildSteeringContext() -- pulls
// this user's steering_documents and formats them as prompt context.
export async function buildSteeringContext(userId) {
  const { data, error } = await supabaseAdmin
    .from('steering_documents')
    .select('title, full_text, category')
    .eq('user_id', userId)
    .limit(20);
  if (error || !data?.length) return '';
  return `\nTeacher's steering documents (background context):\n${data.map((d) => `[${d.category}] ${d.title}: ${d.full_text.slice(0, 1000)}`).join('\n')}`;
}
