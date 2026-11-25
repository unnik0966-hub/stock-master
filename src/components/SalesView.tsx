import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { ProductDTO, SaleDTO } from '../types/inventory.ts';
import { apiRequest } from '../utils/apiClient.ts';
import { exportSaleInvoicePdf } from '../utils/exportUtils.ts';
import { calculateSaleTotals, formatCurrency } from '../utils/inventoryMath.ts';
import { Modal } from './ui/Modal.tsx';

interface SalesViewProps {
  products: ProductDTO[];
  sales: SaleDTO[];
  onRefresh: () => Promise<void>;
}

interface OrderLineDraft {
  productId: string;
  quantity: number;
}

export function SalesView({ products, sales, onRefresh }: SalesViewProps) {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [inspectSale, setInspectSale] = useState<SaleDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableProducts = useMemo(
    () => products.filter((p) => p.quantity > 0),
    [products]
  );

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SaleDTO['paymentMethod']>('Card');
  const [status, setStatus] = useState<SaleDTO['status']>('Paid');
  const [taxRatePct, setTaxRatePct] = useState('8');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLineDraft[]>([]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const draftSummary = useMemo(() => {
    const detailed = lines.map((line) => {
      const prod = productMap.get(line.productId);
      const unitPrice = prod?.sellingPrice || 0;
      const available = prod?.quantity || 0;
      const insufficient = line.quantity > available;
      return {
        ...line,
        product: prod,
        unitPrice,
        available,
        insufficient,
        lineTotal: unitPrice * line.quantity,
      };
    });
    const totals = calculateSaleTotals(
      detailed.map((d) => ({ quantity: d.quantity, unitPrice: d.unitPrice })),
      Number(taxRatePct || 0) / 100
    );
    const hasStockError = detailed.some((d) => d.insufficient || d.quantity <= 0);
    return { detailed, totals, hasStockError };
  }, [lines, productMap, taxRatePct]);

  function openNewOrder() {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setPaymentMethod('Card');
    setStatus('Paid');
    setTaxRatePct('8');
    setNotes('');
    setLines(availableProducts[0] ? [{ productId: availableProducts[0].id, quantity: 1 }] : []);
    setBuilderOpen(true);
  }

  function addLine() {
    const unused = availableProducts.find((p) => !lines.some((l) => l.productId === p.id));
    const fallback = unused || availableProducts[0];
    if (!fallback) return;
    setLines((prev) => [...prev, { productId: fallback.id, quantity: 1 }]);
  }

  function updateLine(index: number, patch: Partial<OrderLineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      showToast('Add at least one line item.', 'error');
      return;
    }
    if (draftSummary.hasStockError) {
      showToast('One or more items exceed available stock.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiRequest<SaleDTO>('/sales', {
        method: 'POST',
        token,
        body: {
          customerName,
          customerEmail,
          customerPhone,
          paymentMethod,
          status,
          taxRate: Number(taxRatePct || 0) / 100,
          notes,
          items: lines,
        },
      });
      showToast(`Invoice ${created.invoiceNumber} created and stock deducted.`, 'success');
      setBuilderOpen(false);
      setInspectSale(created);
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Order checkout failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePaid(sale: SaleDTO) {
    const nextStatus = sale.status === 'Paid' ? 'Pending' : 'Paid';
    try {
      const updated = await apiRequest<SaleDTO>(`/sales/${sale.id}/status`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      });
      if (inspectSale?.id === updated.id) {
        setInspectSale(updated);
      }
      showToast(`Invoice ${updated.invoiceNumber} marked ${updated.status}.`, 'success');
      await onRefresh();
    } catch (err) {
      showToast((err as Error).message || 'Failed to update status.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Sales Orders &amp; Invoicing
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create multi-item customer orders with real-time stock validation and PDF invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewOrder}
          disabled={availableProducts.length === 0}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Sales Order
        </button>
      </div>

      {/* Sales Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {sales.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              No sales orders recorded yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Build your first customer invoice to deduct stock and track revenue.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                  <th className="py-3 px-6">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-6 font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleDateString('en-US')}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {sale.customerName}
                      </p>
                      {sale.customerEmail && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {sale.customerEmail}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {sale.items.reduce((sum, i) => sum + i.quantity, 0)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {sale.paymentMethod}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePaid(sale)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:underline"
                      >
                        {sale.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectSale(sale)}
                          aria-label={`View invoice ${sale.invoiceNumber}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSaleInvoicePdf(sale)}
                          aria-label={`Download PDF ${sale.invoiceNumber}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Order Builder Modal */}
      <Modal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title="New Sales Order"
        subtitle="Quantities are validated and deducted atomically upon invoice creation."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCheckout} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer / Company
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Cascade Logistics LLC"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Email
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="ap@customer.com"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+1 (555) 210-8840"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Order Line Items
              </h3>
              <button
                type="button"
                onClick={addLine}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Line
              </button>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {draftSummary.detailed.map((line, index) => (
                <div
                  key={index}
                  className="p-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50/50 dark:bg-slate-950/50"
                >
                  <select
                    value={line.productId}
                    onChange={(e) => updateLine(index, { productId: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} ({formatCurrency(p.sellingPrice)} · Avail: {p.quantity})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        max={line.available}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                        aria-label="Quantity"
                        className={`w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-900 border ${
                          line.insufficient
                            ? 'border-red-500 text-red-600'
                            : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                        }`}
                      />
                    </div>
                    <div className="w-24 text-right font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(line.lineTotal)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      aria-label="Remove item"
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment & Tax */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as SaleDTO['paymentMethod'])
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Invoice Net-30">Invoice Net-30</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SaleDTO['status'])}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={taxRatePct}
                onChange={(e) => setTaxRatePct(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Order Summary */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Order Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Shipping dock instructions..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="w-full sm:w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(draftSummary.totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tax ({taxRatePct || 0}%)</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(draftSummary.totals.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-base text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(draftSummary.totals.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || draftSummary.hasStockError || lines.length === 0}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white cursor-pointer"
            >
              {submitting ? 'Processing...' : 'Complete Order & Deduct Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        open={Boolean(inspectSale)}
        onClose={() => setInspectSale(null)}
        title={inspectSale ? `Invoice ${inspectSale.invoiceNumber}` : 'Invoice'}
        subtitle={
          inspectSale
            ? `${new Date(inspectSale.createdAt).toLocaleString('en-US')} · ${inspectSale.paymentMethod}`
            : undefined
        }
        maxWidth="max-w-2xl"
      >
        {inspectSale && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Billed To</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {inspectSale.customerName}
                </p>
                {inspectSale.customerEmail && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {inspectSale.customerEmail}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => exportSaleInvoicePdf(inspectSale)}
                className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>

            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {inspectSale.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {item.productName}
                      </p>
                      <p className="font-mono text-xs text-slate-500">{item.sku}</p>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-medium">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="w-56 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(inspectSale.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax ({(inspectSale.taxRate * 100).toFixed(1)}%)</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(inspectSale.taxAmount)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-base text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(inspectSale.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
