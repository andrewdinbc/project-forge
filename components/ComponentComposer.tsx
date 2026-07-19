'use client';

import { useEffect, useRef, useState } from 'react';
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
  // 2026-07-19: content can come from a fetched URL too, not just the AI
  // instruction box -- reuses this exact same include/toggle/category
  // machinery rather than building a parallel set of state for it.
  source?: 'ai' | 'url';
  sourceUrl?: string;
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
  const [generatedFileUrl, setGeneratedFileUrl] = useState<string | null>(null); // for QR code after a successful generate
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

  // Live preview panel -- re-renders every time a toggle changes, so a
  // teacher can see exactly what removing a cover page, an extension
  // activity, etc. actually looks like before committing. Per Aj,
  // 2026-07-19: "I want to see what that looks like live." Debounced so
  // rapid toggling doesn't fire a request per click.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  // Parts Library -- tracks which items have already been starred this
  // session so the button can show "✓ Saved" instead of "☆ Save".
  const [savedToLibrary, setSavedToLibrary] = useState<Record<string, boolean>>({});
  const [savingToLibrary, setSavingToLibrary] = useState<Record<string, boolean>>({});

  // Parts Library as a SOURCE (Aj, 2026-07-19): "I want to take one or
  // multiple choice products and use my parts library with it." A third
  // input alongside tagged product pages and AI-generated content --
  // saved components, palettes, generated-set art, Smart-Erased pages,
  // Asset/Font Modifier exports, etc. Each gets assigned a target category
  // so it lands in the right spot in the assembled document.
  const [libraryItems, setLibraryItems] = useState<{ id: string; title: string; file_url: string; category: string | null }[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryCategoryPick, setLibraryCategoryPick] = useState<Record<string, string>>({});
  const [includedLibrary, setIncludedLibrary] = useState<Record<string, boolean>>({});

  // Composer "From URL" (Aj, 2026-07-19): "I also want to be able to call
  // on URL websites for this as well." Fetches a webpage's text and adds
  // it as a generatedItem with source:'url' -- reuses the exact same
  // include/toggle/category/render pipeline already built for AI-generated
  // content instead of a parallel implementation.
  const [urlInput, setUrlInput] = useState('');
  const [urlCategoryPick, setUrlCategoryPick] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null);
  async function handleFetchUrl() {
    if (!urlInput.trim() || !urlCategoryPick) return;
    setFetchingUrl(true);
    setUrlFetchError(null);
    try {
      const res = await fetch('/api/composer/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch that URL');
      const tempId = `url-${Date.now()}`;
      const item: GeneratedItem = {
        tempId, category: urlCategoryPick, label: data.title || data.url,
        content: data.text, source: 'url', sourceUrl: data.url,
      };
      setGeneratedItems((prev) => [...prev, item]);
      setIncludedGenerated((prev) => ({ ...prev, [tempId]: true }));
      setUrlInput('');
    } catch (e) {
      setUrlFetchError(e instanceof Error ? e.message : 'Failed to fetch that URL');
    } finally {
      setFetchingUrl(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLibraryLoading(true);
      try {
        const res = await fetch(`/api/library-parts?userId=${userId}`);
        const data = await res.json();
        setLibraryItems((data.parts || []).filter((p: any) => p.kind === 'image' && p.file_url));
      } catch (e) {
        console.error('Failed to load Parts Library:', e);
      } finally {
        setLibraryLoading(false);
      }
    })();
  }, [userId]);

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

  function libraryItemsFor(categoryKey: string) {
    return libraryItems.filter((p) => includedLibrary[p.id] && libraryCategoryPick[p.id] === categoryKey);
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

  // Builds the current selections into the same shape both /preview and
  // /generate expect.
  function buildSelectionsPayload() {
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
      .map((g) => ({ category: g.category, label: g.label, content: g.content, source: g.source, sourceUrl: g.sourceUrl }));
    const libraryParts = libraryItems
      .filter((p) => includedLibrary[p.id] && libraryCategoryPick[p.id])
      .map((p) => ({ category: libraryCategoryPick[p.id], fileUrl: p.file_url, title: p.title }));
    return { selections, generatedContent, libraryParts };
  }

  async function refreshPreview() {
    const { selections, generatedContent, libraryParts } = buildSelectionsPayload();
    const hasAnySelection = Object.values(selections).some((ids) => ids.length > 0) || generatedContent.length > 0 || libraryParts.length > 0;
    if (!hasAnySelection) {
      if (previewObjectUrlRef.current) {
        window.URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch('/api/composer/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, selections, generatedContent, libraryParts }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Preview failed');
      }
      const blob = await res.blob();
      if (previewObjectUrlRef.current) window.URL.revokeObjectURL(previewObjectUrlRef.current);
      const url = window.URL.createObjectURL(blob);
      previewObjectUrlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Failed to build preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  // Debounced live preview -- fires ~700ms after the last toggle change,
  // rather than on every single click, and cleans up its own blob URL.
  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => { refreshPreview(); }, 700);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(included), JSON.stringify(includedGenerated), JSON.stringify(includedLibrary), JSON.stringify(libraryCategoryPick)]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) window.URL.revokeObjectURL(previewObjectUrlRef.current);
    };
  }, []);

  // Parts Library -- stars an individual component or generated item for
  // reuse in future products, independent of which product it came from.
  async function saveToLibrary(key: string, payload: { kind: 'component' | 'resource'; sourceId: string; sourceProductId?: string; title: string; category?: string }) {
    setSavingToLibrary((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/library-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save to library');
      }
      setSavedToLibrary((prev) => ({ ...prev, [key]: true }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save to library');
    } finally {
      setSavingToLibrary((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function handleGenerate() {
    const { selections, generatedContent, libraryParts } = buildSelectionsPayload();
    const hasAnySelection = Object.values(selections).some((ids) => ids.length > 0) || generatedContent.length > 0 || libraryParts.length > 0;
    if (!hasAnySelection) {
      alert('Select at least one component to include.');
      return;
    }

    setGenerating(true);
    setResult(null);
    setGeneratedFileUrl(null);
    try {
      const res = await fetch('/api/composer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, productIds, selections, generatedContent, libraryParts }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
      const includedHeader = (res.headers.get('X-Included-Categories') || '').split(',').filter(Boolean);
      const skippedRaw = res.headers.get('X-Skipped-Categories');
      const skipped = skippedRaw ? decodeURIComponent(skippedRaw).split(' | ').filter(Boolean) : [];
      setResult({ included: includedHeader, skipped });

      // Completed hybrids are now saved as a real, standalone product with
      // a public file URL (see /api/composer/generate) -- this is what
      // makes a QR code possible. Best-effort: if the save failed
      // server-side, this header is just empty and no QR shows, but the
      // download below still succeeds either way.
      const rawFileUrl = res.headers.get('X-Generated-File-Url');
      if (rawFileUrl) setGeneratedFileUrl(decodeURIComponent(rawFileUrl));

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
    <div className="lg:flex lg:gap-6 lg:items-start">
    <div className="space-y-6 flex-1 min-w-0">
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

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-800">📦 From Parts Library</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          Pull in saved components, palettes, generated sets, Smart-Erased pages, or Asset/Font
          Modifier exports -- pick where each one belongs and it's rendered as its own page in
          that spot in the assembled document.
        </p>
        {libraryLoading ? (
          <p className="text-xs text-slate-400">Loading your Parts Library…</p>
        ) : libraryItems.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            Nothing in your Parts Library yet -- save something from Style Lab, Composer, or the
            Asset/Font Modifier first.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {libraryItems.map((p) => {
              const isOn = !!includedLibrary[p.id];
              return (
                <div key={p.id} className="flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-2">
                  <img src={p.file_url} alt={p.title} className="w-10 h-10 object-cover rounded border border-slate-100 shrink-0" />
                  <p className="text-xs font-medium text-slate-800 truncate flex-1 min-w-0">{p.title}</p>
                  <select
                    value={libraryCategoryPick[p.id] || ''}
                    onChange={(e) => setLibraryCategoryPick((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="text-xs border border-slate-300 rounded px-2 py-1 max-w-[160px]"
                  >
                    <option value="">Choose category…</option>
                    {CATEGORY_GROUPS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.categories.map((cat) => (
                          <option key={cat.key} value={cat.key}>{cat.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    disabled={!libraryCategoryPick[p.id]}
                    title={libraryCategoryPick[p.id] ? undefined : 'Pick a category first'}
                    onClick={() => setIncludedLibrary((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-30 ${
                      isOn ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-800">🌐 From URL</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          Paste a webpage and it'll pull the readable text out, then render it as its own page in
          whichever category you assign -- a real ideas/format source, same as tagged product
          pages, not something written up by AI.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/some-teaching-idea"
            disabled={fetchingUrl}
            className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={urlCategoryPick}
            onChange={(e) => setUrlCategoryPick(e.target.value)}
            disabled={fetchingUrl}
            className="text-sm border border-slate-300 rounded-lg px-2 py-2 max-w-[200px]"
          >
            <option value="">Choose category…</option>
            {CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.categories.map((cat) => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={handleFetchUrl}
            disabled={fetchingUrl || !urlInput.trim() || !urlCategoryPick}
            className="btn-primary px-4 py-2 text-sm whitespace-nowrap disabled:opacity-50"
          >
            {fetchingUrl ? 'Fetching…' : 'Fetch & Add'}
          </button>
        </div>
        {urlFetchError && <p className="text-xs text-red-600 mt-2">{urlFetchError}</p>}
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
              const libItems = libraryItemsFor(cat.key);

              return (
                <div key={cat.key}>
                  <span className="text-sm font-medium text-slate-800">{cat.label}</span>
                  {items.length === 0 && genItems.length === 0 && libItems.length === 0 ? (
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
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                title={savedToLibrary[`component:${item.id}`] ? 'Saved to Parts Library' : 'Save to Parts Library'}
                                disabled={!!savingToLibrary[`component:${item.id}`]}
                                onClick={() => saveToLibrary(`component:${item.id}`, {
                                  kind: 'component',
                                  sourceId: item.id,
                                  sourceProductId: item.products?.id,
                                  title: item.label || cat.label,
                                  category: cat.key,
                                })}
                                className="text-sm leading-none"
                              >
                                {savedToLibrary[`component:${item.id}`] ? '⭐' : '☆'}
                              </button>
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
                          </div>
                        );
                      })}
                      {genItems.map((item) => {
                        const isOn = !!includedGenerated[item.tempId];
                        const isExpanded = !!expandedGenerated[item.tempId];
                        const isUrl = item.source === 'url';
                        return (
                          <div
                            key={item.tempId}
                            className={`rounded-lg px-3 py-2 border ${isUrl ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate flex items-center gap-2">
                                  {item.label}
                                  {isUrl ? (
                                    <span className="text-[9px] font-semibold text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                      🌐 From URL
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-purple-700 bg-purple-100 border border-purple-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                      ✨ AI-generated
                                    </span>
                                  )}
                                </p>
                                {isUrl && item.sourceUrl && (
                                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 underline block truncate max-w-xs">
                                    {item.sourceUrl}
                                  </a>
                                )}
                                <button
                                  onClick={() => setExpandedGenerated((prev) => ({ ...prev, [item.tempId]: !prev[item.tempId] }))}
                                  className={`text-[10px] underline mt-0.5 ${isUrl ? 'text-blue-700' : 'text-purple-700'}`}
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
                      {libItems.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={p.file_url} alt={p.title} className="w-8 h-8 object-cover rounded border border-emerald-100 shrink-0" />
                            <p className="text-xs font-medium text-slate-800 truncate flex items-center gap-2">
                              {p.title}
                              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                📦 Parts Library
                              </span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIncludedLibrary((prev) => ({ ...prev, [p.id]: false }))}
                            className="text-[10px] text-slate-500 underline shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
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
            {generatedFileUrl && (
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(generatedFileUrl)}`}
                  alt="QR code for this hybrid product"
                  width={100}
                  height={100}
                  className="border border-slate-200 rounded"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">📱 Scan to open this product</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Also saved as a standalone product -- it's now on your Dashboard.
                  </p>
                  <a href={generatedFileUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline">
                    Open file directly ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    <div className="lg:w-96 lg:sticky lg:top-6 mt-6 lg:mt-0">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-800">👁 Live Preview</h3>
          {previewLoading && <span className="text-[10px] text-blue-600">Updating…</span>}
        </div>
        <p className="text-[11px] text-slate-500 mb-2">
          Updates automatically as you toggle items -- see exactly what removing a cover page,
          an extension activity, etc. looks like before generating.
        </p>
        <div className="border border-slate-200 rounded-lg bg-slate-50" style={{ height: 480 }}>
          {previewError && (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-xs text-red-600 text-center">{previewError}</p>
            </div>
          )}
          {!previewError && previewUrl && (
            <iframe src={previewUrl} title="Live preview" className="w-full h-full rounded-lg" />
          )}
          {!previewError && !previewUrl && (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-xs text-slate-400 text-center">
                {previewLoading ? 'Building preview…' : 'Toggle something on to see a live preview here.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
