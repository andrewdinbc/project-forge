import { supabase } from './supabase';

// 2026-07-20: every function here now takes an optional trailing `client`
// param, same fix already applied to lib/products.js on 2026-07-19 for the
// identical reason -- server routes (app/api/**) have no browser session,
// so the anon `supabase` client's auth.uid() is always null there and RLS
// silently blocks every read/write ("new row violates row-level security
// policy"). This file was missed in that pass; the new auto-generate
// bundle orchestrator (app/api/bundles/auto-generate/*) hit it fresh.
// Server routes MUST pass supabaseAdmin explicitly -- see
// app/api/products/route.ts for the established pattern. Client
// components (the dashboard bundle pages) call these with no client arg,
// unchanged, and keep using the real browser session as before.
//
// Durable guard: scripts/check-server-client-usage.js greps app/api/**
// for calls to these functions (and lib/products.js's) with no trailing
// client argument and fails if it finds one, so a future server route
// that forgets this gets caught instead of shipping a silent RLS 500.

/**
 * Create a new bundle
 */
export async function createBundle(userId, bundleData, client = supabase) {
  const { data, error } = await client
    .from('bundles')
    .insert({
      user_id: userId,
      title: bundleData.title,
      description: bundleData.description || null,
      bundle_type: bundleData.bundle_type || 'custom',
      grade_levels: bundleData.grade_levels || [],
      subjects: bundleData.subjects || [],
      thumbnail_url: bundleData.thumbnail_url || null,
      bundle_discount: bundleData.bundle_discount || 0,
      original_price_usd: bundleData.original_price_usd || 0,
      bundle_price_usd: bundleData.bundle_price_usd || 0,
      status: bundleData.status || 'draft',
      style_selections: bundleData.style_selections || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all bundles for a user
 */
export async function getUserBundles(userId, options = {}, client = supabase) {
  let query = client
    .from('bundles')
    .select(`
      *,
      bundle_items (count)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get a single bundle by ID
 */
export async function getBundle(bundleId, userId, client = supabase) {
  const { data, error } = await client
    .from('bundles')
    .select(`
      *,
      bundle_items (
        id,
        sort_order,
        products:product_id (*)
      )
    `)
    .eq('id', bundleId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Update a bundle
 */
export async function updateBundle(bundleId, userId, updates, client = supabase) {
  const { data, error } = await client
    .from('bundles')
    .update({
      ...updates,
      updated_at: new Date(),
    })
    .eq('id', bundleId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a bundle
 */
export async function deleteBundle(bundleId, userId, client = supabase) {
  const { error } = await client
    .from('bundles')
    .delete()
    .eq('id', bundleId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Add a product to a bundle
 */
export async function addProductToBundle(bundleId, productId, userId, client = supabase) {
  // Verify user owns both bundle and product
  const bundle = await getBundle(bundleId, userId, client);
  if (!bundle) throw new Error('Bundle not found');

  const { data, error } = await client
    .from('bundle_items')
    .insert({
      bundle_id: bundleId,
      product_id: productId,
      sort_order: (bundle.bundle_items?.length || 0) + 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a product from a bundle
 */
export async function removeProductFromBundle(bundleItemId, bundleId, userId, client = supabase) {
  // Verify user owns bundle
  const bundle = await getBundle(bundleId, userId, client);
  if (!bundle) throw new Error('Bundle not found');

  const { error } = await client
    .from('bundle_items')
    .delete()
    .eq('id', bundleItemId)
    .eq('bundle_id', bundleId);

  if (error) throw error;
}

/**
 * Reorder bundle items
 */
export async function reorderBundleItems(bundleId, userId, items, client = supabase) {
  // Verify user owns bundle
  const bundle = await getBundle(bundleId, userId, client);
  if (!bundle) throw new Error('Bundle not found');

  const updates = items.map((item, index) => ({
    id: item.id,
    sort_order: index + 1,
  }));

  const { error } = await client
    .from('bundle_items')
    .upsert(updates);

  if (error) throw error;
}
