export type UserRole = 'admin' | 'staff';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  code: string;
  description: string;
  createdAt: string;
}

export interface SupplierDTO {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  createdAt: string;
}

export interface ProductDTO {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  supplierId: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  unit: string;
  location: string;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementDTO {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  supplierId?: string;
  supplierName?: string;
  reference: string;
  notes: string;
  performedBy: string;
  createdAt: string;
}

export interface SaleItemDTO {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
}

export interface SaleDTO {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: SaleItemDTO[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: 'Card' | 'Bank Transfer' | 'Cash' | 'Invoice Net-30';
  status: 'Paid' | 'Pending';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface DashboardSummaryDTO {
  kpis: {
    totalProducts: number;
    totalCategories: number;
    totalSuppliers: number;
    totalUnits: number;
    inventoryCostValue: number;
    inventoryRetailValue: number;
    potentialMargin: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalSalesRevenue: number;
    totalOrders: number;
  };
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    orders: number;
    cost: number;
  }>;
  stockByCategory: Array<{
    category: string;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    valuation: number;
  }>;
  lowStockProducts: ProductDTO[];
  recentMovements: StockMovementDTO[];
  recentSales: SaleDTO[];
}
