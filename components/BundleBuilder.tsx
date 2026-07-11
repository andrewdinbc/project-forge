'use client';

import React, { useState, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Product } from '@/types/product';
import BundleProductCard from './BundleProductCard';
import BundlePreview from './BundlePreview';
import BundleExportDialog from './BundleExportDialog';

interface BundledProduct extends Product {
  bundleId: string;
  quantity: number;
}

export default function BundleBuilder() {
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [bundledProducts, setBundledProducts] = useState<BundledProduct[]>([]);
  const [bundleName, setBundleName] = useState('My Bundle');
  const [bundleDescription, setBundleDescription] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    fetchAvailableProducts();
  }, []);

  const fetchAvailableProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setAvailableProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAddProduct = useCallback((product: Product) => {
    const bundledProduct: BundledProduct = {
      ...product,
      bundleId: `${product.id}-${Date.now()}`,
      quantity: 1,
    };
    setBundledProducts((prev) => [...prev, bundledProduct]);
  }, []);

  const handleRemoveProduct = useCallback((bundleId: string) => {
    setBundledProducts((prev) => prev.filter((p) => p.bundleId !== bundleId));
  }, []);

  const handleUpdateQuantity = useCallback((bundleId: string, quantity: number) => {
    setBundledProducts((prev) =>
      prev.map((p) => (p.bundleId === bundleId ? { ...p, quantity: Math.max(1, quantity) } : p))
    );
  }, []);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = bundledProducts.findIndex((p) => p.bundleId === active.id);
      const newIndex = bundledProducts.findIndex((p) => p.bundleId === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setBundledProducts((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  const totalPrice = bundledProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Bundle Builder</h1>
          <p className="text-slate-600">Create custom product bundles with drag-and-drop ordering</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Products */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Available Products</h2>

              {isLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-48 bg-slate-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : availableProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
                  {availableProducts.map((product) => (
                    <BundleProductCard
                      key={product.id}
                      product={product}
                      onAdd={handleAddProduct}
                      isInBundle={bundledProducts.some((p) => p.id === product.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p>No products available</p>
                </div>
              )}
            </div>
          </div>

          {/* Bundle Preview */}
          <div className="lg:col-span-1">
            <BundlePreview
              bundleName={bundleName}
              bundleDescription={bundleDescription}
              bundledProducts={bundledProducts}
              totalPrice={totalPrice}
              onBundleNameChange={setBundleName}
              onBundleDescriptionChange={setBundleDescription}
              onShowExportDialog={() => setShowExportDialog(true)}
            />
          </div>
        </div>

        {/* Bundle Products Editor */}
        {bundledProducts.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Bundle Contents</h2>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={bundledProducts.map((p) => p.bundleId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {bundledProducts.map((product) => (
                    <BundleProductItem
                      key={product.bundleId}
                      product={product}
                      onRemove={() => handleRemoveProduct(product.bundleId)}
                      onQuantityChange={(qty) => handleUpdateQuantity(product.bundleId, qty)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <BundleExportDialog
          bundleName={bundleName}
          bundleDescription={bundleDescription}
          bundledProducts={bundledProducts}
          totalPrice={totalPrice}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}

// Sub-component for bundled products with drag support
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function BundleProductItem({
  product,
  onRemove,
  onQuantityChange,
}: {
  product: BundledProduct;
  onRemove: () => void;
  onQuantityChange: (qty: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.bundleId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-4 bg-slate-50 rounded border border-slate-200 hover:border-slate-300 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </div>

      <div className="flex-1">
        <h3 className="font-medium text-slate-900">{product.title}</h3>
        <p className="text-sm text-slate-600">${product.price.toFixed(2)}</p>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Qty:</label>
        <input
          type="number"
          min="1"
          value={product.quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
          className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
        />
      </div>

      <button
        onClick={onRemove}
        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
      >
        Remove
      </button>
    </div>
  );
}
