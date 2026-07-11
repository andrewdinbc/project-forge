import { supabase } from './supabase';

/**
 * Create a new bundle
 */
export async function createBundle(userId, bundleData) {
  const { data, error } = await supabase
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
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all bundles for a user
 */
export async function getUserBundles(userId, options = {}) {
  let query = supabase
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
export async function getBundle(bundleId, userId) {
  const { data, error } = await supabase
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
export async function updateBundle(bundleId, userId, updates) {
  const { data, error } = await supabase
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
export async function deleteBundle(bundleId, userId) {
  const { error } = await supabase
    .from('bundles')
    .delete()
    .eq('id', bundleId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Add a product to a bundle
 */
export async function addProductToBundle(bundleId, productId, userId) {
  // Verify user owns both bundle and product
  const bundle = await getBundle(bundleId, userId);
  if (!bundle) throw new Error('Bundle not found');

  const { data, error } = await supabase
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
export async function removeProductFromBundle(bundleItemId, bundleId, userId) {
  // Verify user owns bundle
  const bundle = await getBundle(bundleId, userId);
  if (!bundle) throw new Error('Bundle not found');

  const { error } = await supabase
    .from('bundle_items')
    .delete()
    .eq('id', bundleItemId)
    .eq('bundle_id', bundleId);

  if (error) throw error;
}

/**
 * Reorder bundle items
 */
export async function reorderBundleItems(bundleId, userId, items) {
  // Verify user owns bundle
  const bundle = await getBundle(bundleId, userId);
  if (!bundle) throw new Error('Bundle not found');

  const updates = items.map((item, index) => ({
    id: item.id,
    sort_order: index + 1,
  }));

  const { error } = await supabase
    .from('bundle_items')
    .upsert(updates);

  if (error) throw error;
}
