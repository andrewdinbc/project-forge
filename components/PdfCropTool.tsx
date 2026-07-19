'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  userId: string;
  productId: string;
  productTitle: string;
}

// Step 2 of "disassemble a PDF to reuse the parts I like" (Aj,
// 2026-07-19). Renders a page as an actual image and lets you draw a box
// around anything -- a diagram, a single question, vector art -- then
// saves that exact region as a standalone image to the Parts Library.
// Complements step 1 (Extract Images on the product page, which pulls out
// discrete embedded images automatically) by covering everything that
// ISN'T a clean embedded image object. The tradeoff: a crop is a
// flattened picture of that region, not editable/reusable vector content.
const RENDER_SCALE = 1.5; // must match the value sent to both render-page and crop-page

export default function PdfCropTool({ userId, productId, productTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  async function loadPage(page: number) {
    setLoadingPage(true);
    setPageError(null);
    setSelStart(null);
    setSelEnd(null);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const res = await fetch(`/api/products/${productId}/render-page?userId=${userId}&page=${page}&scale=${RENDER_SCALE}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to render page');
      }
      const countHeader = res.headers.get('X-Page-Count');
      if (countHeader) setPageCount(parseInt(countHeader, 10));
      const blob = await res.blob();
      if (objectUrlRef.current) window.URL.revokeObjectURL(objectUrlRef.current);
      const url = window.URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setImageUrl(url);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Failed to render page');
    } finally {
      setLoadingPage(false);
    }
  }

  useEffect(() => {
    if (open) loadPage(pageNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pageNum]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) window.URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function getRelativePos(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent) {
    const pos = getRelativePos(e);
    setSelecting(true);
    setSelStart(pos);
    setSelEnd(pos);
    setSaveMessage(null);
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!selecting) return;
    setSelEnd(getRelativePos(e));
  }
  function handleMouseUp() {
    setSelecting(false);
  }

  function selectionRect() {
    if (!selStart || !selEnd) return null;
    const left = Math.min(selStart.x, selEnd.x);
    const top = Math.min(selStart.y, selEnd.y);
    const width = Math.abs(selEnd.x - selStart.x);
    const height = Math.abs(selEnd.y - selStart.y);
    return { left, top, width, height };
  }

  async function saveCrop() {
    const rect = selectionRect();
    const img = imgRef.current;
    if (!rect || !img || rect.width < 8 || rect.height < 8) {
      setSaveError('Draw a box around what you want to save first.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      // Translate on-screen selection (CSS display pixels) into the
      // rendered PNG's actual pixel space, since the displayed <img> may
      // be scaled down to fit the container.
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;

      const res = await fetch(`/api/products/${productId}/crop-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, page: pageNum, scale: RENDER_SCALE,
          x: rect.left * scaleX, y: rect.top * scaleY,
          width: rect.width * scaleX, height: rect.height * scaleY,
          title: `${productTitle} -- page ${pageNum} crop`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save crop');
      setSaveMessage('✓ Saved to your Parts Library.');
      setSelStart(null);
      setSelEnd(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save crop');
    } finally {
      setSaving(false);
    }
  }

  const rect = selectionRect();

  if (!open) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-200">
        <button onClick={() => setOpen(true)} className="btn-primary">
          ✂️ Crop from Page
        </button>
        <p className="text-xs text-slate-500 mt-1">
          Renders any page as an image and lets you draw a box around a diagram, a single question,
          or vector art -- anything that isn't a discrete embedded image (that's "Extract Images"
          above). Saves the exact region as a standalone image to your Parts Library.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-800">✂️ Crop from Page</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">
          Close
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          disabled={pageNum <= 1 || loadingPage}
          className="px-2 py-1 text-xs border border-slate-300 rounded disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-xs text-slate-600">
          Page {pageNum}{pageCount ? ` of ${pageCount}` : ''}
        </span>
        <button
          onClick={() => setPageNum((p) => (pageCount ? Math.min(pageCount, p + 1) : p + 1))}
          disabled={loadingPage || (pageCount !== null && pageNum >= pageCount)}
          className="px-2 py-1 text-xs border border-slate-300 rounded disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      {pageError && <p className="text-xs text-red-600 mb-2">{pageError}</p>}

      {loadingPage && <p className="text-xs text-slate-500">Rendering page…</p>}

      {!loadingPage && imageUrl && (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ position: 'relative', display: 'inline-block', cursor: 'crosshair', maxWidth: '100%' }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt={`Page ${pageNum}`}
            draggable={false}
            style={{ display: 'block', maxWidth: '100%', height: 'auto', userSelect: 'none' }}
          />
          {rect && (
            <div
              style={{
                position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
                border: '2px dashed #2563eb', background: 'rgba(37, 99, 235, 0.15)', pointerEvents: 'none',
              }}
            />
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={saveCrop}
          disabled={saving || !rect || rect.width < 8 || rect.height < 8}
          className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : '💾 Save This Crop'}
        </button>
        {saveMessage && <span className="text-xs text-green-700">{saveMessage}</span>}
        {saveError && <span className="text-xs text-red-600">{saveError}</span>}
      </div>
    </div>
  );
}
