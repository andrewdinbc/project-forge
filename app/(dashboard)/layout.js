'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/auth';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push('/auth/login');
          return;
        }
        setUser(currentUser);
      } catch (error) {
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar
          IMPORTANT: the account/Sign Out block at the bottom must stay a
          normal flex-column child (shrink-0), never `absolute` -- an
          absolutely-positioned footer sits on top of whatever nav items
          are near the bottom once the list grows past viewport height,
          silently hiding them (caught live, Aj, 2026-07-19). `nav` scrolls
          independently via flex-1 + overflow-y-auto + min-h-0 instead. */}
      <aside className="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-200 shrink-0">
          <h1 className="text-2xl font-bold text-blue-600">Forge</h1>
          <p className="text-sm text-slate-600 mt-1">TPT Bundle Creator</p>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto min-h-0">
          <Link
            href="/dashboard"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            📊 Dashboard
          </Link>
          <Link
            href="/dashboard/products"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            📁 Products
          </Link>
          <Link
            href="/dashboard/bundles"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            📦 Bundles
          </Link>
          <Link
            href="/dashboard/product-builder"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            🧩 Product Builder
          </Link>
          <Link
            href="/dashboard/spacing-alignment-editor"
            className="block pl-8 pr-4 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-sm transition-colors"
          >
            📐 Spacing & Alignment Editor
          </Link>
          <Link
            href="/dashboard/composer"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            🧬 Composer
          </Link>
          <Link
            href="/dashboard/style-lab"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            🎨 Style Lab
          </Link>
          <Link
            href="/dashboard/asset-modifier"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            🎨 Style Editor
          </Link>
          <Link
            href="/dashboard/content-editor"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            📖 Content Editor
          </Link>
          <Link
            href="/dashboard/schema-lab"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            🧬 Schema Editor
          </Link>
          <Link
            href="/dashboard/foldable-shapes"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            🗂 Foldable Shapes
          </Link>
          <Link
            href="/dashboard/from-lesson-planner"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            📚 From Lesson Planner
          </Link>
          <Link
            href="/dashboard/design-assets"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            🎨 Design Assets
          </Link>
          <Link
            href="/dashboard/library-parts"
            className="block px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          >
            📦 Parts Library
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-200 bg-white shrink-0">
          <div className="mb-4 text-sm">
            <p className="font-medium text-slate-900">{user?.email}</p>
            <p className="text-slate-600 text-xs">Signed in</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

