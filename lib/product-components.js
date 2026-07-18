import { supabaseAdmin } from './supabase';

// Uses supabaseAdmin (service role, bypasses RLS) throughout -- every
// caller of this file is a server-side API route (verified 2026-07-18:
// grep shows only app/api/composer/* and app/api/products/[productId]/
// components/* import this), none of which forward the browser's user
// session/JWT to Supabase. Using the anon client here meant auth.uid()
// was always null server-side, so RLS silently blocked every read AND
// write through this whole file -- component tagging appeared to work
// but never actually persisted, and reads always came back empty. This
// wasn't a security hole (routes never used the anon client's RLS as
// real access control to begin with, since they never verified the
// caller matched the resource owner) -- switching to supabaseAdmin just
// makes it actually work; per-request ownership checks are a separate,
// still-open improvement.

/**
 * Add a tagged component (page range) to a product.
 */
export async function addComponent(productId, componentData) {
  const { data, error } = await supabaseAdmin
    .from('product_components')
    .insert({
      product_id: productId,
      category: componentData.category,
      label: componentData.label,
      page_start: componentData.page_start,
      page_end: componentData.page_end,
      notes: componentData.notes || null,
      sort_order: componentData.sort_order || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Add multiple tagged components at once -- used by the AI auto-tag
 * route so a whole document's worth of tags land in one round trip.
 */
export async function addComponents(productId, componentsData) {
  const { data, error } = await supabaseAdmin
    .from('product_components')
    .insert(
      componentsData.map((c) => ({
        product_id: productId,
        category: c.category,
        label: c.label,
        page_start: c.page_start,
        page_end: c.page_end,
        notes: c.notes || null,
        sort_order: c.sort_order || 0,
      }))
    )
    .select();

  if (error) throw error;
  return data || [];
}

/**
 * List all tagged components for a single product.
 */
export async function getProductComponents(productId) {
  const { data, error } = await supabaseAdmin
    .from('product_components')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * List tagged components across several products at once - what the
 * composer needs to build its per-category picker.
 */
export async function getComponentsForProducts(productIds) {
  if (!productIds || productIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('product_components')
    .select('*, products:product_id (id, title, file_url)')
    .in('product_id', productIds)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateComponent(componentId, updates) {
  const { data, error } = await supabaseAdmin
    .from('product_components')
    .update(updates)
    .eq('id', componentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComponent(componentId) {
  const { error } = await supabaseAdmin
    .from('product_components')
    .delete()
    .eq('id', componentId);

  if (error) throw error;
}

/**
 * Delete all tagged components for a product -- used before re-running
 * AI auto-tag so re-tagging doesn't just pile duplicates on top of a
 * previous pass.
 */
export async function deleteAllComponentsForProduct(productId) {
  const { error } = await supabaseAdmin
    .from('product_components')
    .delete()
    .eq('product_id', productId);

  if (error) throw error;
}

/**
 * Record a hybrid product composition for history/provenance.
 */
export async function createHybridProduct(userId, hybridData) {
  const { data, error } = await supabaseAdmin
    .from('hybrid_products')
    .insert({
      user_id: userId,
      title: hybridData.title,
      source_product_ids: hybridData.source_product_ids,
      selections: hybridData.selections,
      generated_product_id: hybridData.generated_product_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserHybridProducts(userId) {
  const { data, error } = await supabaseAdmin
    .from('hybrid_products')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
