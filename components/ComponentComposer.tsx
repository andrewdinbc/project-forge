'use client';

import { useEffect, useState } from 'react';
import { CATEGORY_GROUPS } from '@/lib/component-categories';

interface ComponentOption {
  id: string;
  category: string;
  label: string;
  notes: string | null;
  page_start: number;
  page_end: number;
  products: { id: string; title: string; file_url: string | null };
}

interface GeneratedItem {
  tempId: string;
  category: string;
  label: string;
  content: string;
}

interface Props {
  userId: string;
  productIds: string[];
  productTitles: Record<string, string>;
}

export default function ComponentComposer({ userId, productIds, productTitles }: Props) {
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-component include/exclude -- each tagged item toggles independently,
  // so multiple items in the same category (even from different products)
  // can be included at once instead of competing for one slot.
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState('Hybrid Product');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ included: string[]; skipped: string[] } | null>(null);
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagProgress, setAutoTagProgress] = useState<string | null>(null);
  const [autoTagErrors, setAutoTagErrors] = useState<string[]>([]);

  // AI keyword instruction box.
  const [instruction, setInstruction] = useState('');
  const [applyingInstruction, setApplyingInstruction] = useState(false);
  const [instructionError, setInstructionError] = useState<string | null>(null);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);

  // AI-generated content that fills a genuine gap the AI couldn't fulfill
  // from existing tagged pages (e.g. no Force and Motion color-by-number
  // exists, so it wrote one grounded in the tagged Force and Motion
  // material). Not real source pages -- rendered fresh onto new pages at
  // generate time. Kept separate from `components` since these have no
  // database row, only a client-side tempId.
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [includedGenerated, setIncludedGenerated] = useState<Record<string, boolean>>({});
  const [expandedGenerated, setExpandedGenerated] = useState<Record<string, boolean>>({});

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
  // component list so freshly-tagged pages show up without leaving this
  // screen. Products with no tagged categories yet are the common case
  // this unblocks -- previously you had to go tag each one on its own
  // product page first.
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

  function componentsFor(categoryKey: string) {
    return components.filter((c) => c.category === categoryKey);
  }

  function generatedFor(categoryKey: string) {
    return generatedItems.filter((g) => g.category === categoryKey);
  }

  function toggle(componentId: string) {
    setIncluded((prev) => ({ ...prev, [componentId]: !prev[componentId] }));
  }

  function toggleGenerated(tempId: string) {
    setIncludedGenerated((prev) => ({ ...prev, [tempId]: !prev[tempId] }));
  }

  // Sends the freeform instruction + full component list to the AI, which
  // returns include/exclude decisions for existing items it has an
  // opinion on, PLUS newly-written content for any genuine gap it
  // couldn't fill from existing tagged pages (e.g. "make a color by
  // number of the Force and Motion content" when no such page exists --
  // the AI writes one, grounded in the actual tagged Force and Motion
  // material, instead of substituting something unrelated or giving up).
  // Anything the AI doesn't mention among existing components is left
  // exactly as the teacher already had it.
  async function handleApplyInstruction() {
    if (!instruction.trim()) return;
    setApplyingInstruction(true);
    setInstructionError(null);
    setLastReasoning(null);
    try {
      const componentSummaries = components.map((c) => ({
        id: c.id,
        category: c.category,
        categoryLabel: CATEGORY_GROUPS.flatMap((g) => g.categories).find((cat) => cat.key === c.category)?.label || c.category,
        label: c.label,
        notes: c.notes,
        productTitle: c.products?.title || productTitles[c.products?.id] || 'Unknown product',
      }));

      const res = await fetch('/api/composer/apply-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, components: componentSummaries }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to apply instruction');
      }
      const data = await res.json();
      setIncluded((prev) => {
        const next = { ...prev };
        for (const id of data.include || []) next[id] = true;
        for (const id of data.exclude || []) next[id] = false;
        return next;
      });

      const newGenerated: GeneratedItem[] = data.generated || [];
      if (newGenerated.length > 0) {
        setGeneratedItems((prev) => [...prev, ...newGenerated]);
        setIncludedGenerated((prev) => {
          const next = { ...prev };
          for (const g of newGenerated) next[g.tempId] = true;
          return next;
        });
      }

      setLastReasoning(data.reasoning || null);
    } catch (e) {
      setInstructionError(e instanceof Error ? e.message : 'Failed to apply instruction');
    } finally {
      setApplyingInstruction(false);
    }
  }

  async function handleGenerate() {
    const selections: Record<string, string[]> = {};
    for (const group of CATEGORY_GROUPS) {
      for (const cat of group.categories) {
        const ids = componentsFor(cat.key)
          .filter((c) => included[c.id])
          .map((c) => c.id);
        if (ids.length > 0) selections[cat.key] = ids;
      }
    }

    const generatedContent = generatedItems
      .filter((g) => includedGenerated[g.tempId])
      .map((g) => ({ category: g.category, label: g.label, content: g.content }));

    const hasAnySelection = Object.values(selections).some((ids) => ids.length > 0) || generatedContent.length > 0;
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
        body: JSON.stringify({ userId, title, productIds, selections, generatedContent }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
      const includedHeader = (res.headers.get('X-Included-Categories') || '').split(',').filter(Boolean);
      const skippedRaw = res.headers.get('X-Skipped-Categories');
      const skipped = skippedRaw ? decodeURIComponent(skippedRaw).split(' | ').filter(Boolean) : [];
      setResult({ included: includedHeader, skipped });

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
              Missing options below? Re-scan all {productIds.length} selected products' PDFs and
              auto-tag their components.
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

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-800">💬 Tell the AI what you want</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          Describe what to include in plain language, e.g. "I like the interactive notebook
          aspects of Force and Motion, apply that to Human Body Systems." The AI will flip the
          relevant toggles below. If what you ask for doesn't exist among your tagged pages, it
          will write new content to fill that gap instead of substituting something unrelated --
          grounded in your actual tagged material, shown below with an AI-generated badge so you
          can review it before including it.
        </p>
        <div className="flex gap-2">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="e.g. Make a color by number out of the Force and Motion content"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            onClick={handleApplyInstruction}
            disabled={applyingInstruction || !instruction.trim()}
            className="btn-primary px-4 py-2 text-sm whitespace-nowrap self-start disabled:opacity-50"
          >
            {applyingInstruction ? 'Thinking…' : 'Apply'}
          </button>
        </div>
        {lastReasoning && (
          <p className="text-xs text-green-700 mt-2">✓ {lastReasoning}</p>
        )}
        {instructionError && (
          <p className="text-xs text-red-600 mt-2">{instructionError}</p>
        )}
      </div>

      {CATEGORY_GROUPS.map((group) => (
        <div key={group.group} className="card p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {group.icon} {group.group}
          </h3>
          <div className="space-y-5">
            {group.categories.map((cat) => {
              const items = componentsFor(cat.key);
              const genItems = generatedFor(cat.key);

              return (
                <div key={cat.key}>
                  <span className="text-sm font-medium text-slate-800">{cat.label}</span>
                  {items.length === 0 && genItems.length === 0 ? (
                    <p className="text-xs text-slate-400 italic mt-1">
                      None of the selected products have this tagged.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {items.map((item) => {
                        const isOn = !!included[item.id];
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">
                                {item.products?.title || productTitles[item.products?.id]}
                                {item.label && item.label !== cat.label ? ` — ${item.label}` : ''}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                pages {item.page_start}–{item.page_end}
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isOn}
                              onClick={() => toggle(item.id)}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                isOn ? 'bg-blue-600' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  isOn ? 'translate-x-4' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                      {genItems.map((item) => {
                        const isOn = !!includedGenerated[item.tempId];
                        const isExpanded = !!expandedGenerated[item.tempId];
                        return (
                          <div
                            key={item.tempId}
                            className="border border-purple-200 bg-purple-50 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate flex items-center gap-2">
                                  {item.label}
                                  <span className="text-[9px] font-semibold text-purple-700 bg-purple-100 border border-purple-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                    ✨ AI-generated
                                  </span>
                                </p>
                                <button
                                  onClick={() => setExpandedGenerated((prev) => ({ ...prev, [item.tempId]: !prev[item.tempId] }))}
                                  className="text-[10px] text-purple-700 underline mt-0.5"
                                >
                                  {isExpanded ? 'Hide preview' : 'Preview content'}
                                </button>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isOn}
                                onClick={() => toggleGenerated(item.tempId)}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                  isOn ? 'bg-purple-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    isOn ? 'translate-x-4' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {isExpanded && (
                              <pre className="mt-2 text-[11px] text-slate-700 whitespace-pre-wrap bg-white border border-purple-100 rounded p-2 max-h-64 overflow-auto">
                                {item.content}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
