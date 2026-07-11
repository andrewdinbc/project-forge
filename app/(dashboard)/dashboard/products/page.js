'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getUserProducts } from '@/lib/products';
import Link from 'next/link';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        const data = await getUserProducts(user.id);
        setProducts(data);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-600 mt-1">Manage your TPT resources</p>
        </div>
        <Link href="/dashboard/products/new" className="btn-primary">
          ➕ New Product
        </Link>
      </div>

      {/* Products Table */}
      {products.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-slate-900">Title</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-900">Type</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-900">Price</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-900">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-900">Created</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{product.title}</p>
                    {product.description && (
                      <p className="text-sm text-slate-600 truncate">{product.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{product.resource_type || '—'}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    ${product.price_usd?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      product.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : product.status === 'draft'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(product.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📁</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No Products Yet</h2>
          <p className="text-slate-600 mb-6">Create your first product to get started.</p>
          <Link href="/dashboard/products/new" className="btn-primary inline-block">
            Create Product
          </Link>
        </div>
      )}
    </div>
  );
}