import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  ImagePlus,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { CategoryDTO, ProductDTO, StockStatus, SupplierDTO } from '../types/inventory.ts';
import { apiRequest } from '../utils/apiClient.ts';
import { computeStockStatus, formatCurrency, generateSku } from '../utils/inventoryMath.ts';
import { Modal } from './ui/Modal.tsx';
import { ProductImage } from './ui/ProductImage.tsx';
import { StockStatusLabel } from './ui/StockStatusLabel.tsx';

interface ProductsViewProps {
  products: ProductDTO[];
  categories: CategoryDTO[];
  suppliers: SupplierDTO[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

type SortKey = 'name' | 'sku' | 'quantity' | 'sellingPrice' | 'costPrice';

const PAGE_SIZE = 8;

export function ProductsView({
  products,
  categories,
  suppliers,
  loading,
  onRefresh,
}: ProductsViewProps) {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState({
    name: '',
    sku: '',
    categoryId: categories[0]?.id || '',
    supplierId: suppliers[0]?.id || '',
    costPrice: '0',
    sellingPrice: '0',
    quantity: '0',
    reorderLevel: '5',
    unit: 'unit',
    location: 'Aisle A · Bin 01',
    imageUrl: '',
    description: '',
  });

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
        const status = computeStockStatus(p.quantity, p.reorderLevel);
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const mult = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'name' || sortKey === 'sku') {
          return a[sortKey].localeCompare(b[sortKey]) * mult;
        }
        return (a[sortKey] - b[sortKey]) * mult;
      });
  }, [products, search, categoryFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function openCreateModal() {
    const defaultCat = categories[0];
    const nextSeq = products.length + 1;
    setEditingProduct(null);
    setFormState({
      name: '',
      sku: defaultCat ? generateSku(defaultCat.code, nextSeq) : 'SM-GEN-0001',
      categoryId: defaultCat?.id || '',
      supplierId: suppliers[0]?.id || '',
      costPrice: '50',
      sellingPrice: '95',
      quantity: '20',
      reorderLevel: '8',
      unit: 'unit',
      location: 'Aisle A · Bin 01',
      imageUrl: '',
      description: '',
    });
    setModalOpen(true);
  }

  function openEditModal(product: ProductDTO) {
    setEditingProduct(product);
    setFormState({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      quantity: String(product.quantity),
      reorderLevel: String(product.reorderLevel),
      unit: product.unit,
      location: product.location,
      imageUrl: product.imageUrl || '',
      description: product.description || '',
    });
    setModalOpen(true);
  }

  function handleAutoGenerateSku() {
    const cat = categoryMap.get(formState.categoryId);
    const code = cat?.code || 'GEN';
    const catCount = products.filter((p) => p.categoryId === formState.categoryId).length + 1;
    setFormState((prev) => ({ ...prev, sku: generateSku(code, catCount + Math.floor(Math.random() * 90)) }));
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      showToast('Please select a PNG, JPEG, or WebP image.', 'error');
      return;
    }
    if (file.size > 1_500_000) {
      showToast('Image must be smaller than 1.5 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormState((prev) => ({ ...prev, imageUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingProduct) {
        await apiRequest(`/products/${editingProduct.id}`, {
          method: 'PATCH',
          token,
          body: {
            name: formState.name,
            sku: formState.sku,
            categoryId: formState.categoryId,
            supplierId: formState.supplierId,
            costPrice: Number(formState.costPrice),
            sellingPrice: Number(formState.sellingPrice),
            reorderLevel: Number(formState.reorderLevel),
            unit: formState.unit,
            location: formState.location,
            imageUrl: formState.imageUrl,
            description: formState.description,
          },
        });
        showToast('Product updated.', 'success');
      } else {
        await apiRequest('/products', {
          method: 'POST',
          token,
          body: {
            name: formState.name,
            sku: formState.sku,
            categoryId: formState.categoryId,
            supplierId: formState.supplierId,
            costPrice: Number(formState.costPrice),
            sellingPrice: Number(formState.sellingPrice),
            quantity: Number(formState.quantity),
            reorderLevel: Number(formState.reorderLevel),
            unit: formState.unit,
            location: formState.location,
            imageUrl: formState.imageUrl,
            description: formState.description,
          },
        });
        showToast('Product added to catalog.', 'success');
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Failed to save product.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product: ProductDTO) {
    try {
      await apiRequest(`/products/${product.id}`, {
        method: 'DELETE',
        token,
      });
      showToast(`Deleted ${product.name}.`, 'success');
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Unable to delete product.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by product name, SKU, or bin..."
              className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'in_stock', label: 'In Stock' },
                { id: 'low_stock', label: 'Low Stock' },
                { id: 'out_of_stock', label: 'Out' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Product Data Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : pagedProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              No matching products found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Adjust your search filters or add a new SKU to the catalog.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/60">
                  <th className="py-3 px-5">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Product
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('sku')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      SKU
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Category &amp; Supplier</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('costPrice')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Cost
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('sellingPrice')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Retail
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('quantity')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      On Hand
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {pagedProducts.map((product) => {
                  const category = categoryMap.get(product.categoryId);
                  const supplier = supplierMap.get(product.supplierId);
                  const status = computeStockStatus(product.quantity, product.reorderLevel);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate max-w-[230px]">
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[230px]">
                              {product.location}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {product.sku}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {category?.name || 'Uncategorized'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {supplier?.name || 'Unknown supplier'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {formatCurrency(product.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                        {formatCurrency(product.sellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {product.quantity}
                        </span>{' '}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {product.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StockStatusLabel status={status} />
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            aria-label={`Edit ${product.name}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user?.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(product)}
                              aria-label={`Delete ${product.name}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            Showing {pagedProducts.length} of {filteredProducts.length} SKUs
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono tabular-nums">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? `Edit Product — ${editingProduct.sku}` : 'Add New Product'}
        subtitle={
          editingProduct
            ? 'Stock quantities are adjusted via the Stock Management ledger for audit integrity.'
            : 'Create a new inventory SKU with initial stock balance.'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Product Name
              </label>
              <input
                type="text"
                required
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="ScanLink Pro 2D Wireless Scanner"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                required
                value={formState.categoryId}
                onChange={(e) => setFormState((prev) => ({ ...prev, categoryId: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Primary Supplier
              </label>
              <select
                required
                value={formState.supplierId}
                onChange={(e) => setFormState((prev) => ({ ...prev, supplierId: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                SKU Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formState.sku}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))
                  }
                  className="flex-1 px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAutoGenerateSku}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Warehouse Location
              </label>
              <input
                type="text"
                required
                value={formState.location}
                onChange={(e) => setFormState((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cost Price (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formState.costPrice}
                onChange={(e) => setFormState((prev) => ({ ...prev, costPrice: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Selling Price (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formState.sellingPrice}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, sellingPrice: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            {!editingProduct && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Initial Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formState.quantity}
                  onChange={(e) => setFormState((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reorder Alert Level
              </label>
              <input
                type="number"
                min="0"
                required
                value={formState.reorderLevel}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, reorderLevel: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                required
                value={formState.unit}
                onChange={(e) => setFormState((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="unit / case / box"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Product Image
              </label>
              <div className="flex items-center gap-4">
                <ProductImage
                  src={formState.imageUrl}
                  alt={formState.name || 'Product preview'}
                  className="w-16 h-16 rounded-lg"
                />
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <label className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap">
                    <ImagePlus className="w-4 h-4" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={formState.imageUrl}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, imageUrl: e.target.value }))
                    }
                    placeholder="Or paste HTTPS image URL..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={formState.description}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, description: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white cursor-pointer"
            >
              {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
