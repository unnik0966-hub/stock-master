import type { Response } from 'express';
import { AppError, repository } from '../db/repository.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import type { DashboardSummaryDTO, MovementType, SaleDTO } from '../../src/types/inventory.ts';
import {
  calculateInventoryValuation,
  computeStockStatus,
  roundCurrency,
} from '../../src/utils/inventoryMath.ts';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('Inventory API error:', err);
  res.status(500).json({ error: 'Internal server error.' });
}

export async function getDashboardSummary(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const [products, categories, suppliers, movements, sales] = await Promise.all([
      repository.listProducts(),
      repository.listCategories(),
      repository.listSuppliers(),
      repository.listStockMovements(),
      repository.listSales(),
    ]);

    const valuation = calculateInventoryValuation(products);
    const lowStockProducts = products.filter(
      (p) => computeStockStatus(p.quantity, p.reorderLevel) !== 'in_stock'
    );
    const outOfStockCount = products.filter((p) => p.quantity <= 0).length;
    const lowStockCount = lowStockProducts.length;
    const totalSalesRevenue = roundCurrency(sales.reduce((sum, s) => sum + s.total, 0));

    // Build 6-month revenue series anchored to current date
    const now = new Date();
    const monthBuckets = new Map<
      string,
      { month: string; revenue: number; orders: number; cost: number }
    >();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthBuckets.set(key, { month: label, revenue: 0, orders: 0, cost: 0 });
    }

    for (const sale of sales) {
      const d = new Date(sale.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthBuckets.get(key);
      if (bucket) {
        bucket.revenue = roundCurrency(bucket.revenue + sale.total);
        bucket.orders += 1;
        const orderCost = sale.items.reduce((acc, item) => acc + item.costPrice * item.quantity, 0);
        bucket.cost = roundCurrency(bucket.cost + orderCost);
      }
    }

    const stockByCategory = categories.map((cat) => {
      const catProducts = products.filter((p) => p.categoryId === cat.id);
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      let catValuation = 0;

      for (const p of catProducts) {
        const status = computeStockStatus(p.quantity, p.reorderLevel);
        if (status === 'in_stock') inStock += 1;
        else if (status === 'low_stock') lowStock += 1;
        else outOfStock += 1;
        catValuation += p.quantity * p.costPrice;
      }

      return {
        category: cat.name,
        inStock,
        lowStock,
        outOfStock,
        valuation: roundCurrency(catValuation),
      };
    });

    const summary: DashboardSummaryDTO = {
      kpis: {
        totalProducts: products.length,
        totalCategories: categories.length,
        totalSuppliers: suppliers.length,
        totalUnits: valuation.totalUnits,
        inventoryCostValue: valuation.totalCostValue,
        inventoryRetailValue: valuation.totalRetailValue,
        potentialMargin: valuation.potentialMargin,
        lowStockCount,
        outOfStockCount,
        totalSalesRevenue,
        totalOrders: sales.length,
      },
      monthlyRevenue: Array.from(monthBuckets.values()),
      stockByCategory,
      lowStockProducts: lowStockProducts.sort((a, b) => a.quantity - b.quantity),
      recentMovements: movements.slice(0, 8),
      recentSales: sales.slice(0, 6),
    };

    res.json(summary);
  } catch (err) {
    handleError(res, err);
  }
}

// --- Categories ---

export async function listCategories(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const categories = await repository.listCategories();
    res.json(categories);
  } catch (err) {
    handleError(res, err);
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const cat = await repository.createCategory(req.body);
    res.status(201).json(cat);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const cat = await repository.updateCategory(req.params.id, req.body);
    res.json(cat);
  } catch (err) {
    handleError(res, err);
  }
}

export async function deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await repository.deleteCategory(req.params.id);
    res.json({ message: 'Category deleted.' });
  } catch (err) {
    handleError(res, err);
  }
}

// --- Suppliers ---

export async function listSuppliers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const suppliers = await repository.listSuppliers();
    res.json(suppliers);
  } catch (err) {
    handleError(res, err);
  }
}

export async function createSupplier(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const sup = await repository.createSupplier(req.body);
    res.status(201).json(sup);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateSupplier(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const sup = await repository.updateSupplier(req.params.id, req.body);
    res.json(sup);
  } catch (err) {
    handleError(res, err);
  }
}

export async function deleteSupplier(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await repository.deleteSupplier(req.params.id);
    res.json({ message: 'Supplier deleted.' });
  } catch (err) {
    handleError(res, err);
  }
}

// --- Products ---

export async function listProducts(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const products = await repository.listProducts();
    res.json(products);
  } catch (err) {
    handleError(res, err);
  }
}

export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await repository.createProduct(req.body, req.user!.name);
    res.status(201).json(product);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await repository.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (err) {
    handleError(res, err);
  }
}

export async function deleteProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await repository.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted.' });
  } catch (err) {
    handleError(res, err);
  }
}

// --- Stock Movements ---

export async function listStockMovements(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const movements = await repository.listStockMovements();
    res.json(movements);
  } catch (err) {
    handleError(res, err);
  }
}

export async function createStockMovement(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { productId, type, quantity, supplierId, reference, notes } = req.body as {
      productId: string;
      type: MovementType;
      quantity: number;
      supplierId?: string;
      reference: string;
      notes: string;
    };
    const result = await repository.recordStockMovement({
      productId,
      type,
      quantity,
      supplierId,
      reference,
      notes,
      performedBy: req.user!.name,
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
}

// --- Sales ---

export async function listSales(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const sales = await repository.listSales();
    res.json(sales);
  } catch (err) {
    handleError(res, err);
  }
}

export async function createSale(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const body = req.body as {
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      paymentMethod: SaleDTO['paymentMethod'];
      status: SaleDTO['status'];
      taxRate: number;
      notes?: string;
      items: Array<{ productId: string; quantity: number }>;
    };
    const sale = await repository.createSale({
      ...body,
      createdBy: req.user!.name,
    });
    res.status(201).json(sale);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateSaleStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body as { status: SaleDTO['status'] };
    const sale = await repository.updateSaleStatus(req.params.id, status);
    res.json(sale);
  } catch (err) {
    handleError(res, err);
  }
}
