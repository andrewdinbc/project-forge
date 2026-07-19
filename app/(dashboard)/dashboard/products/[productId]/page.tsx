'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProduct, updateProduct } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import ComponentTagger from '@/components/ComponentTagger';
import PdfCropTool from '@/components/PdfCropTool';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = (params?.productId ?? '') as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagResult, setAutoTagResult] = useState<{ taggedCount: number; pageCount: number } | null>(null);
  const [tagVersion, setTagVersion] = useState(0);
  const [extractingImages, setExtractingImages] = useState(false);
  const [extractResult, setExtractResult] = useState<{ images: any[]; skipped: any[] } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }
        setUserId(user.id);
        const data = await getProduct(productId, user.id);
        if (!data) {
          setError('Product not found');
        } else {
          setProduct(data);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load product');
      } finally {
        setLoading(false);
      }
    }
    if (productId) load();
  }, [productId, router]);

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files are supported right now.'); return; }
    setUploading(true);
    setError(null);
    try {
      const user = await getCurrentUser();
      if (!user) { router.push('/auth/login'); return; }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await (supabase as any).storage.from('product-files').upload(path, file, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      const { data: urlData } = (supabase as any).storage.from('product-files').getPublicUrl(path);
      const updated = await updateProduct(productId, user.id, { file_url: urlData.publicUrl });
      setProduct(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleAutoTag() {
    setAutoTagging(true);
    setError(null);
    setAutoTagResult(null);
    try {
      const user = await getCurrentUser();
      if (!user) { router.push('/auth/login'); return; }
      const res = await fetch(`/api/products/${productId}/auto-tag`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAutoTagResult({ taggedCount: data.taggedCount, pageCount: data.pageCount });
      setTagVersion((v) => v + 1); // force ComponentTagger to reload its list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auto-tag failed');
    } finally {
      setAutoTagging(false);
    }
  }

  // Push to AI Steering (Aj, 2026-07-19): moved here from Style Lab -- this
  // is now the ONLY way anything reaches AI Steering, and it only ever
  // reads from a product Aj actually authored and published.
  const [pushingToSteering, setPushingToSteering] = useState(false);
  async function handlePushToSteering() {
    setPushingToSteering(true);
    setError(null);
    try {
      const user = await getCurrentUser();
      if (!user) { router.push('/auth/login'); return; }
      const res = await fetch(`/api/products/${productId}/push-to-steering`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProduct((prev: any) => ({ ...prev, pushed_to_steering_doc_id: data.steering_doc_id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to push to AI Steering');
    } finally {
      setPushingToSteering(false);
    }
  }

  async function handleExtractImages() {
    setExtractingImages(true);
    setError(null);
    setExtractResult(null);
    try {
      const user = await getCurrentUser();
      if (!user) { router.push('/auth/login'); return; }
      const res = await fetch(`/api/products/${productId}/extract-images`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtractResult({ images: data.images || [], skipped: data.skipped || [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image extraction failed');
    } finally {
      setExtractingImages(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading product…</p>
        </div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-600">Product not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{product.title}</h1>
        {product.description && <p className="text-slate-600 mt-1">{product.description}</p>}
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        {!product.file_url ? (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-700 text-sm mb-2">
              ⚠️ No file uploaded yet — component tagging and the Composer both need a PDF at this product's file_url.
            </p>
            <input
              type="file" accept="application/pdf"
              disabled={uploading}
              onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
              className="text-sm"
            />
            {uploading && <p className="text-xs text-slate-500 mt-1">Uploading…</p>}
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-green-700">
              ✓ File on record — <a href={product.file_url} target="_blank" rel="noreferrer" className="underline">view PDF</a>
            </p>
            <button onClick={handleAutoTag} disabled={autoTagging} className="btn-primary mt-2">
              {autoTagging ? '🔍 Reading pages…' : '✨ AI Auto-Tag Components'}
            </button>
            <button
              onClick={handlePushToSteering}
              disabled={pushingToSteering || !!product.pushed_to_steering_doc_id}
              className="btn-primary mt-2 ml-2"
              style={{ opacity: product.pushed_to_steering_doc_id ? 0.6 : 1 }}
            >
              {product.pushed_to_steering_doc_id ? '✓ In AI Steering' : pushingToSteering ? 'Pushing…' : '→ Push to AI Steering'}
            </button>
            <p className="text-xs text-slate-500 mt-1">
              Only your own products can feed AI Steering -- imported/purchased reference material in
              Style Lab no longer can.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Reads every page and tags Cover Page, Answer Keys, Teacher Instructions, etc. automatically -- re-running replaces the previous AI pass.
            </p>
            {autoTagResult && (
              <p className="text-sm text-green-700 mt-2">
                ✓ Tagged {autoTagResult.taggedCount} component{autoTagResult.taggedCount !== 1 ? 's' : ''} across {autoTagResult.pageCount} pages.
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-slate-200">
              <button onClick={handleExtractImages} disabled={extractingImages} className="btn-primary">
                {extractingImages ? '🔬 Extracting…' : '🔬 Extract Images'}
              </button>
              <p className="text-xs text-slate-500 mt-1">
                Pulls every embedded image out of this PDF as a standalone file and saves it to your
                Parts Library, ready to reuse. Covers real embedded photos/clipart (JPEG, and 8-bit
                RGB/grayscale PNGs); doesn't cover hand-drawn diagrams or vector art built from shapes
                (that's a cropping tool, coming separately), and skips anything under 40x40px.
              </p>
              {extractResult && (
                <div className="mt-3">
                  {extractResult.images.length > 0 && (
                    <>
                      <p className="text-sm text-green-700 mb-2">
                        ✓ Extracted {extractResult.images.length} image{extractResult.images.length !== 1 ? 's' : ''} --
                        saved to your <a href="/dashboard/library-parts" className="underline">Parts Library</a>.
                      </p>
                      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                        {extractResult.images.map((img: any, i: number) => (
                          <a key={i} href={img.url} target="_blank" rel="noreferrer" className="block border border-slate-200 rounded overflow-hidden">
                            <img src={img.url} alt={`Extracted image ${i + 1}`} className="w-full h-16 object-cover" />
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                  {extractResult.images.length === 0 && extractResult.skipped.length > 0 && (
                    <p className="text-sm text-amber-600">No images could be extracted from this PDF (see details below).</p>
                  )}
                  {extractResult.skipped.length > 0 && (
                    <details className="mt-2 text-xs text-slate-500">
                      <summary className="cursor-pointer">
                        {extractResult.skipped.length} item{extractResult.skipped.length !== 1 ? 's' : ''} skipped -- why?
                      </summary>
                      <ul className="list-disc list-inside mt-1">
                        {extractResult.skipped.map((s: any, i: number) => (
                          <li key={i}>{s.label}: {s.reason}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            {userId && <PdfCropTool userId={userId} productId={productId} productTitle={product.title} />}
          </div>
        )}
      </div>

      <ComponentTagger key={tagVersion} productId={productId} />
    </div>
  );
}
