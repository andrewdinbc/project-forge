import { supabase } from './supabase';

/**
 * Create a new product
 */
export async function createProduct(userId, productData, client = supabase) {
  const { data, error } = await client
    .from('products')
    .insert({
      user_id: userId,
      title: productData.title,
      description: productData.description || null,
      resource_type: productData.resource_type || null,
      grade_level: productData.grade_level || [],
      subject: productData.subject || null,
      price_usd: productData.price_usd || 0,
      thumbnail_url: productData.thumbnail_url || null,
      file_url: productData.file_url || null,
      tpt_url: productData.tpt_url || null,
      tpt_id: productData.tpt_id || null,
      status: productData.status || 'draft',
      // Product Builder fields (Aj, 2026-07-19) -- optional, default to
      // empty so this insert still works for every other caller unchanged.
      instructions_text: productData.instructions_text ?? null,
      learning_contents: productData.learning_contents ?? [],
      style_selections: productData.style_selections ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all products for a user
 */
export async function getUserProducts(userId, options = {}, client = supabase) {
  let query = client
    .from('products')
    .select('*')
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
 * Get a single product by ID
 */
export async function getProduct(productId, userId, client = supabase) {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Update a product
 */
export async function updateProduct(productId, userId, updates, client = supabase) {
  const { data, error } = await client
    .from('products')
    .update({
      ...updates,
      updated_at: new Date(),
    })
    .eq('id', productId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a product
 */
export async function deleteProduct(productId, userId, client = supabase) {
  const { error } = await client
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Get products for a bundle
 */
export async function getBundleProducts(bundleId, client = supabase) {
  const { data, error } = await client
    .from('bundle_items')
    .select(`
      id,
      sort_order,
      products:product_id (*)
    `)
    .eq('bundle_id', bundleId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}
