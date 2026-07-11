'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getUserProducts } from '@/lib/products';
import ComponentComposer from '@/components/ComponentComposer';

export default function ComposerPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        setUserId(user.id);
        const data = await getUserProducts(user.id);
        setProducts(data.filter((p: any) => p.file_url)); // only products with an actual PDF can be tagged/composed
      } catch (e) {
        console.error('Failed to load products:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const productTitles = Object.fromEntries(products.map((p) => [p.id, p.title]));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading products…</p>
        </div>
      </div>
    );
  }

  if (showComposer && userId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">🧬 Component Composer</h1>
            <p className="text-slate-600 mt-1">
              Mixing: {selectedIds.map((id) => productTitles[id]).join(' + ')}
            </p>
          </div>
          <button
            onClick={() => setShowComposer(false)}
            className="text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            ← Change products
          </button>
        </div>
        <ComponentComposer userId={userId} productIds={selectedIds} productTitles={productTitles} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">🧬 Component Composer</h1>
        <p className="text-slate-600 mt-1">
          Pick 2 or more products, then mix and match their structural components (cover pages,
          answer keys, instructions, etc.) into a new hybrid product.
        </p>
      </div>

      {products.length < 2 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🧬</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Need at least 2 products</h2>
          <p className="text-slate-600">
            Upload a PDF file to two or more products and tag their components before composing.
          </p>
        </div>
      ) : (
        <>
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Select source products</h3>
            <div className="space-y-2">
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{p.title}</p>
                    {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowComposer(true)}
            disabled={selectedIds.length < 2}
            className="btn-primary px-6 py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue with {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} →
          </button>
        </>
      )}
    </div>
  );
}
