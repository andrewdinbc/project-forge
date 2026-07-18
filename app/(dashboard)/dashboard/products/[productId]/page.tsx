'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProduct, updateProduct } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import ComponentTagger from '@/components/ComponentTagger';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = (params?.productId ?? '') as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }
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
          <p className="text-sm text-green-700 mt-2">
            ✓ File on record — <a href={product.file_url} target="_blank" rel="noreferrer" className="underline">view PDF</a>
          </p>
        )}
      </div>

      <ComponentTagger productId={productId} />
    </div>
  );
}
