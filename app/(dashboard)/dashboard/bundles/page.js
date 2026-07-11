'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getUserBundles } from '@/lib/bundles';
import Link from 'next/link';

export default function BundlesPage() {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBundles = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        const data = await getUserBundles(user.id);
        setBundles(data);
      } catch (error) {
        console.error('Failed to load bundles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBundles();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading bundles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bundles</h1>
          <p className="text-slate-600 mt-1">Manage your product bundles</p>
        </div>
        <Link href="/dashboard/bundles/new" className="btn-primary">
          ➕ New Bundle
        </Link>
      </div>

      {/* Bundles Grid */}
      {bundles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bundles.map((bundle) => (
            <Link
              key={bundle.id}
              href={`/dashboard/bundles/${bundle.id}`}
              className="card p-6 hover:shadow-lg transition-all"
            >
              {bundle.thumbnail_url && (
                <img
                  src={bundle.thumbnail_url}
                  alt={bundle.title}
                  className="w-full h-40 object-cover rounded-lg mb-4"
                />
              )}
              <h3 className="font-bold text-lg text-slate-900 line-clamp-2">
                {bundle.title}
              </h3>
              {bundle.description && (
                <p className="text-sm text-slate-600 line-clamp-2 mt-2">
                  {bundle.description}
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    {bundle.bundle_items?.[0]?.count || 0} items
                  </span>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    bundle.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : bundle.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {bundle.status}
                  </span>
                </div>
                {bundle.bundle_price_usd && (
                  <p className="text-lg font-bold text-slate-900 mt-2">
                    ${bundle.bundle_price_usd.toFixed(2)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">📦</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No Bundles Yet</h2>
          <p className="text-slate-600 mb-6">Create your first bundle to get started.</p>
          <Link href="/dashboard/bundles/new" className="btn-primary inline-block">
            Create Bundle
          </Link>
        </div>
      )}
    </div>
  );
}
