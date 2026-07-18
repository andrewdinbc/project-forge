'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createProduct } from '@/lib/products';
import { supabase } from '@/lib/supabase';

// This page didn't exist before (2026-07-18) -- "New Product" linked here
// from the Products list but the route was 404. Products.js and the
// database layer were always real; what was missing was an actual way to
// create a product and upload its PDF file, which is why file_url was
// always empty and the composer/component-tagger had nothing to work with.

export default function NewProductPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const user = await getCurrentUser();
      if (!user) { router.push('/auth/login'); return; }

      let file_url = null;
      if (file) {
        if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported right now.');
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('product-files').upload(path, file, {
          contentType: 'application/pdf',
          upsert: false,
        });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
        file_url = urlData.publicUrl;
      }

      const product = await createProduct(user.id, {
        title: title.trim(),
        description: description.trim() || null,
        resource_type: resourceType || null,
        subject: subject || null,
        grade_level: gradeLevel ? gradeLevel.split(',').map((g) => g.trim()).filter(Boolean) : [],
        price_usd: priceUsd ? parseFloat(priceUsd) : 0,
        file_url,
        status: 'draft',
      });

      router.push(`/dashboard/products/${product.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">New Product</h1>
        <p className="text-slate-600 mt-1">Add a product to your catalog -- you can tag its components and use it in bundles once it has a file.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="e.g. Grade 5 Fractions Task Cards"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Resource Type</label>
            <input
              value={resourceType} onChange={(e) => setResourceType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="e.g. Task Cards, Worksheet"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input
              value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="e.g. Mathematics"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grade Level(s)</label>
            <input
              value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="e.g. 5, 6"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price (USD)</label>
            <input
              type="number" step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">PDF File (optional -- add now or later)</label>
          <input
            type="file" accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
          <p className="text-xs text-slate-500 mt-1">Required before you can tag components or use this product in the Composer.</p>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creating…' : 'Create Product'}
          </button>
          <button type="button" onClick={() => router.push('/dashboard/products')} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
