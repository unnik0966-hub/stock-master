import type { ProductDTO, StockStatus } from '../types/inventory.ts';

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeStockStatus(quantity: number, reorderLevel: number): StockStatus {
  if (quantity <= 0) {
    return 'out_of_stock';
  }
  if (quantity <= reorderLevel) {
    return 'low_stock';
  }
  return 'in_stock';
}

export function generateSku(categoryCode: string, sequence: number): string {
  const cleanCode = categoryCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(3, 'X');
  const paddedSeq = String(Math.max(1, Math.floor(sequence))).padStart(4, '0');
  return `SM-${cleanCode}-${paddedSeq}`;
}

export function calculateInventoryValuation(
  products: Array<Pick<ProductDTO, 'costPrice' | 'sellingPrice' | 'quantity'>>
): {
  totalCostValue: number;
  totalRetailValue: number;
  potentialMargin: number;
  totalUnits: number;
} {
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;

  for (const product of products) {
    const qty = Math.max(0, product.quantity);
    totalUnits += qty;
    totalCostValue += qty * product.costPrice;
    totalRetailValue += qty * product.sellingPrice;
  }

  totalCostValue = roundCurrency(totalCostValue);
  totalRetailValue = roundCurrency(totalRetailValue);
  const potentialMargin = roundCurrency(totalRetailValue - totalCostValue);

  return {
    totalCostValue,
    totalRetailValue,
    potentialMargin,
    totalUnits,
  };
}

export function calculateSaleTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number = 0.08
): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const safeTaxRate = Math.max(0, taxRate);
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0)
  );
  const taxAmount = roundCurrency(subtotal * safeTaxRate);
  const total = roundCurrency(subtotal + taxAmount);

  return {
    subtotal,
    taxAmount,
    total,
  };
}

export function calculateSuggestedReorderQty(quantity: number, reorderLevel: number): number {
  const target = Math.max(reorderLevel * 3, 15);
  return Math.max(0, target - Math.max(0, quantity));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
