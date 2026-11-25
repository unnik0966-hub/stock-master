import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    active: { type: Boolean, default: true },
    avatarUrl: { type: String, default: '' },
    createdAt: { type: String, required: true },
  },
  { versionKey: false }
);

const CategorySchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    createdAt: { type: String, required: true },
  },
  { versionKey: false }
);

const SupplierSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    leadTimeDays: { type: Number, default: 5 },
    createdAt: { type: String, required: true },
  },
  { versionKey: false }
);

const ProductSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    categoryId: { type: String, required: true },
    supplierId: { type: String, required: true },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    reorderLevel: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'pcs' },
    location: { type: String, default: 'Warehouse A' },
    imageUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false }
);

const StockMovementSchema = new Schema(
  {
    _id: { type: String, required: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    type: { type: String, enum: ['IN', 'OUT', 'ADJUSTMENT'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    supplierId: { type: String, default: '' },
    supplierName: { type: String, default: '' },
    reference: { type: String, required: true },
    notes: { type: String, default: '' },
    performedBy: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false }
);

const SaleItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SaleSchema = new Schema(
  {
    _id: { type: String, required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    items: { type: [SaleItemSchema], required: true },
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
    notes: { type: String, default: '' },
    createdBy: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false }
);

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export const CategoryModel = mongoose.models.Category || mongoose.model('Category', CategorySchema);
export const SupplierModel = mongoose.models.Supplier || mongoose.model('Supplier', SupplierSchema);
export const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const StockMovementModel =
  mongoose.models.StockMovement || mongoose.model('StockMovement', StockMovementSchema);
export const SaleModel = mongoose.models.Sale || mongoose.model('Sale', SaleSchema);
