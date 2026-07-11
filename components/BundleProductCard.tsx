'use client';

import React from 'react';
import { Product } from '@/types/product';

interface BundleProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  isInBundle: boolean;
}

export default function BundleProductCard({ product, onAdd, isInBundle }: BundleProductCardProps) {
  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {product.imageUrl && (
        <div className="w-full h-32 bg-slate-100 overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">
          {product.title}
        </h3>
        <p className="text-xs text-slate-600 mb-3 line-clamp-2">
          {product.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">
            ${product.price.toFixed(2)}
          </span>
          <button
            onClick={() => onAdd(product)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isInBundle
                ? 'bg-green-100 text-green-700 cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isInBundle ? '✓ Added' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
