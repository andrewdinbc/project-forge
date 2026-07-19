'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

// Personal library of favorite individual components (visual or content)
// starred from Composer or Style Lab, independent of which product they
// originally came from -- so they can be reused across future builds
// instead of re-finding them each time. Aj, 2026-07-19: "build a library
// of what I like to inject into new activities or content."
export default function LibraryPartsPage() {
  const [userId, setUserId] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user) { router.push('/auth/login'); return; }
        setUserId(user.id);
      })
      .catch(() => router.push('/auth/login'));
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/library-parts?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setParts(d.parts || []))
      .finally(() => setLoading(false));
  }, [userId]);

  async function remove(id) {
    setBusyId(id);
    try {
      await fetch(`/api/library-parts?userId=${userId}&id=${id}`, { method: 'DELETE' });
      setParts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  const visualComponents = parts.filter((p) => p.kind === 'component');
  const contentPdf = parts.filter((p) => p.kind === 'resource'); // Style Lab resources -- both PDF and URL live here

  function Section({ title, icon, items, emptyHint }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1c3557', marginBottom: 10 }}>
          {icon} {title} ({items.length})
        </h2>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>{emptyHint}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#fff', border: '1px solid #e3ddd0', borderRadius: 8, padding: '10px 14px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1c3557', margin: 0 }}>{p.title}</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 2 }}>
                    {p.category && <span style={{ fontSize: 11, color: '#999' }}>{p.category}</span>}
                    {p.products?.title && (
                      <a href={`/dashboard/products/${p.source_product_id}`} style={{ fontSize: 11, color: '#2f6b41' }}>
                        from "{p.products.title}"
                      </a>
                    )}
                    {p.kind === 'resource' && (
                      <a href="/dashboard/style-lab" style={{ fontSize: 11, color: '#2f6b41' }}>
                        View in Style Lab
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  disabled={busyId === p.id}
                  style={{ fontSize: 11, color: '#a33', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: busyId === p.id ? 0.5 : 1 }}
                >
                  {busyId === p.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1c3557', marginBottom: 4 }}>📦 Parts Library</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Your favorite individual pieces, saved from Composer (visual/content components) or Style Lab
        (PDF and URL resources), independent of which product they came from -- so you can find and
        reuse them when building something new. Star anything with the ⭐ button in Composer or Style Lab
        to add it here.
      </p>
      <Section
        title="Visual & Content Components"
        icon="🧩"
        items={visualComponents}
        emptyHint="Nothing starred yet -- star a tagged component in Composer to save it here."
      />
      <Section
        title="Content Library (PDF & URL)"
        icon="📚"
        items={contentPdf}
        emptyHint="Nothing starred yet -- star a resource in Style Lab to save it here."
      />
    </div>
  );
}
