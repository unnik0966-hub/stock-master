import React, { useMemo, useState } from 'react';
import { Building2, Edit2, Mail, MapPin, Phone, Plus, Trash2, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { ProductDTO, StockMovementDTO, SupplierDTO } from '../types/inventory.ts';
import { apiRequest } from '../utils/apiClient.ts';
import { Modal } from './ui/Modal.tsx';

interface SuppliersViewProps {
  suppliers: SupplierDTO[];
  products: ProductDTO[];
  movements: StockMovementDTO[];
  onRefresh: () => Promise<void>;
}

export function SuppliersView({
  suppliers,
  products,
  movements,
  onRefresh,
}: SuppliersViewProps) {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [selectedId, setSelectedId] = useState<string>(suppliers[0]?.id || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    leadTimeDays: '5',
  });

  const activeSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedId) || suppliers[0] || null,
    [suppliers, selectedId]
  );

  const inboundHistory = useMemo(() => {
    if (!activeSupplier) return [];
    return movements.filter((m) => m.type === 'IN' && m.supplierId === activeSupplier.id);
  }, [movements, activeSupplier]);

  const linkedProducts = useMemo(() => {
    if (!activeSupplier) return [];
    return products.filter((p) => p.supplierId === activeSupplier.id);
  }, [products, activeSupplier]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      leadTimeDays: '5',
    });
    setModalOpen(true);
  }

  function openEdit(sup: SupplierDTO) {
    setEditing(sup);
    setForm({
      name: sup.name,
      contactPerson: sup.contactPerson,
      email: sup.email,
      phone: sup.phone,
      address: sup.address,
      leadTimeDays: String(sup.leadTimeDays),
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        leadTimeDays: Number(form.leadTimeDays),
      };
      if (editing) {
        await apiRequest(`/suppliers/${editing.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
        showToast('Supplier updated.', 'success');
      } else {
        const created = await apiRequest<SupplierDTO>('/suppliers', {
          method: 'POST',
          token,
          body: payload,
        });
        setSelectedId(created.id);
        showToast('Supplier added.', 'success');
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Failed to save supplier.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sup: SupplierDTO) {
    try {
      await apiRequest(`/suppliers/${sup.id}`, { method: 'DELETE', token });
      showToast(`Removed supplier "${sup.name}".`, 'success');
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Cannot remove supplier.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Vendor &amp; Supplier Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Inspect vendor contact details, lead times, linked SKUs, and inbound purchase history.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Vendor List */}
        <div className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {suppliers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No suppliers registered.</div>
          ) : (
            suppliers.map((sup) => {
              const isSelected = activeSupplier?.id === sup.id;
              const skuCount = products.filter((p) => p.supplierId === sup.id).length;
              return (
                <div
                  key={sup.id}
                  onClick={() => setSelectedId(sup.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(sup.id);
                    }
                  }}
                  className={`p-4 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {sup.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {sup.contactPerson} · {sup.leadTimeDays}d lead · {skuCount} SKUs
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEdit(sup)}
                      aria-label={`Edit ${sup.name}`}
                      className="p-1.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(sup)}
                        aria-label={`Delete ${sup.name}`}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Supplier Details + Inbound History */}
        <div className="lg:col-span-7 space-y-6">
          {!activeSupplier ? (
            <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <Truck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Select a supplier to inspect details.</p>
            </div>
          ) : (
            <>
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Primary Vendor</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{activeSupplier.leadTimeDays} day lead time</span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mt-1">
                      {activeSupplier.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
                      {linkedProducts.length}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Supplied SKUs</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 text-sm">
                  <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{activeSupplier.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-mono">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{activeSupplier.phone}</span>
                  </div>
                  <div className="sm:col-span-2 flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{activeSupplier.address}</span>
                  </div>
                </div>
              </div>

              {/* Inbound Purchase History */}
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Inbound Purchase History
                  </h4>
                </div>
                {inboundHistory.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No inbound restock receipts recorded for this vendor yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 px-6">Date</th>
                          <th className="py-2.5 px-4">Product</th>
                          <th className="py-2.5 px-4 text-right">Qty In</th>
                          <th className="py-2.5 px-6 text-right">PO Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        {inboundHistory.map((mov) => (
                          <tr key={mov.id}>
                            <td className="py-2.5 px-6 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {new Date(mov.createdAt).toLocaleDateString('en-US')}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                              {mov.productName}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                              +{mov.quantity}
                            </td>
                            <td className="py-2.5 px-6 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                              {mov.reference}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                required
                value={form.contactPerson}
                onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Lead Time (Days)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={form.leadTimeDays}
                onChange={(e) => setForm((p) => ({ ...p, leadTimeDays: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Warehouse / Billing Address
              </label>
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
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
              {saving ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
