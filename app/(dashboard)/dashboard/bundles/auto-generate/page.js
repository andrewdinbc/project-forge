'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

// Curriculum-Driven Year Bundle Generator (2026-07-20). Front end for
// Layers A+B of docs/CURRICULUM_BUNDLE_GENERATION_SPEC.md: a teacher
// lists their units for the year, this plans + auto-generates a resource
// bundle from them using the existing worksheet generators. No storefront
// yet -- everything lands in Bundles as a draft for review. Manual unit
// entry for now; auto-pulling from lesson-planner's Unit Priorities is
// the natural next step once this half is proven out.

const SUBJECTS = [
  'English Language Arts', 'Mathematics', 'Science', 'Social Studies',
  'Applied Design, Skills, and Technologies', 'Arts Education',
  'Physical Education', 'Health & Career Education', 'French',
];
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const STATUS_COLORS = {
  pending: '#999', running: '#a06b1f', done: '#1a7a3e', failed: '#c0392b', skipped: '#888',
};

function emptyUnit() { return { subject: 'English Language Arts', grade: '4', topic: '', unitLabel: '' }; }

export default function AutoGenerateBundlePage() {
  const [userId, setUserId] = useState(null);
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState([emptyUnit()]);
  const [error, setError] = useState(null);
  const [bundleId, setBundleId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [counts, setCounts] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const pollRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((u) => { if (!u) router.push('/auth/login'); else setUserId(u.id); }).catch(() => router.push('/auth/login'));
  }, [router]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function updateUnit(i, patch) {
    setUnits((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));
  }
  function addUnit() { setUnits((prev) => [...prev, emptyUnit()]); }
  function removeUnit(i) { setUnits((prev) => prev.filter((_, idx) => idx !== i)); }

  async function fetchStatus(id) {
    const res = await fetch(`/api/bundles/auto-generate/status?bundleId=${id}&userId=${userId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setJobs(data.jobs);
    setCounts(data.counts);
    return data;
  }

  async function runProcessLoop(id) {
    setProcessing(true);
    pollRef.current = setInterval(async () => {
      try {
        await fetch('/api/bundles/auto-generate/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, bundleId: id, batchSize: 3 }),
        });
        const status = await fetchStatus(id);
        if (status.complete) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setProcessing(false);
        }
      } catch (e) {
        setError(e.message);
        clearInterval(pollRef.current);
        pollRef.current = null;
        setProcessing(false);
      }
    }, 2500);
  }

  async function startGeneration() {
    setError(null);
    setPlanning(true);
    try {
      const cleanUnits = units.filter((u) => u.topic.trim() || u.unitLabel.trim());
      if (!cleanUnits.length) throw new Error('Add at least one unit with a topic or label.');
      const res = await fetch('/api/bundles/auto-generate/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, units: cleanUnits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBundleId(data.bundleId);
      await fetchStatus(data.bundleId);
      runProcessLoop(data.bundleId);
    } catch (e) {
      setError(e.message);
    } finally {
      setPlanning(false);
    }
  }

  if (!userId) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1c3557', marginBottom: 4 }}>📦 Curriculum → Year Bundle Generator</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        List your units for the year — subject, grade, and topic — and this will auto-generate a
        matching set of resources for each one (vocabulary lists, word searches, flashcards,
        reading passages, math practice) using the generators already in Project Forge, and
        assemble them into one bundle. Lands as a draft in Bundles — nothing is sold from here yet.
      </p>

      {error && (
        <div style={{ background: '#fdecea', border: '1px solid #f3c2bb', borderRadius: 6, padding: 10, marginBottom: 16, fontSize: 12, color: '#a33' }}>{error}</div>
      )}

      {!bundleId && (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bundle title (e.g. Grade 4 — Full Year Bundle)"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e3ddd0', fontSize: 13, marginBottom: 16 }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {units.map((u, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', border: '1px solid #e3ddd0', borderRadius: 8, padding: 10 }}>
                <select value={u.subject} onChange={(e) => updateUnit(i, { subject: e.target.value })} style={{ fontSize: 12, padding: 6, borderRadius: 6, border: '1px solid #e3ddd0', flex: '0 0 190px' }}>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={u.grade} onChange={(e) => updateUnit(i, { grade: e.target.value })} style={{ fontSize: 12, padding: 6, borderRadius: 6, border: '1px solid #e3ddd0', flex: '0 0 64px' }}>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <input
                  value={u.unitLabel}
                  onChange={(e) => updateUnit(i, { unitLabel: e.target.value })}
                  placeholder="Unit label (e.g. Unit 3)"
                  style={{ fontSize: 12, padding: 6, borderRadius: 6, border: '1px solid #e3ddd0', flex: '0 0 150px' }}
                />
                <input
                  value={u.topic}
                  onChange={(e) => updateUnit(i, { topic: e.target.value })}
                  placeholder="Topic (optional — pulls from curriculum if blank)"
                  style={{ fontSize: 12, padding: 6, borderRadius: 6, border: '1px solid #e3ddd0', flex: 1 }}
                />
                <button onClick={() => removeUnit(i)} disabled={units.length === 1} style={{ background: 'none', border: 'none', color: '#a33', cursor: 'pointer', fontSize: 16, opacity: units.length === 1 ? 0.3 : 1 }}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addUnit} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#f7f5f0', border: '1px solid #e3ddd0', color: '#1c3557', cursor: 'pointer' }}>
              + Add Unit
            </button>
            <button onClick={startGeneration} disabled={planning} style={{ padding: '8px 20px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#b57c2a', border: 'none', color: '#fff', cursor: 'pointer', opacity: planning ? 0.6 : 1 }}>
              {planning ? 'Planning…' : 'Generate Bundle'}
            </button>
          </div>
        </>
      )}

      {bundleId && (
        <div>
          <div style={{ marginBottom: 14, fontSize: 13, color: '#1c3557', fontWeight: 600 }}>
            {counts && `${counts.done} done · ${counts.running} running · ${counts.pending} pending · ${counts.failed} failed · ${counts.skipped} skipped`}
            {!processing && counts && counts.pending === 0 && counts.running === 0 && ' — complete.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {jobs.map((j) => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e3ddd0', borderRadius: 6, padding: '8px 12px' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1c3557' }}>{j.generator_key}</span>
                  <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>{j.unit_label || j.subject}{j.grade ? ` · Gr ${j.grade}` : ''}</span>
                  {j.error && <div style={{ fontSize: 10, color: '#c0392b', marginTop: 2 }}>{j.error}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[j.status] || '#999', textTransform: 'uppercase' }}>{j.status}</span>
              </div>
            ))}
          </div>
          {!processing && counts && counts.pending === 0 && counts.running === 0 && (
            <a href="/dashboard/bundles" style={{ display: 'inline-block', marginTop: 16, fontSize: 12, color: '#2f6b41', textDecoration: 'underline' }}>→ Review this bundle in Bundles</a>
          )}
        </div>
      )}
    </div>
  );
}
