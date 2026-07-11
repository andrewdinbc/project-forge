import { supabase } from './supabase';

/**
 * Add a tagged component (page range) to a product.
 */
export async function addComponent(productId, componentData) {
  const { data, error } = await supabase
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
 * List all tagged components for a single product.
 */
export async function getProductComponents(productId) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('product_components')
    .select('*, products:product_id (id, title, file_url)')
    .in('product_id', productIds)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateComponent(componentId, updates) {
  const { data, error } = await supabase
    .from('product_components')
    .update(updates)
    .eq('id', componentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComponent(componentId) {
  const { error } = await supabase
    .from('product_components')
    .delete()
    .eq('id', componentId);

  if (error) throw error;
}

/**
 * Record a hybrid product composition for history/provenance.
 */
export async function createHybridProduct(userId, hybridData) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('hybrid_products')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
