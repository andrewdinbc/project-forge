'use client';

import { useEffect, useState } from 'react';
import { CATEGORY_GROUPS } from '@/lib/component-categories';

interface ComponentOption {
  id: string;
  category: string;
  label: string;
  page_start: number;
  page_end: number;
  products: { id: string; title: string; file_url: string | null };
}

interface Props {
  userId: string;
  productIds: string[];
  productTitles: Record<string, string>;
}

export default function ComponentComposer({ userId, productIds, productTitles }: Props) {
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-category slider position: index into that category's options array
  // (0 = Exclude, 1..n = one of the tagged source products).
  const [sliderIndex, setSliderIndex] = useState<Record<string, number>>({});
  const [title, setTitle] = useState('Hybrid Product');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ included: string[]; skipped: string[] } | null>(null);
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagProgress, setAutoTagProgress] = useState<string | null>(null);
  const [autoTagErrors, setAutoTagErrors] = useState<string[]>([]);

  async function loadComponents() {
    setLoading(true);
    try {
      const res = await fetch(`/api/composer/components?productIds=${productIds.join(',')}`);
      const data = await res.json();
      setComponents(data.components || []);
    } catch (e) {
      console.error('Failed to load components:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (productIds.length > 0) loadComponents();
  }, [productIds.join(',')]);

  // Runs AI auto-tag (POST /api/products/[productId]/auto-tag) for every
  // selected source product, one at a time, then reloads the composer's
  // component list so freshly-tagged pages show up on the sliders without
  // leaving this screen. Products with no tagged categories yet are the
  // common case this unblocks -- previously you had to go tag each one on
  // its own product page first.
  async function handleAutoTagAll() {
    setAutoTagging(true);
    setAutoTagErrors([]);
    const errors: string[] = [];
    for (let i = 0; i < productIds.length; i++) {
      const id = productIds[i];
      setAutoTagProgress(`Tagging "${productTitles[id] || id}" (${i + 1}/${productIds.length})…`);
      try {
        const res = await fetch(`/api/products/${id}/auto-tag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          errors.push(`${productTitles[id] || id}: ${err.error || res.status}`);
        }
      } catch (e) {
        errors.push(`${productTitles[id] || id}: ${e instanceof Error ? e.message : 'request failed'}`);
      }
    }
    setAutoTagProgress(null);
    setAutoTagErrors(errors);
    setAutoTagging(false);
    await loadComponents();
  }

  function optionsFor(categoryKey: string) {
    const opts = components.filter((c) => c.category === categoryKey);
    // "Exclude" is always position 0.
    return [{ id: null as string | null, label: 'Exclude', products: null as any }, ...opts];
  }

  function currentSelection(categoryKey: string) {
    const opts = optionsFor(categoryKey);
    const idx = sliderIndex[categoryKey] ?? 0;
    return opts[Math.min(idx, opts.length - 1)];
  }

  async function handleGenerate() {
    const selections: Record<string, string | null> = {};
    for (const group of CATEGORY_GROUPS) {
      for (const cat of group.categories) {
        const sel = currentSelection(cat.key);
        if (sel) selections[cat.key] = sel.id;
      }
    }

    const hasAnySelection = Object.values(selections).some((v) => v !== null && v !== undefined);
    if (!hasAnySelection) {
      alert('Select at least one component to include.');
      return;
    }

    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/composer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, productIds, selections }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
      const included = (res.headers.get('X-Included-Categories') || '').split(',').filter(Boolean);
      const skippedRaw = res.headers.get('X-Skipped-Categories');
      const skipped = skippedRaw ? decodeURIComponent(skippedRaw).split(' | ').filter(Boolean) : [];
      setResult({ included, skipped });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-')}-hybrid.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate hybrid product');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading tagged components…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <label className="block text-xs font-semibold text-slate-700 mb-1">Hybrid Product Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm max-w-md"
        />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">🤖 AI Auto-Tag</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Missing options on the sliders below? Re-scan all {productIds.length} selected
              products' PDFs and auto-tag their components.
            </p>
          </div>
          <button
            onClick={handleAutoTagAll}
            disabled={autoTagging}
            className="btn-primary px-4 py-2 text-sm whitespace-nowrap disabled:opacity-50"
          >
            {autoTagging ? 'Tagging…' : 'Auto-Tag All with AI'}
          </button>
        </div>
        {autoTagProgress && (
          <p className="text-xs text-blue-600 mt-3">{autoTagProgress}</p>
        )}
        {!autoTagging && autoTagErrors.length > 0 && (
          <div className="mt-3 text-xs text-red-600">
            <p className="font-medium">Some products couldn't be tagged:</p>
            <ul className="list-disc list-inside">
              {autoTagErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {CATEGORY_GROUPS.map((group) => (
        <div key={group.group} className="card p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {group.icon} {group.group}
          </h3>
          <div className="space-y-5">
            {group.categories.map((cat) => {
              const opts = optionsFor(cat.key);
              const hasOptions = opts.length > 1; // more than just "Exclude"
              const idx = sliderIndex[cat.key] ?? 0;
              const current = opts[Math.min(idx, opts.length - 1)];

              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">{cat.label}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        !current?.id
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {current?.id ? productTitles[current.products.id] || current.products.title : 'Excluded'}
                    </span>
                  </div>
                  {hasOptions ? (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={opts.length - 1}
                        step={1}
                        value={idx}
                        onChange={(e) =>
                          setSliderIndex({ ...sliderIndex, [cat.key]: parseInt(e.target.value) })
                        }
                        className="w-full accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        {opts.map((o, i) => (
                          <span key={i} className={i === idx ? 'text-blue-600 font-semibold' : ''}>
                            {o.label === 'Exclude' ? 'Exclude' : (o.products?.title || '').slice(0, 14)}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      None of the selected products have this tagged.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="card p-6">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary px-6 py-3 text-base"
        >
          {generating ? 'Assembling PDF…' : '🧬 Generate Hybrid Product'}
        </button>

        {result && (
          <div className="mt-4 text-sm">
            {result.included.length > 0 && (
              <p className="text-green-700">✓ Included: {result.included.join(', ')}</p>
            )}
            {result.skipped.length > 0 && (
              <div className="text-amber-600 mt-1">
                <p className="font-medium">Skipped:</p>
                <ul className="list-disc list-inside">
                  {result.skipped.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
