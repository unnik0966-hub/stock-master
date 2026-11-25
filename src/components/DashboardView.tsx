import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardSummaryDTO, ProductDTO } from '../types/inventory.ts';
import { formatCurrency, formatNumber } from '../utils/inventoryMath.ts';
import { ProductImage } from './ui/ProductImage.tsx';
import { StockStatusLabel } from './ui/StockStatusLabel.tsx';

interface DashboardViewProps {
  summary: DashboardSummaryDTO | null;
  loading: boolean;
  onNavigate: (tab: string) => void;
  onQuickRestock: (product: ProductDTO) => void;
}

export function DashboardView({
  summary,
  loading,
  onNavigate,
  onQuickRestock,
}: DashboardViewProps) {
  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="h-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const { kpis, monthlyRevenue, stockByCategory, lowStockProducts, recentMovements } = summary;

  const kpiCards = [
    {
      label: 'Active SKUs',
      value: formatNumber(kpis.totalProducts),
      meta: `${formatNumber(kpis.totalUnits)} total units`,
      action: () => onNavigate('products'),
    },
    {
      label: 'Categories',
      value: formatNumber(kpis.totalCategories),
      meta: 'Product lines',
      action: () => onNavigate('categories'),
    },
    {
      label: 'Suppliers',
      value: formatNumber(kpis.totalSuppliers),
      meta: 'Active vendors',
      action: () => onNavigate('suppliers'),
    },
    {
      label: 'Inventory Valuation',
      value: formatCurrency(kpis.inventoryCostValue),
      meta: `Retail ${formatCurrency(kpis.inventoryRetailValue)}`,
      action: () => onNavigate('reports'),
    },
    {
      label: 'Low-Stock Alerts',
      value: formatNumber(kpis.lowStockCount),
      meta: `${kpis.outOfStockCount} out of stock`,
      highlight: kpis.lowStockCount > 0,
      action: () => onNavigate('stock'),
    },
    {
      label: 'Sales Revenue',
      value: formatCurrency(kpis.totalSalesRevenue),
      meta: `${formatNumber(kpis.totalOrders)} orders`,
      action: () => onNavigate('sales'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 6 KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.action}
            className="text-left p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              {card.label}
            </p>
            <p
              className={`mt-2 font-mono text-xl font-semibold tabular-nums truncate ${
                card.highlight
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{card.meta}</p>
          </button>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Revenue AreaChart */}
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Monthly Sales Revenue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                6-month invoice revenue vs. cost of goods sold
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              View Sales
            </button>
          </div>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={monthlyRevenue} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown) => [formatCurrency(Number(value)), 'Amount']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="COGS"
                  stroke="#64748B"
                  strokeWidth={1.5}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Stock Availability Stacked BarChart */}
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Stock Availability by Category
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                SKU distribution across healthy, low-stock, and depleted states
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('categories')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Categories
            </button>
          </div>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={stockByCategory} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="inStock" name="In Stock" stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} />
                <Bar dataKey="lowStock" name="Low Stock" stackId="a" fill="#D97706" radius={[0, 0, 0, 0]} />
                <Bar
                  dataKey="outOfStock"
                  name="Out of Stock"
                  stackId="a"
                  fill="#DC2626"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Bottom Split: Low-Stock Watchlist & Recent Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Low-Stock Watchlist */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Replenishment Watchlist
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Manage Stock
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="p-10 text-center">
              <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                All SKUs are above reorder thresholds
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No urgent vendor purchase orders required right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {lowStockProducts.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductImage src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-mono">{item.sku}</span>
                        <span aria-hidden="true">·</span>
                        <StockStatusLabel
                          status={item.quantity <= 0 ? 'out_of_stock' : 'low_stock'}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                        {item.quantity} {item.unit}
                      </p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        Min {item.reorderLevel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickRestock(item)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap transition-colors cursor-pointer"
                    >
                      Restock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Stock Ledger */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Recent Transactions Ledger
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full Ledger
            </button>
          </div>

          {recentMovements.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-6">Item</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-right">Qty</th>
                    <th className="py-2.5 px-6 text-right">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {recentMovements.slice(0, 6).map((mov) => (
                    <tr
                      key={mov.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-6">
                        <p className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                          {mov.productName}
                        </p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {mov.sku}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
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
                            Adjust
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                        {mov.type === 'IN' ? `+${mov.quantity}` : mov.type === 'OUT' ? `-${mov.quantity}` : mov.newQuantity}
                      </td>
                      <td className="py-2.5 px-6 text-right font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {mov.reference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
