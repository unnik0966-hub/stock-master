import React, { useMemo, useState } from 'react';
import { ChevronRight, Edit2, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { CategoryDTO, ProductDTO } from '../types/inventory.ts';
import { apiRequest } from '../utils/apiClient.ts';
import { computeStockStatus, formatCurrency } from '../utils/inventoryMath.ts';
import { Modal } from './ui/Modal.tsx';
import { ProductImage } from './ui/ProductImage.tsx';
import { StockStatusLabel } from './ui/StockStatusLabel.tsx';

interface CategoriesViewProps {
  categories: CategoryDTO[];
  products: ProductDTO[];
  onRefresh: () => Promise<void>;
}

export function CategoriesView({ categories, products, onRefresh }: CategoriesViewProps) {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  const categoryStats = useMemo(() => {
    return categories.map((cat) => {
      const catProducts = products.filter((p) => p.categoryId === cat.id);
      const totalUnits = catProducts.reduce((sum, p) => sum + p.quantity, 0);
      const valuation = catProducts.reduce((sum, p) => sum + p.quantity * p.costPrice, 0);
      return {
        category: cat,
        skuCount: catProducts.length,
        totalUnits,
        valuation,
        products: catProducts,
      };
    });
  }, [categories, products]);

  const activeCategory =
    categoryStats.find((s) => s.category.id === selectedCategoryId) || categoryStats[0] || null;

  function openCreate() {
    setEditing(null);
    setForm({ name: '', code: '', description: '' });
    setModalOpen(true);
  }

  function openEdit(cat: CategoryDTO) {
    setEditing(cat);
    setForm({ name: cat.name, code: cat.code, description: cat.description });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/categories/${editing.id}`, {
          method: 'PATCH',
          token,
          body: form,
        });
        showToast('Category updated.', 'success');
      } else {
        const created = await apiRequest<CategoryDTO>('/categories', {
          method: 'POST',
          token,
          body: form,
        });
        setSelectedCategoryId(created.id);
        showToast('Category created.', 'success');
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Failed to save category.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: CategoryDTO) {
    try {
      await apiRequest(`/categories/${cat.id}`, {
        method: 'DELETE',
        token,
      });
      showToast(`Deleted category "${cat.name}".`, 'success');
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Cannot delete category.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Product Categories
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select a category to inspect assigned SKUs, stock units, and cost valuation.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Category
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {categoryStats.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No categories configured yet.
            </div>
          ) : (
            categoryStats.map(({ category, skuCount, totalUnits, valuation }) => {
              const isSelected = activeCategory?.category.id === category.id;
              return (
                <div
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCategoryId(category.id);
                    }
                  }}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {category.code}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {category.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {skuCount} SKUs · {totalUnits} units · {formatCurrency(valuation)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      className="p-1.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(category)}
                        aria-label={`Delete ${category.name}`}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Drill-Down */}
        <div className="lg:col-span-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          {!activeCategory ? (
            <div className="p-12 text-center">
              <FolderTree className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Select a category to inspect products.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                      {activeCategory.category.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeCategory.category.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(activeCategory.valuation)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cost Valuation</p>
                  </div>
                </div>
              </div>

              {activeCategory.products.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No products are assigned to this category yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-6">Product</th>
                        <th className="py-2.5 px-4">SKU</th>
                        <th className="py-2.5 px-4 text-right">Stock</th>
                        <th className="py-2.5 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {activeCategory.products.map((prod) => (
                        <tr key={prod.id}>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-3">
                              <ProductImage
                                src={prod.imageUrl}
                                alt={prod.name}
                                className="w-8 h-8 rounded-md"
                              />
                              <span className="font-medium text-slate-900 dark:text-white">
                                {prod.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {prod.sku}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            {prod.quantity} {prod.unit}
                          </td>
                          <td className="py-3 px-6">
                            <StockStatusLabel
                              status={computeStockStatus(prod.quantity, prod.reorderLevel)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'New Category'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Barcode & RFID Hardware"
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              SKU Prefix Code (2–8 chars)
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={8}
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="SCAN"
              className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
