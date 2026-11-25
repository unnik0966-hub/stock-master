import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryDTO, ProductDTO, SaleDTO } from '../types/inventory.ts';
import { exportReportPdf, exportToCsv } from '../utils/exportUtils.ts';
import {
  calculateInventoryValuation,
  calculateSuggestedReorderQty,
  computeStockStatus,
  formatCurrency,
  roundCurrency,
} from '../utils/inventoryMath.ts';

interface ReportsViewProps {
  products: ProductDTO[];
  categories: CategoryDTO[];
  sales: SaleDTO[];
}

type ReportTab = 'sales' | 'valuation' | 'low_stock';
type SalesPeriod = 'daily' | 'weekly' | 'monthly';

export function ReportsView({ products, categories, sales }: ReportsViewProps) {
  const [reportTab, setReportTab] = useState<ReportTab>('sales');
  const [period, setPeriod] = useState<SalesPeriod>('monthly');

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const valuationSummary = useMemo(() => calculateInventoryValuation(products), [products]);

  const salesGrouped = useMemo(() => {
    const map = new Map<string, { label: string; orders: number; revenue: number; profit: number }>();

    for (const sale of sales) {
      const d = new Date(sale.createdAt);
      let key = '';
      let label = '';

      if (period === 'daily') {
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (period === 'weekly') {
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        key = start.toISOString().slice(0, 10);
        label = `Wk ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      const cost = sale.items.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
      const profit = roundCurrency(sale.subtotal - cost);
      const current = map.get(key) || { label, orders: 0, revenue: 0, profit: 0 };
      current.orders += 1;
      current.revenue = roundCurrency(current.revenue + sale.total);
      current.profit = roundCurrency(current.profit + profit);
      map.set(key, current);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [sales, period]);

  const lowStockRows = useMemo(
    () =>
      products
        .filter((p) => computeStockStatus(p.quantity, p.reorderLevel) !== 'in_stock')
        .sort((a, b) => a.quantity - b.quantity),
    [products]
  );

  function handleExportCsv() {
    if (reportTab === 'sales') {
      exportToCsv(
        `stockmaster-sales-${period}`,
        ['Period', 'Orders', 'Gross Revenue (USD)', 'Gross Margin (USD)'],
        salesGrouped.map((r) => [r.label, r.orders, r.revenue.toFixed(2), r.profit.toFixed(2)])
      );
    } else if (reportTab === 'valuation') {
      exportToCsv(
        'stockmaster-inventory-valuation',
        ['SKU', 'Product', 'Category', 'Quantity', 'Unit Cost', 'Cost Valuation', 'Retail Valuation'],
        products.map((p) => [
          p.sku,
          p.name,
          categoryMap.get(p.categoryId) || 'Uncategorized',
          p.quantity,
          p.costPrice.toFixed(2),
          (p.quantity * p.costPrice).toFixed(2),
          (p.quantity * p.sellingPrice).toFixed(2),
        ])
      );
    } else {
      exportToCsv(
        'stockmaster-low-stock-replenishment',
        ['SKU', 'Product', 'On Hand', 'Reorder Min', 'Suggested Order Qty', 'Est. Restock Cost'],
        lowStockRows.map((p) => {
          const suggested = calculateSuggestedReorderQty(p.quantity, p.reorderLevel);
          return [
            p.sku,
            p.name,
            p.quantity,
            p.reorderLevel,
            suggested,
            (suggested * p.costPrice).toFixed(2),
          ];
        })
      );
    }
  }

  function handleExportPdf() {
    if (reportTab === 'sales') {
      exportReportPdf(
        `stockmaster-sales-${period}`,
        `Sales Performance (${period})`,
        'Order volume, gross revenue, and gross profit breakdown',
        ['Period', 'Orders', 'Gross Revenue', 'Gross Margin'],
        salesGrouped.map((r) => [
          r.label,
          r.orders,
          formatCurrency(r.revenue),
          formatCurrency(r.profit),
        ])
      );
    } else if (reportTab === 'valuation') {
      exportReportPdf(
        'stockmaster-inventory-valuation',
        'Inventory Valuation Report',
        `Total Cost Value: ${formatCurrency(valuationSummary.totalCostValue)} · Total Retail Value: ${formatCurrency(valuationSummary.totalRetailValue)}`,
        ['SKU', 'Product', 'Category', 'On Hand', 'Unit Cost', 'Cost Value', 'Retail Value'],
        products.map((p) => [
          p.sku,
          p.name,
          categoryMap.get(p.categoryId) || 'Uncategorized',
          `${p.quantity} ${p.unit}`,
          formatCurrency(p.costPrice),
          formatCurrency(p.quantity * p.costPrice),
          formatCurrency(p.quantity * p.sellingPrice),
        ])
      );
    } else {
      exportReportPdf(
        'stockmaster-low-stock',
        'Low-Stock Replenishment Report',
        `${lowStockRows.length} SKUs requiring vendor purchase orders`,
        ['SKU', 'Product', 'On Hand', 'Reorder Min', 'Suggested Qty', 'Est. PO Cost'],
        lowStockRows.map((p) => {
          const suggested = calculateSuggestedReorderQty(p.quantity, p.reorderLevel);
          return [
            p.sku,
            p.name,
            p.quantity,
            p.reorderLevel,
            suggested,
            formatCurrency(suggested * p.costPrice),
          ];
        })
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
          {(
            [
              { id: 'sales', label: 'Sales Performance' },
              { id: 'valuation', label: 'Inventory Valuation' },
              { id: 'low_stock', label: 'Low-Stock Replenishment' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                reportTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {reportTab === 'sales' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Revenue &amp; Gross Margin Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Aggregate invoice totals and net margin across selected cadence
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                      period === p
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={salesGrouped}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                    formatter={(value: unknown) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Gross Margin" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">Period</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Gross Revenue</th>
                  <th className="py-3 px-6 text-right">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {salesGrouped.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 px-6 text-center text-sm text-slate-500">
                      No sales data recorded yet.
                    </td>
                  </tr>
                ) : (
                  salesGrouped.map((row) => (
                    <tr key={row.label}>
                      <td className="py-3 px-6 font-medium text-slate-900 dark:text-white">
                        {row.label}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{row.orders}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(row.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportTab === 'valuation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Cost Valuation</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(valuationSummary.totalCostValue)}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Potential Retail Value</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(valuationSummary.totalRetailValue)}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Projected Gross Margin</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatCurrency(valuationSummary.potentialMargin)}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">SKU</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">On Hand</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Cost Value</th>
                  <th className="py-3 px-6 text-right">Retail Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-6 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{p.name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{p.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(p.costPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(p.quantity * p.costPrice)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(p.quantity * p.sellingPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportTab === 'low_stock' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {lowStockRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No SKUs currently require replenishment.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">SKU</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">On Hand</th>
                  <th className="py-3 px-4 text-right">Reorder Min</th>
                  <th className="py-3 px-4 text-right">Suggested Order</th>
                  <th className="py-3 px-6 text-right">Est. PO Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {lowStockRows.map((p) => {
                  const suggested = calculateSuggestedReorderQty(p.quantity, p.reorderLevel);
                  return (
                    <tr key={p.id}>
                      <td className="py-3 px-6 font-mono text-xs text-slate-500">{p.sku}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{p.name}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-red-600 dark:text-red-400 font-semibold">
                        {p.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{p.reorderLevel}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400 font-semibold">
                        +{suggested} {p.unit}
                      </td>
                      <td className="py-3 px-6 text-right font-mono tabular-nums font-medium">
                        {formatCurrency(suggested * p.costPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
