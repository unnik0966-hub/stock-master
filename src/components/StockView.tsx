import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type {
  MovementType,
  ProductDTO,
  StockMovementDTO,
  SupplierDTO,
} from '../types/inventory.ts';
import { apiRequest } from '../utils/apiClient.ts';
import { calculateSuggestedReorderQty, computeStockStatus } from '../utils/inventoryMath.ts';
import { Modal } from './ui/Modal.tsx';
import { ProductImage } from './ui/ProductImage.tsx';
import { StockStatusLabel } from './ui/StockStatusLabel.tsx';

interface StockViewProps {
  products: ProductDTO[];
  suppliers: SupplierDTO[];
  movements: StockMovementDTO[];
  preselectedRestock: ProductDTO | null;
  onClearPreselect: () => void;
  onRefresh: () => Promise<void>;
}

export function StockView({
  products,
  suppliers,
  movements,
  preselectedRestock,
  onClearPreselect,
  onRefresh,
}: StockViewProps) {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'ledger' | 'alerts'>('ledger');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MovementType>('ALL');
  const [modalOpen, setModalOpen] = useState(Boolean(preselectedRestock));
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    productId: preselectedRestock?.id || products[0]?.id || '',
    type: 'IN' as MovementType,
    quantity: preselectedRestock
      ? String(Math.max(1, calculateSuggestedReorderQty(preselectedRestock.quantity, preselectedRestock.reorderLevel)))
      : '10',
    supplierId: preselectedRestock?.supplierId || suppliers[0]?.id || '',
    reference: preselectedRestock ? `PO-${new Date().getFullYear()}-RESTOCK` : `MOV-${Date.now().toString().slice(-5)}`,
    notes: preselectedRestock ? 'Replenishment triggered from low-stock alert.' : '',
  });

  React.useEffect(() => {
    if (preselectedRestock) {
      setForm({
        productId: preselectedRestock.id,
        type: 'IN',
        quantity: String(
          Math.max(
            1,
            calculateSuggestedReorderQty(preselectedRestock.quantity, preselectedRestock.reorderLevel)
          )
        ),
        supplierId: preselectedRestock.supplierId,
        reference: `PO-${new Date().getFullYear()}-${String(movements.length + 850)}`,
        notes: 'Replenishment triggered from low-stock watchlist.',
      });
      setModalOpen(true);
      onClearPreselect();
    }
  }, [preselectedRestock, movements.length, onClearPreselect]);

  const lowStockItems = useMemo(
    () =>
      products
        .filter((p) => computeStockStatus(p.quantity, p.reorderLevel) !== 'in_stock')
        .sort((a, b) => a.quantity - b.quantity),
    [products]
  );

  const filteredMovements = useMemo(() => {
    if (typeFilter === 'ALL') return movements;
    return movements.filter((m) => m.type === typeFilter);
  }, [movements, typeFilter]);

  function openMovementModal(presetType: MovementType, product?: ProductDTO) {
    const targetProduct = product || products[0];
    setForm({
      productId: targetProduct?.id || '',
      type: presetType,
      quantity:
        presetType === 'IN' && targetProduct
          ? String(
              Math.max(
                5,
                calculateSuggestedReorderQty(targetProduct.quantity, targetProduct.reorderLevel)
              )
            )
          : '1',
      supplierId: targetProduct?.supplierId || suppliers[0]?.id || '',
      reference:
        presetType === 'IN'
          ? `PO-${new Date().getFullYear()}-${String(movements.length + 850)}`
          : `ADJ-${Date.now().toString().slice(-5)}`,
      notes: '',
    });
    setModalOpen(true);
  }

  async function handleSubmitMovement(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/stock', {
        method: 'POST',
        token,
        body: {
          productId: form.productId,
          type: form.type,
          quantity: Number(form.quantity),
          supplierId: form.type === 'IN' ? form.supplierId : '',
          reference: form.reference,
          notes: form.notes,
        },
      });
      showToast('Stock movement committed to ledger.', 'success');
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Failed to record stock movement.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === form.productId);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'ledger'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Movement Ledger ({movements.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('alerts')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'alerts'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Low-Stock Alerts ({lowStockItems.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openMovementModal('OUT')}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
            Record Stock Out
          </button>
          <button
            type="button"
            onClick={() => openMovementModal('IN')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Stock In
          </button>
        </div>
      </div>

      {tab === 'ledger' ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Atomic Stock Movement Ledger
            </h3>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['ALL', 'IN', 'OUT', 'ADJUSTMENT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    typeFilter === t
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t === 'ALL' ? 'All' : t === 'IN' ? 'Stock In' : t === 'OUT' ? 'Stock Out' : 'Adjusted'}
                </button>
              ))}
            </div>
          </div>

          {filteredMovements.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No movements matching the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-900/50">
                    <th className="py-3 px-6">Timestamp</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Delta</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4">Reference / Vendor</th>
                    <th className="py-3 px-6">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredMovements.map((mov) => (
                    <tr
                      key={mov.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-6 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(mov.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {mov.productName}
                        </p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {mov.sku}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {mov.type === 'IN' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            Stock In
                          </span>
                        ) : mov.type === 'OUT' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            Stock Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Adjustment
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {mov.type === 'IN' ? (
                          <span className="text-emerald-700 dark:text-emerald-400">+{mov.quantity}</span>
                        ) : mov.type === 'OUT' ? (
                          <span className="text-red-700 dark:text-red-400">-{mov.quantity}</span>
                        ) : (
                          <span className="text-blue-700 dark:text-blue-400">={mov.newQuantity}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {mov.previousQuantity} → <strong className="text-slate-900 dark:text-white">{mov.newQuantity}</strong>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono text-xs text-slate-800 dark:text-slate-200">
                          {mov.reference}
                        </p>
                        {(mov.supplierName || mov.notes) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            {mov.supplierName || mov.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-6 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {mov.performedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Low-Stock &amp; Replenishment Queue
            </h3>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Healthy Stock Levels
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Every SKU in inventory currently exceeds its minimum reorder level.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-6">Product</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Current</th>
                    <th className="py-3 px-4 text-right">Reorder Min</th>
                    <th className="py-3 px-4 text-right">Suggested Order</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {lowStockItems.map((item) => {
                    const suggested = calculateSuggestedReorderQty(item.quantity, item.reorderLevel);
                    return (
                      <tr key={item.id}>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-9 h-9 rounded-lg"
                            />
                            <span className="font-medium text-slate-900 dark:text-white">
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {item.reorderLevel}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                          +{suggested} {item.unit}
                        </td>
                        <td className="py-3 px-4">
                          <StockStatusLabel
                            status={computeStockStatus(item.quantity, item.reorderLevel)}
                          />
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => openMovementModal('IN', item)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
                          >
                            One-Click Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Stock Movement"
        subtitle={
          selectedProduct
            ? `Current on-hand balance: ${selectedProduct.quantity} ${selectedProduct.unit}`
            : undefined
        }
      >
        <form onSubmit={handleSubmitMovement} className="space-y-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'IN', label: 'Stock In (+)' },
                { id: 'OUT', label: 'Stock Out (-)' },
                { id: 'ADJUSTMENT', label: 'Set Exact Count' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setForm((p) => ({ ...p, type: opt.id }))}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  form.type === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Product
            </label>
            <select
              required
              value={form.productId}
              onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (On hand: {p.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {form.type === 'ADJUSTMENT' ? 'New Exact Quantity' : 'Quantity'}
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reference / PO #
              </label>
              <input
                type="text"
                required
                value={form.reference}
                onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {form.type === 'IN' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Receiving Supplier
              </label>
              <select
                value={form.supplierId}
                onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Internal / Transfer</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notes / Audit Reason
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Receiving dock inspection notes or damage adjustment details..."
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
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Committing...' : 'Commit Movement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
