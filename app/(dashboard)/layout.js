'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/auth';

// Sidebar structure (Aj, 2026-07-19): "main buttons, and when I click them
// they open to the suite within it." Standalone pages stay flat links;
// related pages are grouped under one clickable suite header that expands
// to reveal them. Adding a new page under an existing suite = one line
// here; a genuinely new suite = one new group entry.
const NAV = [
  { type: 'link', href: '/dashboard', label: '📊 Dashboard' },
  { type: 'link', href: '/dashboard/uploads', label: '📤 Uploads' },
  {
    type: 'suite', key: 'products', label: '📁 Finished Products',
    items: [
      { href: '/dashboard/products', label: '📁 Finished Products' },
      { href: '/dashboard/bundles', label: '📦 Bundles' },
      { href: '/dashboard/composer', label: '🧬 Composer' },
    ],
  },
  {
    type: 'suite', key: 'product-builder', label: '🧩 Product Builder',
    items: [
      { href: '/dashboard/product-builder', label: '🧩 Product Builder' },
      { href: '/dashboard/separator', label: '✂️ Separator' },
      { href: '/dashboard/spacing-alignment-editor', label: '📐 Spacing & Alignment Editor' },
    ],
  },
  {
    type: 'suite', key: 'style-lab', label: '🎨 Style Lab',
    items: [
      { href: '/dashboard/style-lab', label: '🎨 Style Lab' },
      { href: '/dashboard/asset-modifier', label: '🖌 Style Editor' },
      { href: '/dashboard/content-editor', label: '📖 Content Editor' },
      { href: '/dashboard/schema-lab', label: '🧬 Schema Editor' },
    ],
  },
  {
    type: 'suite', key: 'parts-library', label: '📦 Parts Library',
    items: [
      { href: '/dashboard/library-parts', label: '📦 Parts Library' },
      { href: '/dashboard/design-assets', label: '🎨 Design Assets' },
      { href: '/dashboard/foldable-shapes', label: '🗂 Foldable Shapes' },
    ],
  },
  { type: 'link', href: '/dashboard/from-lesson-planner', label: '📚 From Lesson Planner' },
];

// Which suite (if any) contains the given path -- used to auto-expand the
// right one on load/navigation, so landing on a sub-page via a direct link
// or refresh doesn't leave the sidebar looking empty.
function suiteKeyForPath(pathname) {
  for (const entry of NAV) {
    if (entry.type === 'suite' && entry.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))) {
      return entry.key;
    }
  }
  return null;
}

function NavLink({ href, label, pathname, indent }) {
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={
        (indent ? 'block pl-8 pr-4 py-1.5 text-sm ' : 'block px-4 py-2 font-medium ') +
        'rounded-lg transition-colors ' +
        (active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-100')
      }
    >
      {label}
    </Link>
  );
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSuite, setOpenSuite] = useState(() => suiteKeyForPath(pathname));

  // Keep the sidebar in sync with whatever suite the current page belongs
  // to, without fighting the person if they've manually opened a different
  // suite to browse (only force-open on an actual navigation, never close
  // one they opened on purpose).
  useEffect(() => {
    const active = suiteKeyForPath(pathname);
    if (active) setOpenSuite(active);
  }, [pathname]);

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

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto min-h-0">
          {NAV.map((entry) => {
            if (entry.type === 'link') {
              return <NavLink key={entry.href} href={entry.href} label={entry.label} pathname={pathname} />;
            }
            const isOpen = openSuite === entry.key;
            return (
              <div key={entry.key} className="pb-1">
                <button
                  onClick={() => setOpenSuite(isOpen ? null : entry.key)}
                  className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                >
                  <span>{entry.label}</span>
                  <span className="text-slate-400 text-xs">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1">
                    {entry.items.map((item) => (
                      <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} indent />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
