'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getUserProducts, createProduct } from '@/lib/products';
import { getUserBundles } from '@/lib/bundles';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import DashboardAssistant from '@/components/DashboardAssistant';
import BuildAssistant from '@/components/BuildAssistant';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        const [productsData, bundlesData] = await Promise.all([
          getUserProducts(currentUser.id),
          getUserBundles(currentUser.id),
        ]);

        setProducts(productsData);
        setBundles(bundlesData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  async function handleBulkUpload(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type === 'application/pdf');
    if (!files.length) return;
    setUploading(true);
    setUploadResult(null);
    const created = [];
    const errors = [];
    try {
      const currentUser = user || (await getCurrentUser());
      if (!currentUser) return;

      for (const file of files) {
        try {
          const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { error: uploadError } = await (supabase).storage.from('product-files').upload(path, file, {
            contentType: 'application/pdf',
            upsert: false,
          });
          if (uploadError) throw new Error(uploadError.message);
          const { data: urlData } = (supabase).storage.from('product-files').getPublicUrl(path);
          const product = await createProduct(currentUser.id, {
            title: file.name.replace(/\.pdf$/i, ''),
            file_url: urlData.publicUrl,
            status: 'draft',
          });
          created.push(product);
        } catch (e) {
          errors.push({ filename: file.name, error: e.message });
        }
      }
      setProducts((prev) => [...created, ...prev]);
      setUploadResult({ count: created.length, errors });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardAssistant />
      <BuildAssistant />
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-2">Welcome back! Manage your products and bundles.</p>
      </div>

      {/* Bulk upload existing products */}
      <div className="card p-6 border-2 border-dashed border-slate-300">
        <h2 className="text-xl font-bold text-slate-900 mb-1">📎 Upload Your Existing Products</h2>
        <p className="text-slate-600 text-sm mb-4">
          Drop in PDFs of products you already have -- each one becomes a Product automatically (title taken from the filename), ready to tag into components and slice/mix in the Composer.
        </p>
        <label className="btn-primary inline-block cursor-pointer">
          {uploading ? 'Uploading…' : '📎 Choose PDF(s)'}
          <input
            type="file" accept="application/pdf" multiple
            disabled={uploading}
            onChange={(e) => handleBulkUpload(e.target.files)}
            className="hidden"
          />
        </label>
        {uploadResult && (
          <div className="mt-3 text-sm">
            {uploadResult.count > 0 && (
              <p className="text-green-700">✓ Added {uploadResult.count} product{uploadResult.count > 1 ? 's' : ''}.</p>
            )}
            {uploadResult.errors?.length > 0 && (
              <div className="text-red-600 mt-1">
                {uploadResult.errors.map((e, i) => (
                  <div key={i}>{e.filename}: {e.error}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 font-medium">Total Products</p>
              <p className="text-4xl font-bold text-slate-900 mt-2">{products.length}</p>
            </div>
            <span className="text-4xl">📁</span>
          </div>
          <Link href="/dashboard/products" className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-4 inline-block">
            View All Products →
          </Link>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 font-medium">Total Bundles</p>
              <p className="text-4xl font-bold text-slate-900 mt-2">{bundles.length}</p>
            </div>
            <span className="text-4xl">📦</span>
          </div>
          <Link href="/dashboard/bundles" className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-4 inline-block">
            View All Bundles →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="flex gap-4 flex-wrap">
          <Link href="/dashboard/products/new" className="btn-primary">
            ➕ New Product
          </Link>
          <Link href="/dashboard/bundles/new" className="btn-primary">
            ➕ New Bundle
          </Link>
        </div>
      </div>

      {/* Recent Products */}
      {products.length > 0 && (
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Products</h2>
          <div className="space-y-3">
            {products.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{product.title}</p>
                  <p className="text-sm text-slate-600">{product.resource_type || 'No type'}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {product.status}
                </span>
              </div>
            ))}
          </div>
          {products.length > 5 && (
            <Link href="/dashboard/products" className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-4 inline-block">
              View All →
            </Link>
          )}
        </div>
      )}

      {/* Recent Bundles */}
      {bundles.length > 0 && (
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Bundles</h2>
          <div className="space-y-3">
            {bundles.slice(0, 5).map((bundle) => (
              <div key={bundle.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{bundle.title}</p>
                  <p className="text-sm text-slate-600">{bundle.bundle_items?.[0]?.count || 0} items</p>
                </div>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                  {bundle.status}
                </span>
              </div>
            ))}
          </div>
          {bundles.length > 5 && (
            <Link href="/dashboard/bundles" className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-4 inline-block">
              View All →
            </Link>
          )}
        </div>
      )}

      {/* Empty State */}
      {products.length === 0 && bundles.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">👋</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Get Started</h2>
          <p className="text-slate-600 mb-6">Create your first product or bundle to begin.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard/products/new" className="btn-primary">
              Create Product
            </Link>
            <Link href="/dashboard/bundles/new" className="btn-primary">
              Create Bundle
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
