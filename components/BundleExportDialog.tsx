'use client';

import React, { useState } from 'react';

interface BundleExportDialogProps {
  bundleName: string;
  bundleDescription: string;
  bundledProducts: any[];
  totalPrice: number;
  onClose: () => void;
}

export default function BundleExportDialog({
  bundleName,
  bundleDescription,
  bundledProducts,
  totalPrice,
  onClose,
}: BundleExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<'pdf' | 'zip' | 'both'>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const response = await fetch('/api/bundles/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: exportFormat,
          bundleName,
          bundleDescription,
          bundledProducts,
          totalPrice,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bundleName.replace(/\s+/g, '-')}-bundle.${
        exportFormat === 'pdf' ? 'pdf' : 'zip'
      }`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Export Bundle</h2>

        {/* Format Selection */}
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-medium text-slate-700">Export Format</label>

          {['pdf', 'zip', 'both'].map((format) => (
            <label key={format} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="format"
                value={format}
                checked={exportFormat === format}
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'zip' | 'both')}
                className="w-4 h-4"
              />
              <span className="text-slate-700 capitalize font-medium">
                {format === 'pdf' && '📄 PDF Document'}
                {format === 'zip' && '📦 ZIP Archive'}
                {format === 'both' && '📄📦 Both PDF & ZIP'}
              </span>
            </label>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-slate-900 mb-2">{bundleName}</h3>
          <p className="text-sm text-slate-600 mb-3">{bundleDescription}</p>
          <div className="text-sm text-slate-600">
            <p>{bundledProducts.length} products • ${totalPrice.toFixed(2)}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
