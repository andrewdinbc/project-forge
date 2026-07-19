'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

// Side-by-side comparison tool for Gemini vs. Recraft on the exact use
// case that matters: clean, colorable line art (e.g. for a color-by-
// number). Composer's AI gap-fill can write the TEXT content of a color
// by number but can't draw the illustration -- this is that missing
// piece. Requires GEMINI_API_KEY and/or RECRAFT_API_KEY set in this
// project's Vercel environment variables (Aj's own accounts/billing with
// each provider -- Claude cannot create these). Aj, 2026-07-19.
//
// 2026-07-19: added optional reference image upload ("make it similar
// to...") -- passed to both providers as a style/content guide alongside
// the text prompt.
export default function DesignAssetsPage() {
  const [userId, setUserId] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState(null); // data URL
  const [referenceFileName, setReferenceFileName] = useState(null);
  const [generating, setGenerating] = useState({ gemini: false, recraft: false });
  const [results, setResults] = useState({ gemini: null, recraft: null });
  const [errors, setErrors] = useState({ gemini: null, recraft: null });
  const router = useRouter();

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user) { router.push('/auth/login'); return; }
        setUserId(user.id);
      })
      .catch(() => router.push('/auth/login'));
  }, [router]);

  function handleReferenceUpload(file) {
    if (!file) return;
    setReferenceFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setReferenceImage(reader.result);
    reader.readAsDataURL(file);
  }

  function clearReference() {
    setReferenceImage(null);
    setReferenceFileName(null);
  }

  async function generate(provider) {
    if (!prompt.trim() || !userId) return;
    setGenerating((prev) => ({ ...prev, [provider]: true }));
    setErrors((prev) => ({ ...prev, [provider]: null }));
    try {
      const res = await fetch('/api/design-assets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, prompt, provider, referenceImage: referenceImage || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults((prev) => ({ ...prev, [provider]: data.url }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [provider]: e.message }));
    } finally {
      setGenerating((prev) => ({ ...prev, [provider]: false }));
    }
  }

  function generateBoth() {
    generate('gemini');
    generate('recraft');
  }

  // Surfaces the two most common real errors with a plain-language
  // explanation instead of the raw API error text, since neither is a
  // bug to "fix" -- they're account/quota conditions on Aj's side.
  function friendlyError(raw) {
    if (!raw) return null;
    if (raw.includes('429') || raw.toLowerCase().includes('quota')) {
      return `${raw}\n\nThis is a rate/quota limit on your Gemini account, not a bug -- check your plan and billing at ai.google.dev, or wait for the quota to reset.`;
    }
    return raw;
  }

  function Panel({ provider, label }) {
    const isBusy = generating[provider];
    const url = results[provider];
    const error = errors[provider];
    return (
      <div style={{ flex: 1, minWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1c3557', margin: 0 }}>{label}</h3>
          <button
            onClick={() => generate(provider)}
            disabled={isBusy || !prompt.trim()}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e3ddd0', background: '#fff', color: '#1c3557', cursor: 'pointer', opacity: isBusy || !prompt.trim() ? 0.5 : 1 }}
          >
            {isBusy ? 'Generating…' : url ? 'Regenerate' : 'Generate'}
          </button>
        </div>
        <div style={{ border: '1px solid #e3ddd0', borderRadius: 8, background: '#f7f5f0', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          {isBusy && <p style={{ fontSize: 12, color: '#999' }}>Generating…</p>}
          {!isBusy && error && <p style={{ fontSize: 12, color: '#a33', padding: 12, textAlign: 'center', whiteSpace: 'pre-wrap' }}>{friendlyError(error)}</p>}
          {!isBusy && !error && url && (
            <img src={url} alt={`${label} output`} style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 4 }} />
          )}
          {!isBusy && !error && !url && <p style={{ fontSize: 12, color: '#bbb' }}>No image yet</p>}
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2f6b41', display: 'block', marginTop: 6 }}>
            Open full size ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1c3557', marginBottom: 4 }}>🎨 Design Assets (Gemini vs. Recraft)</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
        Compare Gemini and Recraft on generating clean, colorable line art -- the kind of illustration a
        color-by-number or coloring page needs. Both providers get the same prompt plus the same
        line-art style instructions, so it's an apples-to-apples comparison. Optionally upload a
        reference image to guide the style or content toward something specific.
      </p>
      <div style={{ background: '#eef4fb', border: '1px solid #c8dcf0', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 12, color: '#333' }}>
        Requires <code>GEMINI_API_KEY</code> and/or <code>RECRAFT_API_KEY</code> set in this project's
        Vercel environment variables. If a key isn't set, that panel will show an error explaining which
        one is missing.
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1c3557', marginBottom: 6 }}>
          Describe the illustration
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. A tug-of-war between two teams, illustrating balanced vs unbalanced forces"
            style={{ flex: 1, fontSize: 13, padding: '8px 10px', border: '1px solid #e3ddd0', borderRadius: 6, resize: 'none' }}
          />
          <button
            onClick={generateBoth}
            disabled={!prompt.trim() || generating.gemini || generating.recraft}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, borderRadius: 6, border: 'none', background: '#b57c2a', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', opacity: !prompt.trim() ? 0.5 : 1 }}
          >
            Generate Both
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1c3557', marginBottom: 6 }}>
          Reference image (optional) -- "make it similar to..."
        </label>
        {referenceImage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={referenceImage} alt="Reference" style={{ height: 60, width: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #e3ddd0' }} />
            <span style={{ fontSize: 12, color: '#555' }}>{referenceFileName}</span>
            <button onClick={clearReference} style={{ fontSize: 11, color: '#a33', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Remove
            </button>
          </div>
        ) : (
          <label style={{ display: 'inline-block', padding: '6px 14px', background: '#f0eee7', color: '#1c3557', border: '1px solid #e3ddd0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            📎 Upload a reference image
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleReferenceUpload(e.target.files?.[0])} />
          </label>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <Panel provider="gemini" label="Gemini (Nano Banana)" />
        <Panel provider="recraft" label="Recraft (vector line art)" />
      </div>
    </div>
  );
}
