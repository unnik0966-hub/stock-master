import React, { useState } from 'react';
import { ArrowRight, Box, Eye, EyeOff, KeyRound, Lock, Mail, Moon, ShieldCheck, Sun, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

const DEMO_ADMIN_EMAIL = 'admin@stockmaster.io';
const DEMO_ADMIN_PASS = 'Admin@1234';

export function AuthView() {
  const { needsSetup, setupAdmin, login, registerStaff } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const activeMode = needsSetup ? 'setup' : mode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    const cleanEmail = email.trim();
    const cleanName = name.trim();

    try {
      if (activeMode === 'setup') {
        await setupAdmin({ name: cleanName, email: cleanEmail, password });
        showToast('Administrator workspace initialized.', 'success');
      } else if (activeMode === 'register') {
        await registerStaff({ name: cleanName, email: cleanEmail, password });
        showToast('Staff account registered and signed in.', 'success');
      } else {
        await login({ email: cleanEmail, password });
        showToast('Signed in to StockMaster.', 'success');
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFillDemoAdmin() {
    setMode('login');
    setEmail(DEMO_ADMIN_EMAIL);
    setPassword(DEMO_ADMIN_PASS);
    setErrorMsg('');
  }

  async function handleQuickDemoLogin() {
    setErrorMsg('');
    setSubmitting(true);
    setEmail(DEMO_ADMIN_EMAIL);
    setPassword(DEMO_ADMIN_PASS);
    try {
      await login({ email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASS });
      showToast('Signed in as Demo Administrator.', 'success');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Demo login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Left Narrative Column */}
      <div className="lg:w-[46%] bg-slate-900 dark:bg-slate-900/90 text-slate-100 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
              StockMaster
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="my-12 lg:my-0 max-w-md">
          <p className="text-xs font-medium text-blue-400 tracking-wide mb-3">
            Inventory &amp; Supply Operations
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
            Precision control across every SKU, bin, and invoice.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Track real-time warehouse stock levels, enforce atomic order deductions, manage vendor
            replenishment, and export audit-ready financial reports from one unified ledger.
          </p>

          <dl className="mt-10 pt-8 border-t border-slate-800 grid grid-cols-2 gap-6">
            <div>
              <dt className="text-xs text-slate-400">Stock Movements</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                Atomic Ledger
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Invoice &amp; Analytics</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                PDF &amp; CSV Ready
              </dd>
            </div>
          </dl>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Role-based access control · In-memory session security</span>
        </div>
      </div>

      {/* Right Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {!needsSetup && (
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg mb-8 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Staff Registration
              </button>
            </div>
          )}

          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {activeMode === 'setup'
                ? 'Initialize Administrator Account'
                : activeMode === 'register'
                  ? 'Create Staff Account'
                  : 'Sign in to your workspace'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {activeMode === 'setup'
                ? 'First-run setup: claim your organization administrator credentials to unlock the workspace.'
                : activeMode === 'register'
                  ? 'Register a warehouse or sales staff account with immediate inventory access.'
                  : 'Enter your credentials to access StockMaster inventory and sales.'}
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(activeMode === 'setup' || activeMode === 'register') && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    minLength={2}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@stockmaster.io"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={activeMode === 'login' ? 1 : 8}
                  autoComplete={activeMode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={activeMode === 'login' ? 'Enter password' : 'Minimum 8 characters'}
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>
                {submitting
                  ? 'Please wait...'
                  : activeMode === 'setup'
                    ? 'Create Admin & Launch Workspace'
                    : activeMode === 'register'
                      ? 'Register Staff Account'
                      : 'Sign In'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {activeMode === 'login' && (
            <div className="mt-6 p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Demo Administrator Account</span>
                </div>
                <button
                  type="button"
                  onClick={handleFillDemoAdmin}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Fill Credentials
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Email</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100 select-all">
                    {DEMO_ADMIN_EMAIL}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Password</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100 select-all">
                    {DEMO_ADMIN_PASS}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleQuickDemoLogin()}
                className="w-full py-2 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                One-Click Demo Admin Login
              </button>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Pre-loaded with 10 warehouse hardware SKUs, 5 categories, 4 suppliers, and historical
            sales invoices ready to manage immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
