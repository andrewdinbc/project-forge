'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProduct } from '@/lib/products';
import ComponentTagger from '@/components/ComponentTagger';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = (params?.productId ?? '') as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (error || !product) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-600">{error || 'Product not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{product.title}</h1>
        {product.description && <p className="text-slate-600 mt-1">{product.description}</p>}
        {!product.file_url && (
          <p className="text-amber-600 text-sm mt-2">
            ⚠️ No file uploaded yet — component tagging and the Composer both need a PDF at this product's file_url.
          </p>
        )}
      </div>

      <ComponentTagger productId={productId} />
    </div>
  );
}
