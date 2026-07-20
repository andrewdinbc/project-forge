'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

// Asset Modifier (Aj, 2026-07-19): "This is where I want to be able to take
// literal assets and modify them to make them my own." Replaces the old
// per-resource "Push to AI Steering" / "Mark for TPT" buttons in Style Lab,
// and is also reachable from any image in the Parts Library.
//
// THIS IS PHASE 1 of a genuinely large build, built and shipped honestly as
// a real working foundation rather than a shallow pass at everything on the
// CorelDRAW/Illustrator tool list Aj sent. Included now:
//   - Selection/transform (move, resize, rotate -- native to every object)
//   - Shapes: rectangle, ellipse, polygon(star), line
//   - Freehand draw (pencil brush)
//   - Text (editable, click to place)
//   - Fill: solid or 2-stop linear gradient; stroke color/width; opacity
//   - Drop shadow toggle
//   - Eyedropper (click canvas to sample a color)
//   - Crop (draw a rect, apply -- flattens canvas to that region)
//   - Zoom in/out/reset, layer order (front/back), duplicate, delete
//   - Undo/redo (snapshot-based)
//   - AI instruction box -- free text, sends the current canvas to FLUX
//     Kontext for an AI edit, replaces canvas with the result (undo-able)
//   - Save as Asset -- exports to Parts Library
//
// Explicitly NOT in Phase 1 (real complexity, staged for later rounds, not
// half-built here): true bezier pen tool + per-anchor node editing,
// Pathfinder boolean ops (trim/weld/intersect/exclude), knife/scissors,
// envelope/distort (warp/pucker/twirl), mesh gradients, calligraphic/
// scatter/pattern brush engines, text-on-path, blend/tween, symbol sprayer,
// dimension/connector tools. Flag which of these you actually want next and
// they can be built properly rather than bolted on.

const CATEGORY_BADGE_LABELS = {
  border: '🖼 Border', section_header: '📑 Section Header', font: '🔤 Font', icon_illustration: '🎨 Icon & Illustration', color_palette: '🌈 Color Palette',
};

function AssetModifierInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialAssetUrl = searchParams.get('assetUrl') || '';
  const initialTitle = searchParams.get('title') || 'Modified asset';
  const sourcePartId = searchParams.get('sourcePartId') || null;
  // Product Builder (Aj, 2026-07-19): "Border/Section Header/Font/Icon &
  // Illustration editors" -- all this same Asset Modifier, launched with a
  // category hint so Save goes into the right Parts Library slot.
  const incomingCategory = searchParams.get('category') || null;
  const initialTool = searchParams.get('tool') || 'select';
  const initialFontFamily = searchParams.get('fontFamily') || '';
  // Handoff from Style Lab's AI Instruction Removal box (Aj, 2026-07-19):
  // instructions that aren't removals (e.g. "add a border") route here
  // instead, pre-filled and ready to run -- this is "the modifier" that
  // knows how to actually add/change things, not just erase.
  const initialAiInstruction = searchParams.get('aiInstruction') || '';

  const [userId, setUserId] = useState(null);
  const canvasElRef = useRef(null);
  const fCanvasRef = useRef(null);
  const fabricRef = useRef(null); // dynamically-imported fabric module
  const toolRef = useRef(initialTool);
  const drawStateRef = useRef(null); // in-progress shape being drag-created
  const historyRef = useRef({ stack: [], index: -1, suppress: false });
  const loadedFontsRef = useRef(new Set()); // font family names already injected

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState(initialTool);
  const [selected, setSelected] = useState(null); // lightweight props snapshot
  const [fillColor, setFillColor] = useState('#2f6b41');
  const [useGradient, setUseGradient] = useState(false);
  const [gradientColor2, setGradientColor2] = useState('#ffffff');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [shadow, setShadow] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const [savedPart, setSavedPart] = useState(null); // Aj, 2026-07-19: "make 10 varieties" -- needs the just-saved part's id + category
  const [varietyPrompt, setVarietyPrompt] = useState('');
  const [varietyCount, setVarietyCount] = useState(10);
  const [generatingVarieties, setGeneratingVarieties] = useState(false);
  const [varietyMsg, setVarietyMsg] = useState(null);
  const [aiInstruction, setAiInstruction] = useState(initialAiInstruction);
  const [applyingAI, setApplyingAI] = useState(false);
  const [aiMsg, setAiMsg] = useState(null);
  const [cropping, setCropping] = useState(false);

  // Font Studio (Aj, 2026-07-19): "make something similar for font... Push
  // to Font Modifier." Rather than a separate app, this is the SAME editor
  // with a font-family picker layered on -- loads any Google Font (properly
  // licensed for commercial use, unlike the original TPT fonts we only ever
  // name/reference) and applies it to the Text tool. Draw + AI-refine (the
  // other half of the ask) already works as-is via Freehand + the AI box
  // below; the quick-suggestion buttons make that path obvious.
  const [fontFamily, setFontFamily] = useState(initialFontFamily);
  const [fontInput, setFontInput] = useState(initialFontFamily);
  const [fontLoading, setFontLoading] = useState(false);

  const loadGoogleFont = useCallback(async (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    if (!loadedFontsRef.current.has(clean)) {
      setFontLoading(true);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean).replace(/%20/g, '+')}&display=swap`;
      document.head.appendChild(link);
      try {
        await document.fonts.load(`16px "${clean}"`);
        await document.fonts.ready;
      } catch { /* font may not exist on Google Fonts -- falls back to default, not fatal */ }
      loadedFontsRef.current.add(clean);
      setFontLoading(false);
    }
    setFontFamily(clean);
  }, []);

  useEffect(() => {
    if (initialFontFamily) loadGoogleFont(initialFontFamily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((user) => { if (!user) { router.push('/auth/login'); return; } setUserId(user.id); })
      .catch(() => router.push('/auth/login'));
  }, [router]);

  useEffect(() => { toolRef.current = tool; }, [tool]);

  // These stay in sync so the mouse-event handlers registered once at
  // canvas-init time (see the [] effect below) always see the CURRENT
  // picker values, not whatever was set at mount -- same reason toolRef
  // exists. Caught this while wiring in font support; worth fixing now
  // rather than shipping "new shapes ignore the color you just picked."
  const fillColorRef = useRef(fillColor);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const fontFamilyRef = useRef(fontFamily);
  useEffect(() => { fillColorRef.current = fillColor; }, [fillColor]);
  useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { fontFamilyRef.current = fontFamily; }, [fontFamily]);

  // ---------- History (undo/redo) ----------
  const pushHistory = useCallback(() => {
    const canvas = fCanvasRef.current;
    if (!canvas || historyRef.current.suppress) return;
    const h = historyRef.current;
    const json = canvas.toJSON();
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(json);
    if (h.stack.length > 40) h.stack.shift();
    h.index = h.stack.length - 1;
  }, []);

  const restoreHistory = useCallback(async (idx) => {
    const canvas = fCanvasRef.current;
    const h = historyRef.current;
    if (!canvas || idx < 0 || idx >= h.stack.length) return;
    h.suppress = true;
    await canvas.loadFromJSON(h.stack[idx]);
    canvas.requestRenderAll();
    h.index = idx;
    h.suppress = false;
  }, []);

  const undo = () => { const h = historyRef.current; if (h.index > 0) restoreHistory(h.index - 1); };
  const redo = () => { const h = historyRef.current; if (h.index < h.stack.length - 1) restoreHistory(h.index + 1); };

  // ---------- Canvas init ----------
  useEffect(() => {
    let disposed = false;
    (async () => {
      const fabric = await import('fabric');
      if (disposed) return;
      fabricRef.current = fabric;
      const { Canvas, PencilBrush, FabricImage } = fabric;

      const el = canvasElRef.current;
      const wrap = el.parentElement;
      const canvas = new Canvas(el, {
        width: wrap.clientWidth,
        height: 640,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true,
      });
      fCanvasRef.current = canvas;
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 4;
      canvas.freeDrawingBrush.color = '#000000';

      if (initialAssetUrl) {
        try {
          const img = await FabricImage.fromURL(initialAssetUrl, { crossOrigin: 'anonymous' });
          const scale = Math.min((wrap.clientWidth - 40) / img.width, 560 / img.height, 1);
          img.set({ left: 20, top: 20, scaleX: scale, scaleY: scale, selectable: true });
          canvas.add(img);
          canvas.requestRenderAll();
        } catch {
          setAiMsg('Could not load the source image (it may not allow cross-origin access) -- starting blank instead.');
        }
      }

      const updateSelectionState = () => {
        const obj = canvas.getActiveObject();
        if (!obj) { setSelected(null); return; }
        setSelected({ type: obj.type });
        setFillColor(typeof obj.fill === 'string' ? obj.fill : '#2f6b41');
        setStrokeColor(obj.stroke || '#000000');
        setStrokeWidth(obj.strokeWidth || 0);
        setOpacity(obj.opacity == null ? 1 : obj.opacity);
        setShadow(!!obj.shadow);
        if (obj.type === 'textbox' && obj.fontFamily) setFontFamily(obj.fontFamily);
      };
      canvas.on('selection:created', updateSelectionState);
      canvas.on('selection:updated', updateSelectionState);
      canvas.on('selection:cleared', () => setSelected(null));
      canvas.on('object:modified', pushHistory);
      canvas.on('path:created', pushHistory);

      // ---------- Shape drag-to-create ----------
      canvas.on('mouse:down', (opt) => {
        const t = toolRef.current;
        if (!['rect', 'ellipse', 'line'].includes(t)) return;
        const p = opt.scenePoint;
        const fc = fillColorRef.current, sc = strokeColorRef.current, sw = strokeWidthRef.current;
        const { Rect, Ellipse, Line } = fabricRef.current;
        let obj;
        if (t === 'rect') obj = new Rect({ left: p.x, top: p.y, width: 1, height: 1, fill: fc, stroke: sc, strokeWidth: sw });
        else if (t === 'ellipse') obj = new Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, fill: fc, stroke: sc, strokeWidth: sw });
        else obj = new Line([p.x, p.y, p.x, p.y], { stroke: sc || '#000000', strokeWidth: sw || 2 });
        canvas.add(obj);
        drawStateRef.current = { obj, startX: p.x, startY: p.y, kind: t };
        canvas.requestRenderAll();
      });
      canvas.on('mouse:move', (opt) => {
        const d = drawStateRef.current;
        if (!d) return;
        const p = opt.scenePoint;
        if (d.kind === 'rect') {
          d.obj.set({ width: Math.abs(p.x - d.startX), height: Math.abs(p.y - d.startY), left: Math.min(p.x, d.startX), top: Math.min(p.y, d.startY) });
        } else if (d.kind === 'ellipse') {
          d.obj.set({ rx: Math.abs(p.x - d.startX) / 2, ry: Math.abs(p.y - d.startY) / 2, left: Math.min(p.x, d.startX), top: Math.min(p.y, d.startY) });
        } else if (d.kind === 'line') {
          d.obj.set({ x2: p.x, y2: p.y });
        }
        canvas.requestRenderAll();
      });
      canvas.on('mouse:up', () => {
        if (drawStateRef.current) {
          drawStateRef.current.obj.setCoords();
          pushHistory();
        }
        drawStateRef.current = null;
        if (['rect', 'ellipse', 'line'].includes(toolRef.current)) setTool('select');
      });

      // ---------- Text tool: click to place ----------
      canvas.on('mouse:down', (opt) => {
        if (toolRef.current !== 'text') return;
        const { Textbox } = fabricRef.current;
        const p = opt.scenePoint;
        const t = new Textbox('Edit me', {
          left: p.x, top: p.y, width: 200, fontSize: 24,
          fill: fillColorRef.current,
          fontFamily: fontFamilyRef.current || undefined,
        });
        canvas.add(t);
        canvas.setActiveObject(t);
        t.enterEditing();
        canvas.requestRenderAll();
        setTool('select');
      });

      // ---------- Eyedropper ----------
      canvas.on('mouse:down', (opt) => {
        if (toolRef.current !== 'eyedropper') return;
        const ctx = canvas.getContext();
        const p = opt.viewportPoint;
        const px = ctx.getImageData(p.x, p.y, 1, 1).data;
        const hex = `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        setFillColor(hex);
        const active = canvas.getActiveObject();
        if (active) { active.set('fill', hex); canvas.requestRenderAll(); pushHistory(); }
        setTool('select');
      });

      setReady(true);
      pushHistory();
    })();
    return () => {
      disposed = true;
      if (fCanvasRef.current) { fCanvasRef.current.dispose(); fCanvasRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Toolbar actions ----------
  const addPolygon = (star) => {
    const canvas = fCanvasRef.current; const { Polygon } = fabricRef.current;
    const cx = 150, cy = 150, spikes = star ? 5 : 6, outerR = 80, innerR = star ? 34 : 80;
    const pts = [];
    for (let i = 0; i < spikes * (star ? 2 : 1); i++) {
      const r = star && i % 2 === 1 ? innerR : outerR;
      const a = (Math.PI * i) / spikes - Math.PI / 2;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    const poly = new Polygon(pts, { left: 60, top: 60, fill: fillColor, stroke: strokeColor, strokeWidth });
    canvas.add(poly); canvas.setActiveObject(poly); canvas.requestRenderAll(); pushHistory();
  };

  const toggleDraw = () => {
    const canvas = fCanvasRef.current;
    const next = tool === 'draw' ? 'select' : 'draw';
    canvas.isDrawingMode = next === 'draw';
    setTool(next);
  };

  const applyFill = (hex, gradient, hex2) => {
    const canvas = fCanvasRef.current; const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    if (gradient) {
      const { Gradient } = fabricRef.current;
      const w = obj.width * (obj.scaleX || 1), h = obj.height * (obj.scaleY || 1);
      obj.set('fill', new Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: w, y2: h },
        colorStops: [{ offset: 0, color: hex }, { offset: 1, color: hex2 }],
      }));
    } else {
      obj.set('fill', hex);
    }
    canvas.requestRenderAll(); pushHistory();
  };

  const applyStroke = (color, width) => {
    const obj = fCanvasRef.current?.getActiveObject();
    if (!obj) return;
    obj.set({ stroke: color, strokeWidth: width });
    fCanvasRef.current.requestRenderAll(); pushHistory();
  };

  const applyOpacity = (v) => {
    const obj = fCanvasRef.current?.getActiveObject();
    if (!obj) return;
    obj.set('opacity', v);
    fCanvasRef.current.requestRenderAll(); pushHistory();
  };

  const applyShadow = (on) => {
    const obj = fCanvasRef.current?.getActiveObject();
    if (!obj) return;
    const { Shadow } = fabricRef.current;
    obj.set('shadow', on ? new Shadow({ color: 'rgba(0,0,0,0.4)', blur: 10, offsetX: 6, offsetY: 6 }) : null);
    fCanvasRef.current.requestRenderAll(); pushHistory();
  };

  // Applies a Google Font to the selected text object, loading it first if
  // it hasn't been used yet this session.
  const applyFontFamily = async (name) => {
    await loadGoogleFont(name);
    const canvas = fCanvasRef.current; const obj = canvas?.getActiveObject();
    if (obj && obj.type === 'textbox') {
      obj.set('fontFamily', name);
      canvas.requestRenderAll();
      pushHistory();
    }
  };

  const layerOrder = (dir) => {
    const canvas = fCanvasRef.current; const obj = canvas?.getActiveObject();
    if (!obj) return;
    if (dir === 'front') canvas.bringObjectToFront(obj);
    else canvas.sendObjectToBack(obj);
    canvas.requestRenderAll(); pushHistory();
  };

  const duplicateSelected = async () => {
    const canvas = fCanvasRef.current; const obj = canvas?.getActiveObject();
    if (!obj) return;
    const clone = await obj.clone();
    clone.set({ left: obj.left + 20, top: obj.top + 20 });
    canvas.add(clone); canvas.setActiveObject(clone); canvas.requestRenderAll(); pushHistory();
  };

  const deleteSelected = () => {
    const canvas = fCanvasRef.current; const obj = canvas?.getActiveObject();
    if (!obj) return;
    canvas.remove(obj); canvas.requestRenderAll(); pushHistory();
  };

  const applyZoom = (next) => {
    const canvas = fCanvasRef.current;
    const z = Math.max(0.2, Math.min(4, next));
    canvas.setZoom(z);
    canvas.setDimensions({ width: canvasElRef.current.parentElement.clientWidth, height: 640 });
    setZoom(z);
  };

  // ---------- Crop ----------
  const startCrop = () => { setCropping(true); setTool('rect'); };
  const applyCrop = () => {
    const canvas = fCanvasRef.current;
    const obj = canvas.getActiveObject();
    if (!obj) { setAiMsg('Draw a rectangle first, select it, then Apply Crop.'); return; }
    const b = obj.getBoundingRect();
    canvas.remove(obj);
    const dataUrl = canvas.toDataURL({ format: 'png', left: b.left, top: b.top, width: b.width, height: b.height });
    fabricRef.current.FabricImage.fromURL(dataUrl).then((img) => {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      img.set({ left: 0, top: 0 });
      canvas.add(img);
      canvas.setDimensions({ width: b.width, height: b.height });
      canvas.requestRenderAll();
      pushHistory();
    });
    setCropping(false);
  };

  // ---------- AI edit ----------
  async function applyAIEdit() {
    if (!aiInstruction.trim() || !userId) return;
    setApplyingAI(true); setAiMsg(null);
    try {
      const canvas = fCanvasRef.current;
      const dataUrl = canvas.toDataURL({ format: 'png' });
      const res = await fetch('/api/asset-modifier/ai-edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, imageDataUrl: dataUrl, instruction: aiInstruction.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'AI edit failed');
      const { FabricImage } = fabricRef.current;
      const img = await FabricImage.fromURL(d.imageUrl, { crossOrigin: 'anonymous' });
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
      img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale });
      canvas.add(img);
      canvas.requestRenderAll();
      pushHistory();
      setAiMsg('Applied ✓ (use Undo if it\'s not what you wanted)');
    } catch (e) {
      setAiMsg(e.message);
    } finally {
      setApplyingAI(false);
    }
  }

  // ---------- Save ----------
  async function saveAsset() {
    if (!userId) return;
    setSaving(true); setSavedMsg(null); setSavedPart(null); setVarietyMsg(null)
    try {
      const canvas = fCanvasRef.current;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      const dataUrl = canvas.toDataURL({ format: 'png' });
      const res = await fetch('/api/asset-modifier/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dataUrl, title, sourcePartId, category: incomingCategory }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setSavedMsg('Saved to Parts Library ✓');
      setSavedPart(d.part);
    } catch (e) {
      setSavedMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  // "Make N Varieties" (Aj, 2026-07-19): "I want to be able to say 'Make 10
  // varieties' so I can ensure variety of uniquely my own assets to call
  // from." Runs right after a save, using the just-saved asset as the style
  // reference for the existing generate-matching-set endpoint (FLUX
  // Kontext) -- results inherit this asset's category, so 10 border
  // varieties land in the Border library, not a generic bucket.
  async function generateVarieties() {
    if (!savedPart || !varietyPrompt.trim() || generatingVarieties) return
    setGeneratingVarieties(true); setVarietyMsg(null)
    try {
      const res = await fetch('/api/style-lab/generate-matching-set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, partId: savedPart.id, prompt: varietyPrompt.trim(), count: varietyCount }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Generation failed')
      const note = d.failures?.length ? ` (${d.failures.length} failed -- try again for those)` : ''
      setVarietyMsg(`✓ Added ${d.savedCount} of ${d.requested} to Parts Library${note}`)
    } catch (e) {
      setVarietyMsg(e.message)
    } finally {
      setGeneratingVarieties(false)
    }
  }

  const toolBtn = (id, label, onClick) => (
    <button
      onClick={onClick || (() => setTool(id))}
      style={{
        display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '6px 10px', marginBottom: 3,
        border: '1px solid ' + (tool === id ? '#7a3c8a' : '#e3ddd0'), borderRadius: 6,
        background: tool === id ? '#f5eafa' : '#fff', color: tool === id ? '#7a3c8a' : '#333',
        cursor: 'pointer', fontWeight: tool === id ? 600 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1c3557', margin: 0 }}>🎨 Asset Modifier</h1>
        {incomingCategory && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 12, padding: '3px 10px' }}>
            Saving into: {CATEGORY_BADGE_LABELS[incomingCategory] || incomingCategory}
          </span>
        )}
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          style={{ fontSize: 13, padding: '5px 8px', border: '1px solid #e3ddd0', borderRadius: 6, minWidth: 220 }}
        />
        <button onClick={saveAsset} disabled={saving || !ready}
          style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#2f6b41', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : '💾 Save as Asset'}
        </button>
        {savedMsg && <span style={{ fontSize: 12, color: savedMsg.startsWith('Saved') ? '#2f6b41' : '#a33' }}>{savedMsg}</span>}
        <a href="/dashboard/library-parts" style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>← Parts Library</a>
      </div>

      {savedPart && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 10px', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#7a3c8a' }}>✨ Make varieties of this:</span>
          <input
            type="text" value={varietyPrompt} onChange={(e) => setVarietyPrompt(e.target.value)}
            placeholder='e.g. "same style, different color accents"'
            disabled={generatingVarieties}
            style={{ flex: 1, minWidth: 200, fontSize: 12, padding: '5px 8px', border: '1px solid #d9b8e8', borderRadius: 4 }}
          />
          <input
            type="number" min={1} max={12} value={varietyCount}
            onChange={(e) => setVarietyCount(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 10)))}
            disabled={generatingVarieties}
            style={{ width: 48, fontSize: 12, padding: '5px 6px', border: '1px solid #d9b8e8', borderRadius: 4, textAlign: 'center' }}
          />
          <button
            onClick={generateVarieties} disabled={generatingVarieties || !varietyPrompt.trim()}
            style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 5, padding: '5px 14px', cursor: generatingVarieties || !varietyPrompt.trim() ? 'default' : 'pointer', opacity: generatingVarieties || !varietyPrompt.trim() ? 0.6 : 1 }}
          >
            {generatingVarieties ? 'Generating…' : `Make ${varietyCount}`}
          </button>
          {varietyMsg && <span style={{ fontSize: 11, color: varietyMsg.startsWith('✓') ? '#2f6b41' : '#a33', width: '100%' }}>{varietyMsg}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT: tools */}
        <div style={{ flex: '0 0 160px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Select & Draw</div>
          {toolBtn('select', '↖ Select / Transform')}
          {toolBtn('rect', '▭ Rectangle')}
          {toolBtn('ellipse', '◯ Ellipse')}
          <button onClick={() => addPolygon(false)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '6px 10px', marginBottom: 3, border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>⬡ Polygon</button>
          <button onClick={() => addPolygon(true)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '6px 10px', marginBottom: 3, border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>★ Star</button>
          {toolBtn('line', '／ Line')}
          {toolBtn('draw', '✏️ Freehand', toggleDraw)}
          {toolBtn('text', '🔤 Text')}
          {toolBtn('eyedropper', '💧 Eyedropper')}

          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '10px 0 4px' }}>Crop</div>
          {!cropping ? (
            <button onClick={startCrop} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '6px 10px', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>⬛ Draw crop box</button>
          ) : (
            <button onClick={applyCrop} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '6px 10px', border: '1px solid #7a3c8a', borderRadius: 6, background: '#f5eafa', color: '#7a3c8a', cursor: 'pointer' }}>✂️ Apply crop</button>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '10px 0 4px' }}>Layers</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={duplicateSelected} title="Duplicate" style={{ flex: 1, fontSize: 14, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>⧉</button>
            <button onClick={deleteSelected} title="Delete" style={{ flex: 1, fontSize: 14, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>🗑</button>
            <button onClick={() => layerOrder('front')} title="Bring to front" style={{ flex: 1, fontSize: 14, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>⬆</button>
            <button onClick={() => layerOrder('back')} title="Send to back" style={{ flex: 1, fontSize: 14, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>⬇</button>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '10px 0 4px' }}>History</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={undo} style={{ flex: 1, fontSize: 12, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>↶ Undo</button>
            <button onClick={redo} style={{ flex: 1, fontSize: 12, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>↷ Redo</button>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '10px 0 4px' }}>Zoom</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => applyZoom(zoom - 0.2)} style={{ flex: 1, fontSize: 12, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>−</button>
            <span style={{ fontSize: 11, color: '#555', width: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => applyZoom(zoom + 0.2)} style={{ flex: 1, fontSize: 12, padding: '5px 0', border: '1px solid #e3ddd0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>+</button>
          </div>
        </div>

        {/* CENTER: canvas */}
        <div style={{ flex: '1 1 500px', minWidth: 300 }}>
          <div style={{ border: '1px solid #e3ddd0', borderRadius: 8, background: '#f7f5f0', padding: 10, overflow: 'auto' }}>
            {!ready && <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Loading editor…</p>}
            <canvas ref={canvasElRef} />
          </div>

          <div style={{ marginTop: 10, padding: 12, background: '#fff', border: '1px solid #d9b8e8', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7a3c8a', marginBottom: 4 }}>✨ AI Instruction Box</div>
            <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>
              Describe a change and it'll apply it to the whole canvas as-is (AI edit, not a precision tool -- for fine control use the tools on the left).
            </p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                'Clean up and refine this sketch into a polished illustration',
                'Turn this into a bold, hand-lettered word art style',
                'Make it look playful and bouncy, kid-friendly classroom style',
              ].map((s, i) => (
                <button key={i} onClick={() => setAiInstruction(s)}
                  style={{ fontSize: 10, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 12, padding: '3px 10px', cursor: 'pointer' }}>
                  {s.length > 30 ? s.slice(0, 28) + '…' : s}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)}
                placeholder='e.g. "make the border teal instead of orange"'
                disabled={applyingAI}
                onKeyDown={(e) => { if (e.key === 'Enter') applyAIEdit(); }}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px', border: '1px solid #d9b8e8', borderRadius: 4 }}
              />
              <button onClick={applyAIEdit} disabled={applyingAI || !aiInstruction.trim()}
                style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 5, padding: '6px 14px', cursor: applyingAI ? 'default' : 'pointer', opacity: applyingAI || !aiInstruction.trim() ? 0.6 : 1 }}>
                {applyingAI ? 'Applying…' : 'Apply'}
              </button>
            </div>
            {aiMsg && <p style={{ fontSize: 11, color: aiMsg.startsWith('Applied') ? '#2f6b41' : '#a33', marginTop: 6 }}>{aiMsg}</p>}
          </div>
        </div>

        {/* RIGHT: properties */}
        <div style={{ flex: '0 0 200px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>🔤 Font (Google Fonts)</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              type="text" value={fontInput} onChange={(e) => setFontInput(e.target.value)}
              placeholder="e.g. Fredoka"
              onKeyDown={(e) => { if (e.key === 'Enter') applyFontFamily(fontInput); }}
              style={{ flex: 1, fontSize: 11, padding: '5px 6px', border: '1px solid #e3ddd0', borderRadius: 4 }}
            />
            <button onClick={() => applyFontFamily(fontInput)} disabled={fontLoading || !fontInput.trim()}
              style={{ fontSize: 10, color: '#fff', background: '#2f6b41', border: 'none', borderRadius: 4, padding: '0 8px', cursor: 'pointer' }}>
              {fontLoading ? '…' : 'Load'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
            {['Fredoka', 'Patrick Hand', 'Luckiest Guy', 'Short Stack', 'Bungee'].map((f) => (
              <button key={f} onClick={() => { setFontInput(f); applyFontFamily(f); }}
                style={{ fontSize: 9, color: '#333', background: '#f0ece3', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}>
                {f}
              </button>
            ))}
          </div>
          {fontFamily && <p style={{ fontSize: 10, color: '#2f6b41', margin: '0 0 4px' }}>Active: {fontFamily}</p>}
          <p style={{ fontSize: 9, color: '#aaa', marginBottom: 10, lineHeight: 1.4 }}>
            Pick a font, then use the 🔤 Text tool -- new text uses this font. Free Google Fonts only
            (properly licensed for commercial use), same reasoning as the Style Lab font finder.
          </p>

          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Fill</div>
          <input type="color" value={fillColor} onChange={(e) => { setFillColor(e.target.value); applyFill(e.target.value, useGradient, gradientColor2); }} style={{ width: '100%', height: 30, marginBottom: 4, cursor: 'pointer' }} />
          <label style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <input type="checkbox" checked={useGradient} onChange={(e) => { setUseGradient(e.target.checked); applyFill(fillColor, e.target.checked, gradientColor2); }} />
            Gradient
          </label>
          {useGradient && (
            <input type="color" value={gradientColor2} onChange={(e) => { setGradientColor2(e.target.value); applyFill(fillColor, true, e.target.value); }} style={{ width: '100%', height: 26, marginBottom: 4, cursor: 'pointer' }} />
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '10px 0 4px' }}>Stroke</div>
          <input type="color" value={strokeColor} onChange={(e) => { setStrokeColor(e.target.value); applyStroke(e.target.value, strokeWidth); }} style={{ width: '100%', height: 26, marginBottom: 4, cursor: 'pointer' }} />
          <input type="range" min={0} max={30} value={strokeWidth} onChange={(e) => { const v = parseInt(e.target.value, 10); setStrokeWidth(v); applyStroke(strokeColor, v); }} style={{ width: '100%' }} />

          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '10px 0 4px' }}>Opacity</div>
          <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => { const v = parseFloat(e.target.value); setOpacity(v); applyOpacity(v); }} style={{ width: '100%' }} />

          <label style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 4, margin: '10px 0' }}>
            <input type="checkbox" checked={shadow} onChange={(e) => { setShadow(e.target.checked); applyShadow(e.target.checked); }} />
            Drop shadow
          </label>

          {!selected && <p style={{ fontSize: 10, color: '#aaa', marginTop: 8 }}>Select an object to edit its properties.</p>}
        </div>
      </div>
    </div>
  );
}

export default function AssetModifierPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
      <AssetModifierInner />
    </Suspense>
  );
}
