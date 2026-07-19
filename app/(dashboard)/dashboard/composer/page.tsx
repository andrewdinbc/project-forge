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
          Pick one or more products, then mix and match their structural components (cover pages,
          answer keys, instructions, etc.) -- plus anything from your Parts Library -- into a new
          hybrid product.
        </p>
        <div className="card p-4 mt-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">What this actually does:</span> Composer works with the
            real PDFs already on your Dashboard, plus items you've saved to your Parts Library.
            First, each source product needs its pages tagged
            by section (cover page, answer keys, teacher instructions, extension activities, etc.) —
            either manually on the product's own page, or automatically with the "Auto-Tag All with
            AI" button once you've selected products below. Once tagged, every source product's
            sections show up here as individual toggles, grouped by category. Flip on whichever
            pages you want — you can mix pages from several different products (or just one), and
            even include multiple items from the same category (e.g. two different answer-key
            sections). Separately, anything in your Parts Library (saved components, palettes,
            generated sets, Asset/Font Modifier exports) can be assigned to a category and pulled
            in as its own page too. You can also describe what you want in plain language (e.g.
            "use the interactive notebook pages from Force and Motion") and the AI will set the
            toggles for you. When you hit Generate, Composer copies the actual selected pages out of
            the real source PDFs, renders in your Parts Library picks, and stitches everything into
            one new downloadable hybrid PDF, in a sensible front-matter → instruction →
            classroom-materials order.
          </p>
        </div>
      </div>

      {products.length < 1 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🧬</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Need at least 1 product</h2>
          <p className="text-slate-600">
            Upload a PDF file to a product and tag its components before composing.
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
            disabled={selectedIds.length < 1}
            className="btn-primary px-6 py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue with {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} →
          </button>
        </>
      )}
    </div>
  );
}
