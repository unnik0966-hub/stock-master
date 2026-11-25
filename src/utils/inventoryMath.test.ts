import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInventoryValuation,
  calculateSaleTotals,
  calculateSuggestedReorderQty,
  computeStockStatus,
  generateSku,
} from './inventoryMath.ts';

test('computeStockStatus distinguishes out_of_stock, low_stock, and in_stock', () => {
  assert.equal(computeStockStatus(0, 10), 'out_of_stock');
  assert.equal(computeStockStatus(-2, 10), 'out_of_stock');
  assert.equal(computeStockStatus(5, 10), 'low_stock');
  assert.equal(computeStockStatus(10, 10), 'low_stock');
  assert.equal(computeStockStatus(11, 10), 'in_stock');
});

test('generateSku formats normalized category prefix and sequence', () => {
  assert.equal(generateSku('scanners', 7), 'SM-SCAN-0007');
  assert.equal(generateSku('ab', 120), 'SM-ABX-0120');
  assert.equal(generateSku('rf-id#9', 1), 'SM-RFID-0001');
});

test('calculateInventoryValuation computes cost, retail, margin, and total units', () => {
  const result = calculateInventoryValuation([
    { costPrice: 100, sellingPrice: 150, quantity: 10 },
    { costPrice: 25.5, sellingPrice: 40, quantity: 4 },
  ]);

  assert.equal(result.totalUnits, 14);
  assert.equal(result.totalCostValue, 1102);
  assert.equal(result.totalRetailValue, 1660);
  assert.equal(result.potentialMargin, 558);
});

test('calculateSaleTotals accurately rounds subtotal, tax, and total', () => {
  const result = calculateSaleTotals(
    [
      { quantity: 2, unitPrice: 199.99 },
      { quantity: 3, unitPrice: 14.5 },
    ],
    0.08
  );

  assert.equal(result.subtotal, 443.48);
  assert.equal(result.taxAmount, 35.48);
  assert.equal(result.total, 478.96);
});

test('calculateSuggestedReorderQty returns target replenishment delta', () => {
  assert.equal(calculateSuggestedReorderQty(3, 10), 27);
  assert.equal(calculateSuggestedReorderQty(0, 4), 15);
  assert.equal(calculateSuggestedReorderQty(40, 10), 0);
});
