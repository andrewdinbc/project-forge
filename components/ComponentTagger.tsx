'use client';

import { useEffect, useState } from 'react';
import { CATEGORY_GROUPS } from '@/lib/component-categories';
import { errorMessageOr } from '@/lib/error-message';

interface Component {
  id: string;
  category: string;
  label: string;
  page_start: number;
  page_end: number;
  notes?: string;
}

export default function ComponentTagger({ productId }: { productId: string }) {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: '', label: '', page_start: '', page_end: '', notes: '' });

  useEffect(() => {
    loadComponents();
  }, [productId]);

  async function loadComponents() {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/components`);
      const data = await res.json();
      setComponents(data.components || []);
    } catch (e) {
      console.error('Failed to load components:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleCategoryChange(categoryKey: string) {
    const cat = CATEGORY_GROUPS.flatMap((g) => g.categories).find((c) => c.key === categoryKey);
    setForm({ ...form, category: categoryKey, label: cat?.label || '' });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.page_start || !form.page_end) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          label: form.label,
          page_start: parseInt(form.page_start),
          page_end: parseInt(form.page_end),
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setForm({ category: '', label: '', page_start: '', page_end: '', notes: '' });
      await loadComponents();
    } catch (e) {
      alert(errorMessageOr(e, 'Failed to add component'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(componentId: string) {
    if (!confirm('Remove this tagged component?')) return;
    try {
      await fetch(`/api/products/${productId}/components/${componentId}`, { method: 'DELETE' });
      await loadComponents();
    } catch (e) {
      console.error('Failed to delete component:', e);
    }
  }

  const taggedCategories = new Set(components.map((c) => c.category));

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Tag Components</h3>
        <p className="text-sm text-slate-600 mb-4">
          Mark which page ranges of this product's PDF correspond to each structural component.
          Tagged pieces become available in the Composer for mixing into hybrid products.
        </p>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            >
              <option value="">Select a category…</option>
              {CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.group} label={`${group.icon} ${group.group}`}>
                  {group.categories.map((c) => (
                    <option key={c.key} value={c.key} disabled={taggedCategories.has(c.key)}>
                      {c.label}{taggedCategories.has(c.key) ? ' (already tagged)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start page</label>
            <input
              type="number"
              min="1"
              value={form.page_start}
              onChange={(e) => setForm({ ...form, page_start: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End page</label>
            <input
              type="number"
              min="1"
              value={form.page_end}
              onChange={(e) => setForm({ ...form, page_end: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="md:col-span-4">
            <button type="submit" disabled={saving} className="btn-primary text-sm px-4 py-2">
              {saving ? 'Adding…' : '+ Tag Component'}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Tagged Components ({components.length})</h3>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : components.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No components tagged yet.</p>
        ) : (
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{c.label}</p>
                  <p className="text-xs text-slate-500">
                    Pages {c.page_start}–{c.page_end}{c.notes ? ` · ${c.notes}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
