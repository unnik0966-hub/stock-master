import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Box,
  Building2,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { AuthView } from './components/AuthView.tsx';
import { CategoriesView } from './components/CategoriesView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ProductsView } from './components/ProductsView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SalesView } from './components/SalesView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { StockView } from './components/StockView.tsx';
import { SuppliersView } from './components/SuppliersView.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { ToastProvider, useToast } from './context/ToastContext.tsx';
import type {
  CategoryDTO,
  DashboardSummaryDTO,
  ProductDTO,
  SaleDTO,
  StockMovementDTO,
  SupplierDTO,
} from './types/inventory.ts';
import { ApiError, apiRequest } from './utils/apiClient.ts';
import { computeStockStatus } from './utils/inventoryMath.ts';

type TabKey =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'suppliers'
  | 'stock'
  | 'sales'
  | 'reports'
  | 'settings';

const NAV_ITEMS: Array<{
  key: TabKey;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'categories', label: 'Categories', icon: FolderTree },
  { key: 'suppliers', label: 'Suppliers', icon: Building2 },
  { key: 'stock', label: 'Stock', icon: ArrowLeftRight },
  { key: 'sales', label: 'Sales', icon: Receipt },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const DEFAULT_AVATAR = '/src/assets/images/avatar_admin_profile_1795615611387.jpg';

function AppWorkspace() {
  const { user, token, initializing, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [movements, setMovements] = useState<StockMovementDTO[]>([]);
  const [sales, setSales] = useState<SaleDTO[]>([]);
  const [preselectedRestock, setPreselectedRestock] = useState<ProductDTO | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [
        summaryRes,
        productsRes,
        categoriesRes,
        suppliersRes,
        movementsRes,
        salesRes,
      ] = await Promise.all([
        apiRequest<DashboardSummaryDTO>('/dashboard', { token }),
        apiRequest<ProductDTO[]>('/products', { token }),
        apiRequest<CategoryDTO[]>('/categories', { token }),
        apiRequest<SupplierDTO[]>('/suppliers', { token }),
        apiRequest<StockMovementDTO[]>('/stock', { token }),
        apiRequest<SaleDTO[]>('/sales', { token }),
      ]);

      setSummary(summaryRes);
      setProducts(productsRes);
      setCategories(categoriesRes);
      setSuppliers(suppliersRes);
      setMovements(movementsRes);
      setSales(salesRes);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        showToast('Session expired. Please sign in again.', 'error');
      } else {
        showToast((err as Error).message || 'Failed to sync inventory data.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout, showToast]);

  useEffect(() => {
    if (token) {
      void refreshAll();
    } else {
      setSummary(null);
      setProducts([]);
      setCategories([]);
      setSuppliers([]);
      setMovements([]);
      setSales([]);
      setActiveTab('dashboard');
    }
  }, [token, refreshAll]);

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-sm">
            <Box className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Initializing StockMaster...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <AuthView />;
  }

  const lowStockAlertCount = products.filter((p) => {
    const status = computeStockStatus(p.quantity, p.reorderLevel);
    return status === 'low_stock' || status === 'out_of_stock';
  }).length;

  const activeNavMeta = NAV_ITEMS.find((item) => item.key === activeTab) || NAV_ITEMS[0];

  function handleNavigate(tab: string) {
    const valid = NAV_ITEMS.some((item) => item.key === tab);
    if (valid) {
      setActiveTab(tab as TabKey);
      setMobileMenuOpen(false);
    }
  }

  function handleQuickRestock(product: ProductDTO) {
    setPreselectedRestock(product);
    setActiveTab('stock');
    setMobileMenuOpen(false);
  }

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-60 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Box className="w-4 h-4" />
            </div>
            <div className="leading-none">
              <span className="font-heading text-sm font-bold tracking-tight text-slate-900 dark:text-white block">
                StockMaster
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Inventory Suite
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.key)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.key === 'stock' && lowStockAlertCount > 0 && (
                  <span className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {lowStockAlertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left"
          >
            {!avatarFailed ? (
              <img
                src={user.avatarUrl || DEFAULT_AVATAR}
                alt={user.name}
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 rounded-md object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center shrink-0">
                {initials || 'SM'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize truncate">
                {user.role} Account
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
                StockMaster
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-heading font-semibold text-slate-900 dark:text-white truncate">
                {activeNavMeta.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loading}
              title="Refresh inventory data"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('sales')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sales POS</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              loading={loading}
              onNavigate={handleNavigate}
              onQuickRestock={handleQuickRestock}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              suppliers={suppliers}
              loading={loading}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              categories={categories}
              products={products}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              products={products}
              movements={movements}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'stock' && (
            <StockView
              products={products}
              suppliers={suppliers}
              movements={movements}
              preselectedRestock={preselectedRestock}
              onClearPreselect={() => setPreselectedRestock(null)}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'sales' && (
            <SalesView products={products} sales={sales} onRefresh={refreshAll} />
          )}

          {activeTab === 'reports' && (
            <ReportsView products={products} categories={categories} sales={sales} />
          )}

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppWorkspace />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
