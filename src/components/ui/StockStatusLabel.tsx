import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { StockStatus } from '../../types/inventory.ts';

export function StockStatusLabel({ status }: { status: StockStatus }) {
  if (status === 'out_of_stock') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        Out of Stock
      </span>
    );
  }

  if (status === 'low_stock') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Low Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      In Stock
    </span>
  );
}
