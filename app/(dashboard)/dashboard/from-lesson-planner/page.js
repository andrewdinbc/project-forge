'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

// Everything auto-copied into Forge from an end-user PDF/URL upload in
// lesson-planner (tagged source_app = 'lesson-planner' at insert time --
// see app/api/units/upload-resource, activity-notes, and add-url-resource
// in the lesson-planner repo). Split into PDFs vs URLs per Aj's spec,
// each with a one-click "→ AI Steering" push. Aj, 2026-07-19.

const STATUS_LABELS = {
  raw: { label: 'Not reviewed yet', color: '#999' },
  edited: { label: 'Edited', color: '#a06b1f' },
  pushed_to_steering: { label: '✓ Live in AI Steering', color: '#1a7a3e' },
  marked_for_tpt: { label: '🏷 Marked for TPT', color: '#7a3c8a' },
  tpt_package_ready: { label: '📦 TPT Package Ready', color: '#7a3c8a' },
  published_tpt: { label: '✓ Published on TPT', color: '#1a7a3e' },
};

export default function FromLessonPlannerPage() {
  const [userId, setUserId] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
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
    fetch(`/api/style-lab/resources?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setResources((d.resources || []).filter((r) => r.source_app === 'lesson-planner')))
      .finally(() => setLoading(false));
  }, [userId]);

  async function pushToSteering(r) {
    setBusyId(r.id);
    setError(null);
    try {
      const res = await fetch('/api/style-lab/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: r.id, action: 'push_to_steering' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'pushed_to_steering' } : x)));
    } catch (e) {
      setError(`Couldn't push "${r.title}" to AI Steering: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  const pdfs = resources.filter((r) => r.source_type === 'pdf');
  const urls = resources.filter((r) => r.source_type === 'url');

  function Section({ title, items, icon }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1c3557', marginBottom: 10 }}>
          {icon} {title} ({items.length})
        </h2>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Nothing here yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((r) => {
              const statusInfo = STATUS_LABELS[r.status] || STATUS_LABELS.raw;
              const alreadyPushed = r.status === 'pushed_to_steering';
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#fff', border: '1px solid #e3ddd0', borderRadius: 8, padding: '10px 14px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1c3557', margin: 0 }}>{r.title}</p>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 2 }}>
                      {(r.subject || r.unit_name) && (
                        <span style={{ fontSize: 11, color: '#999' }}>{[r.subject, r.unit_name].filter(Boolean).join(' — ')}</span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 600, color: statusInfo.color }}>{statusInfo.label}</span>
                      {r.file_url && (
                        <a href={r.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2f6b41' }}>📄 View file</a>
                      )}
                      {r.source_url && (
                        <a href={r.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#888' }}>🔗 Original link</a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => pushToSteering(r)}
                    disabled={busyId === r.id || alreadyPushed}
                    style={{
                      padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                      background: alreadyPushed ? '#eef6f0' : '#b57c2a', color: alreadyPushed ? '#1a7a3e' : '#fff',
                      border: 'none', cursor: alreadyPushed ? 'default' : 'pointer',
                      opacity: busyId === r.id ? 0.6 : 1,
                    }}
                  >
                    {busyId === r.id ? 'Pushing…' : alreadyPushed ? '✓ In AI Steering' : '→ AI Steering'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1c3557', marginBottom: 4 }}>📚 From Lesson Planner</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Every PDF or URL an end user has uploaded in lesson-planner's Resources step lands here automatically.
        Push any of them straight into AI Steering, where they'll immediately start shaping future AI generation
        across the Chalk &amp; Circuit ecosystem.
      </p>
      {error && (
        <div style={{ background: '#fdecea', border: '1px solid #f3c2bb', borderRadius: 6, padding: 10, marginBottom: 16, fontSize: 12, color: '#a33' }}>
          {error}
        </div>
      )}
      <Section title="PDFs" items={pdfs} icon="📄" />
      <Section title="URLs" items={urls} icon="🔗" />
    </div>
  );
}
