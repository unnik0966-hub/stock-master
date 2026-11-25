import { Router } from 'express';
import { z } from 'zod';
import {
  changePassword,
  createUserByAdmin,
  deleteUserByAdmin,
  getAuthStatus,
  getMe,
  listUsers,
  login,
  registerStaff,
  setupFirstAdmin,
  updateProfile,
  updateUserByAdmin,
} from '../controllers/authController.ts';
import {
  createCategory,
  createProduct,
  createSale,
  createStockMovement,
  createSupplier,
  deleteCategory,
  deleteProduct,
  deleteSupplier,
  getDashboardSummary,
  listCategories,
  listProducts,
  listSales,
  listStockMovements,
  listSuppliers,
  updateCategory,
  updateProduct,
  updateSaleStatus,
  updateSupplier,
} from '../controllers/inventoryController.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { isSafeImageUrl, validateBody } from '../middleware/validate.ts';

const router = Router();

const authSetupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(128),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(120).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'staff']),
});

const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['admin', 'staff']).optional(),
  active: z.boolean().optional(),
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(2).max(8),
  description: z.string().trim().max(400).default(''),
});

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  code: z.string().trim().min(2).max(8).optional(),
  description: z.string().trim().max(400).optional(),
});

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(100),
  contactPerson: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().min(3).max(200),
  leadTimeDays: z.coerce.number().int().min(1).max(120).default(5),
});

const supplierUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  contactPerson: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(120).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  address: z.string().trim().min(3).max(200).optional(),
  leadTimeDays: z.coerce.number().int().min(1).max(120).optional(),
});

const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(3).max(40),
  categoryId: z.string().trim().min(2).max(60),
  supplierId: z.string().trim().min(2).max(60),
  costPrice: z.coerce.number().min(0).max(1000000),
  sellingPrice: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(0).max(1000000),
  reorderLevel: z.coerce.number().int().min(0).max(100000),
  unit: z.string().trim().min(1).max(20).default('unit'),
  location: z.string().trim().min(1).max(80).default('Warehouse A'),
  imageUrl: z
    .string()
    .trim()
    .max(3_000_000)
    .optional()
    .default('')
    .refine(isSafeImageUrl, 'Invalid image URL or unsupported format.'),
  description: z.string().trim().max(600).optional().default(''),
});

const productUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  sku: z.string().trim().min(3).max(40).optional(),
  categoryId: z.string().trim().min(2).max(60).optional(),
  supplierId: z.string().trim().min(2).max(60).optional(),
  costPrice: z.coerce.number().min(0).max(1000000).optional(),
  sellingPrice: z.coerce.number().min(0).max(1000000).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(100000).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  location: z.string().trim().min(1).max(80).optional(),
  imageUrl: z
    .string()
    .trim()
    .max(3_000_000)
    .optional()
    .refine((v) => v === undefined || isSafeImageUrl(v), 'Invalid image URL or unsupported format.'),
  description: z.string().trim().max(600).optional(),
});

const stockMovementSchema = z.object({
  productId: z.string().trim().min(2).max(60),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.coerce.number().int().min(1).max(1000000),
  supplierId: z.string().trim().max(60).optional().default(''),
  reference: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(400).optional().default(''),
});

const saleCreateSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(120).or(z.literal('')).default(''),
  customerPhone: z.string().trim().max(40).default(''),
  paymentMethod: z.enum(['Card', 'Bank Transfer', 'Cash', 'Invoice Net-30']),
  status: z.enum(['Paid', 'Pending']).default('Paid'),
  taxRate: z.coerce.number().min(0).max(0.5).default(0.08),
  notes: z.string().trim().max(400).optional().default(''),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(2).max(60),
        quantity: z.coerce.number().int().min(1).max(100000),
      })
    )
    .min(1),
});

const saleStatusSchema = z.object({
  status: z.enum(['Paid', 'Pending']),
});

// Public auth endpoints
router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.get('/auth/status', getAuthStatus);
router.post('/auth/setup', validateBody(authSetupSchema), setupFirstAdmin);
router.post('/auth/register', validateBody(authSetupSchema), registerStaff);
router.post('/auth/login', validateBody(loginSchema), login);

// Authenticated profile endpoints
router.get('/auth/me', requireAuth, getMe);
router.patch('/auth/profile', requireAuth, validateBody(updateProfileSchema), updateProfile);
router.post('/auth/password', requireAuth, validateBody(changePasswordSchema), changePassword);

// Admin user management
router.get('/users', requireAuth, requireRole('admin'), listUsers);
router.post('/users', requireAuth, requireRole('admin'), validateBody(adminCreateUserSchema), createUserByAdmin);
router.patch('/users/:id', requireAuth, requireRole('admin'), validateBody(adminUpdateUserSchema), updateUserByAdmin);
router.delete('/users/:id', requireAuth, requireRole('admin'), deleteUserByAdmin);

// Dashboard
router.get('/dashboard', requireAuth, getDashboardSummary);

// Categories
router.get('/categories', requireAuth, listCategories);
router.post('/categories', requireAuth, validateBody(categorySchema), createCategory);
router.patch('/categories/:id', requireAuth, validateBody(categoryUpdateSchema), updateCategory);
router.delete('/categories/:id', requireAuth, requireRole('admin'), deleteCategory);

// Suppliers
router.get('/suppliers', requireAuth, listSuppliers);
router.post('/suppliers', requireAuth, validateBody(supplierSchema), createSupplier);
router.patch('/suppliers/:id', requireAuth, validateBody(supplierUpdateSchema), updateSupplier);
router.delete('/suppliers/:id', requireAuth, requireRole('admin'), deleteSupplier);

// Products
router.get('/products', requireAuth, listProducts);
router.post('/products', requireAuth, validateBody(productCreateSchema), createProduct);
router.patch('/products/:id', requireAuth, validateBody(productUpdateSchema), updateProduct);
router.delete('/products/:id', requireAuth, requireRole('admin'), deleteProduct);

// Stock Movements
router.get('/stock', requireAuth, listStockMovements);
router.post('/stock', requireAuth, validateBody(stockMovementSchema), createStockMovement);

// Sales & Invoices
router.get('/sales', requireAuth, listSales);
router.post('/sales', requireAuth, validateBody(saleCreateSchema), createSale);
router.patch('/sales/:id/status', requireAuth, validateBody(saleStatusSchema), updateSaleStatus);

router.use((_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

export default router;
