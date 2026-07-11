'use client';

import React from 'react';

interface BundlePreviewProps {
  bundleName: string;
  bundleDescription: string;
  bundledProducts: any[];
  totalPrice: number;
  onBundleNameChange: (name: string) => void;
  onBundleDescriptionChange: (description: string) => void;
  onShowExportDialog: () => void;
}

export default function BundlePreview({
  bundleName,
  bundleDescription,
  bundledProducts,
  totalPrice,
  onBundleNameChange,
  onBundleDescriptionChange,
  onShowExportDialog,
}: BundlePreviewProps) {
  const itemCount = bundledProducts.reduce((sum, p) => sum + p.quantity, 0);
  const productCount = bundledProducts.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sticky top-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">Bundle Preview</h2>

      <div className="space-y-4">
        {/* Bundle Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bundle Name</label>
          <input
            type="text"
            value={bundleName}
            onChange={(e) => onBundleNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter bundle name"
          />
        </div>

        {/* Bundle Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={bundleDescription}
            onChange={(e) => onBundleDescriptionChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="Enter bundle description"
          />
        </div>

        {/* Stats */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Products:</span>
            <span className="font-medium text-slate-900">{productCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Total Items:</span>
            <span className="font-medium text-slate-900">{itemCount}</span>
          </div>
          <div className="h-px bg-slate-200 my-2" />
          <div className="flex justify-between text-lg">
            <span className="font-semibold text-slate-900">Total Price:</span>
            <span className="font-bold text-blue-600">${totalPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onShowExportDialog}
            disabled={bundledProducts.length === 0}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              bundledProducts.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            📥 Export Bundle
          </button>
        </div>

        {bundledProducts.length === 0 && (
          <p className="text-sm text-slate-500 text-center">Add products to create a bundle</p>
        )}
      </div>
    </div>
  );
}
