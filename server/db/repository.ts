import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.ts';
import {
  CategoryModel,
  ProductModel,
  SaleModel,
  StockMovementModel,
  SupplierModel,
  UserModel,
} from '../models/index.ts';
import {
  createDemoAdminUser,
  createInitialSeedData,
  type DatabaseState,
  type StoredUserRecord,
} from './seedData.ts';
import type {
  CategoryDTO,
  MovementType,
  ProductDTO,
  SaleDTO,
  SaleItemDTO,
  StockMovementDTO,
  SupplierDTO,
  UserDTO,
} from '../../src/types/inventory.ts';
import { calculateSaleTotals, roundCurrency } from '../../src/utils/inventoryMath.ts';

const PRIMARY_DATA_DIR = path.resolve(process.cwd(), 'data');
const TMP_DATA_DIR = path.join(os.tmpdir(), 'stockmaster-data');

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toUserDto(record: StoredUserRecord): UserDTO {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    active: record.active,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
  };
}

function docToObject<T>(doc: unknown): T {
  const plain = typeof (doc as { toObject?: () => unknown }).toObject === 'function'
    ? ((doc as { toObject: () => Record<string, unknown> }).toObject())
    : (doc as Record<string, unknown>);
  const { _id, ...rest } = plain;
  return {
    id: String(_id),
    ...rest,
  } as T;
}

class InventoryRepository {
  private useMongo = false;
  private initialized = false;
  private writeQueue: Promise<unknown> = Promise.resolve();
  private initPromise: Promise<void> | null = null;
  private activeDataDir = PRIMARY_DATA_DIR;
  private memoryFallback: DatabaseState | null = null;

  private get dataFile(): string {
    return path.join(this.activeDataDir, 'stockmaster-db.json');
  }

  private runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(fn, fn);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        if (env.mongoUri) {
          try {
            await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 4000 });
            this.useMongo = true;
            await this.ensureMongoSeed();
            this.initialized = true;
            return;
          } catch (err) {
            console.warn(
              'MongoDB unavailable, falling back to persistent atomic JSON store:',
              (err as Error).message
            );
          }
        }

        await this.ensureJsonStore();
        this.initialized = true;
      })().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async ensureJsonStore(): Promise<void> {
    if (this.memoryFallback) return;

    for (const candidateDir of [PRIMARY_DATA_DIR, TMP_DATA_DIR]) {
      this.activeDataDir = candidateDir;
      try {
        await fs.mkdir(this.activeDataDir, { recursive: true });
        try {
          await fs.access(this.dataFile);
          const raw = await fs.readFile(this.dataFile, 'utf8');
          const parsed = JSON.parse(raw) as DatabaseState;
          if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
            parsed.users = [createDemoAdminUser()];
            await this.writeJsonState(parsed);
          }
          return;
        } catch {
          const initial = createInitialSeedData();
          await this.writeJsonState(initial);
          return;
        }
      } catch (err) {
        console.warn(`Storage directory ${candidateDir} unavailable:`, (err as Error).message);
      }
    }

    this.memoryFallback = createInitialSeedData();
  }

  private async readJsonState(): Promise<DatabaseState> {
    await this.ensureJsonStore();
    if (this.memoryFallback) {
      return this.memoryFallback;
    }
    const raw = await fs.readFile(this.dataFile, 'utf8');
    return JSON.parse(raw) as DatabaseState;
  }

  private async writeJsonState(state: DatabaseState): Promise<void> {
    if (this.memoryFallback) {
      this.memoryFallback = state;
      return;
    }
    try {
      await fs.mkdir(this.activeDataDir, { recursive: true });
      const tempFile = `${this.dataFile}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
      await fs.rename(tempFile, this.dataFile);
    } catch (err) {
      if (this.activeDataDir !== TMP_DATA_DIR) {
        try {
          this.activeDataDir = TMP_DATA_DIR;
          await fs.mkdir(this.activeDataDir, { recursive: true });
          const tempFile = `${this.dataFile}.${crypto.randomUUID()}.tmp`;
          await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
          await fs.rename(tempFile, this.dataFile);
          return;
        } catch {
          // Fall through to memory fallback
        }
      }
      console.warn('Disk storage read-only; keeping state in memory:', (err as Error).message);
      this.memoryFallback = state;
    }
  }

  private async ensureMongoSeed(): Promise<void> {
    const userCount = await UserModel.countDocuments();
    if (userCount === 0) {
      const { id, ...rest } = createDemoAdminUser();
      await UserModel.create({ _id: id, ...rest });
    }
    const productCount = await ProductModel.countDocuments();
    const catCount = await CategoryModel.countDocuments();
    if (productCount === 0 && catCount === 0) {
      const seed = createInitialSeedData();
      if (seed.categories.length) {
        await CategoryModel.insertMany(seed.categories.map(({ id, ...rest }) => ({ _id: id, ...rest })));
      }
      if (seed.suppliers.length) {
        await SupplierModel.insertMany(seed.suppliers.map(({ id, ...rest }) => ({ _id: id, ...rest })));
      }
      if (seed.products.length) {
        await ProductModel.insertMany(seed.products.map(({ id, ...rest }) => ({ _id: id, ...rest })));
      }
      if (seed.stockMovements.length) {
        await StockMovementModel.insertMany(seed.stockMovements.map(({ id, ...rest }) => ({ _id: id, ...rest })));
      }
      if (seed.sales.length) {
        await SaleModel.insertMany(seed.sales.map(({ id, ...rest }) => ({ _id: id, ...rest })));
      }
    }
  }

  // --- Users & Auth ---

  async getUserCount(): Promise<number> {
    await this.init();
    if (this.useMongo) {
      return UserModel.countDocuments();
    }
    const state = await this.readJsonState();
    return state.users.length;
  }

  async findUserByEmail(email: string): Promise<StoredUserRecord | null> {
    await this.init();
    const normalized = email.trim().toLowerCase();
    if (this.useMongo) {
      const doc = await UserModel.findOne({ email: normalized });
      return doc ? (docToObject(doc) as StoredUserRecord) : null;
    }
    const state = await this.readJsonState();
    return state.users.find((u) => u.email.toLowerCase() === normalized) || null;
  }

  async findUserById(id: string): Promise<StoredUserRecord | null> {
    await this.init();
    if (this.useMongo) {
      const doc = await UserModel.findById(id);
      return doc ? (docToObject(doc) as StoredUserRecord) : null;
    }
    const state = await this.readJsonState();
    return state.users.find((u) => u.id === id) || null;
  }

  async listUsers(): Promise<UserDTO[]> {
    await this.init();
    if (this.useMongo) {
      const docs = await UserModel.find().sort({ createdAt: -1 });
      return docs.map((d) => toUserDto(docToObject(d) as StoredUserRecord));
    }
    const state = await this.readJsonState();
    return [...state.users]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toUserDto);
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: 'admin' | 'staff';
    avatarUrl?: string;
    requireEmptyUsers?: boolean;
  }): Promise<UserDTO> {
    await this.init();
    return this.runSerialized(async () => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const now = new Date().toISOString();
      const id = `usr_${crypto.randomUUID().slice(0, 12)}`;

      if (this.useMongo) {
        if (input.requireEmptyUsers) {
          const existingCount = await UserModel.countDocuments();
          if (existingCount > 0) {
            throw new AppError(403, 'Initial administrator setup has already been completed.');
          }
        }
        const exists = await UserModel.findOne({ email: normalizedEmail });
        if (exists) {
          throw new AppError(409, 'An account with this email already exists.');
        }
        const doc = await UserModel.create({
          _id: id,
          name: input.name.trim(),
          email: normalizedEmail,
          passwordHash: input.passwordHash,
          role: input.role,
          active: true,
          avatarUrl: input.avatarUrl || '/src/assets/images/avatar_admin_profile_1795615611387.jpg',
          createdAt: now,
        });
        return toUserDto(docToObject(doc) as StoredUserRecord);
      }

      const state = await this.readJsonState();
      if (input.requireEmptyUsers && state.users.length > 0) {
        throw new AppError(403, 'Initial administrator setup has already been completed.');
      }
      if (state.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        throw new AppError(409, 'An account with this email already exists.');
      }

      const newUser: StoredUserRecord = {
        id,
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash: input.passwordHash,
        role: input.role,
        active: true,
        avatarUrl: input.avatarUrl || '/src/assets/images/avatar_admin_profile_1795615611387.jpg',
        createdAt: now,
      };
      state.users.push(newUser);
      await this.writeJsonState(state);
      return toUserDto(newUser);
    });
  }

  async updateUser(
    id: string,
    updates: Partial<Pick<StoredUserRecord, 'name' | 'email' | 'role' | 'active' | 'passwordHash' | 'avatarUrl'>>
  ): Promise<UserDTO> {
    await this.init();
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const user = await UserModel.findById(id);
        if (!user) throw new AppError(404, 'User not found.');
        if (updates.email) {
          const normalized = updates.email.trim().toLowerCase();
          const duplicate = await UserModel.findOne({ email: normalized, _id: { $ne: id } });
          if (duplicate) throw new AppError(409, 'Email is already in use.');
          user.email = normalized;
        }
        if (updates.name !== undefined) user.name = updates.name.trim();
        if (updates.role !== undefined) user.role = updates.role;
        if (updates.active !== undefined) user.active = updates.active;
        if (updates.passwordHash !== undefined) user.passwordHash = updates.passwordHash;
        if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl;
        await user.save();
        return toUserDto(docToObject(user) as StoredUserRecord);
      }

      const state = await this.readJsonState();
      const idx = state.users.findIndex((u) => u.id === id);
      if (idx === -1) throw new AppError(404, 'User not found.');

      const current = state.users[idx];
      if (updates.email) {
        const normalized = updates.email.trim().toLowerCase();
        if (state.users.some((u) => u.id !== id && u.email.toLowerCase() === normalized)) {
          throw new AppError(409, 'Email is already in use.');
        }
        current.email = normalized;
      }
      if (updates.name !== undefined) current.name = updates.name.trim();
      if (updates.role !== undefined) current.role = updates.role;
      if (updates.active !== undefined) current.active = updates.active;
      if (updates.passwordHash !== undefined) current.passwordHash = updates.passwordHash;
      if (updates.avatarUrl !== undefined) current.avatarUrl = updates.avatarUrl;

      state.users[idx] = current;
      await this.writeJsonState(state);
      return toUserDto(current);
    });
  }

  async deleteUser(id: string, requesterId: string): Promise<void> {
    await this.init();
    if (id === requesterId) {
      throw new AppError(400, 'You cannot delete your own active administrator account.');
    }
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const res = await UserModel.findByIdAndDelete(id);
        if (!res) throw new AppError(404, 'User not found.');
        return;
      }
      const state = await this.readJsonState();
      const before = state.users.length;
      state.users = state.users.filter((u) => u.id !== id);
      if (state.users.length === before) throw new AppError(404, 'User not found.');
      await this.writeJsonState(state);
    });
  }

  // --- Categories ---

  async listCategories(): Promise<CategoryDTO[]> {
    await this.init();
    if (this.useMongo) {
      const docs = await CategoryModel.find().sort({ name: 1 });
      return docs.map((d) => docToObject<CategoryDTO>(d));
    }
    const state = await this.readJsonState();
    return [...state.categories].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(input: { name: string; code: string; description: string }): Promise<CategoryDTO> {
    await this.init();
    return this.runSerialized(async () => {
      const cleanCode = input.code.trim().toUpperCase();
      const now = new Date().toISOString();
      const id = `cat_${crypto.randomUUID().slice(0, 10)}`;

      if (this.useMongo) {
        const dup = await CategoryModel.findOne({
          $or: [{ name: input.name.trim() }, { code: cleanCode }],
        });
        if (dup) throw new AppError(409, 'Category name or code already exists.');
        const doc = await CategoryModel.create({
          _id: id,
          name: input.name.trim(),
          code: cleanCode,
          description: input.description.trim(),
          createdAt: now,
        });
        return docToObject<CategoryDTO>(doc);
      }

      const state = await this.readJsonState();
      if (
        state.categories.some(
          (c) =>
            c.name.toLowerCase() === input.name.trim().toLowerCase() ||
            c.code.toUpperCase() === cleanCode
        )
      ) {
        throw new AppError(409, 'Category name or code already exists.');
      }
      const category: CategoryDTO = {
        id,
        name: input.name.trim(),
        code: cleanCode,
        description: input.description.trim(),
        createdAt: now,
      };
      state.categories.push(category);
      await this.writeJsonState(state);
      return category;
    });
  }

  async updateCategory(
    id: string,
    input: Partial<{ name: string; code: string; description: string }>
  ): Promise<CategoryDTO> {
    await this.init();
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const cat = await CategoryModel.findById(id);
        if (!cat) throw new AppError(404, 'Category not found.');
        if (input.name !== undefined) cat.name = input.name.trim();
        if (input.code !== undefined) cat.code = input.code.trim().toUpperCase();
        if (input.description !== undefined) cat.description = input.description.trim();
        await cat.save();
        return docToObject<CategoryDTO>(cat);
      }

      const state = await this.readJsonState();
      const idx = state.categories.findIndex((c) => c.id === id);
      if (idx === -1) throw new AppError(404, 'Category not found.');
      const cat = state.categories[idx];
      if (input.name !== undefined) cat.name = input.name.trim();
      if (input.code !== undefined) cat.code = input.code.trim().toUpperCase();
      if (input.description !== undefined) cat.description = input.description.trim();
      state.categories[idx] = cat;
      await this.writeJsonState(state);
      return cat;
    });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.init();
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const used = await ProductModel.countDocuments({ categoryId: id });
        if (used > 0) {
          throw new AppError(409, 'Cannot delete category while products are assigned to it.');
        }
        const res = await CategoryModel.findByIdAndDelete(id);
        if (!res) throw new AppError(404, 'Category not found.');
        return;
      }

      const state = await this.readJsonState();
      if (state.products.some((p) => p.categoryId === id)) {
        throw new AppError(409, 'Cannot delete category while products are assigned to it.');
      }
      const before = state.categories.length;
      state.categories = state.categories.filter((c) => c.id !== id);
      if (state.categories.length === before) throw new AppError(404, 'Category not found.');
      await this.writeJsonState(state);
    });
  }

  // --- Suppliers ---

  async listSuppliers(): Promise<SupplierDTO[]> {
    await this.init();
    if (this.useMongo) {
      const docs = await SupplierModel.find().sort({ name: 1 });
      return docs.map((d) => docToObject<SupplierDTO>(d));
    }
    const state = await this.readJsonState();
    return [...state.suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createSupplier(input: Omit<SupplierDTO, 'id' | 'createdAt'>): Promise<SupplierDTO> {
    await this.init();
    return this.runSerialized(async () => {
      const now = new Date().toISOString();
      const id = `sup_${crypto.randomUUID().slice(0, 10)}`;

      if (this.useMongo) {
        const doc = await SupplierModel.create({
          _id: id,
          ...input,
          createdAt: now,
        });
        return docToObject<SupplierDTO>(doc);
      }

      const state = await this.readJsonState();
      const supplier: SupplierDTO = { id, ...input, createdAt: now };
      state.suppliers.push(supplier);
      await this.writeJsonState(state);
      return supplier;
    });
  }

  async updateSupplier(
    id: string,
    input: Partial<Omit<SupplierDTO, 'id' | 'createdAt'>>
  ): Promise<SupplierDTO> {
    await this.init();
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const sup = await SupplierModel.findByIdAndUpdate(id, input, { new: true });
        if (!sup) throw new AppError(404, 'Supplier not found.');
        return docToObject<SupplierDTO>(sup);
      }

      const state = await this.readJsonState();
      const idx = state.suppliers.findIndex((s) => s.id === id);
      if (idx === -1) throw new AppError(404, 'Supplier not found.');
      state.suppliers[idx] = { ...state.suppliers[idx], ...input };
      await this.writeJsonState(state);
      return state.suppliers[idx];
    });
  }

  async deleteSupplier(id: string): Promise<void> {
    await this.init();
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const used = await ProductModel.countDocuments({ supplierId: id });
        if (used > 0) {
          throw new AppError(409, 'Cannot delete supplier linked to active products.');
        }
        const res = await SupplierModel.findByIdAndDelete(id);
        if (!res) throw new AppError(404, 'Supplier not found.');
        return;
      }

      const state = await this.readJsonState();
      if (state.products.some((p) => p.supplierId === id)) {
        throw new AppError(409, 'Cannot delete supplier linked to active products.');
      }
      const before = state.suppliers.length;
      state.suppliers = state.suppliers.filter((s) => s.id !== id);
      if (state.suppliers.length === before) throw new AppError(404, 'Supplier not found.');
      await this.writeJsonState(state);
    });
  }

  // --- Products ---

  async listProducts(): Promise<ProductDTO[]> {
    await this.init();
    if (this.useMongo) {
      const docs = await ProductModel.find().sort({ updatedAt: -1 });
      return docs.map((d) => docToObject<ProductDTO>(d));
    }
    const state = await this.readJsonState();
    return [...state.products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createProduct(
    input: Omit<ProductDTO, 'id' | 'createdAt' | 'updatedAt'>,
    performedBy: string
  ): Promise<ProductDTO> {
    await this.init();
    return this.runSerialized(async () => {
      const now = new Date().toISOString();
      const id = `prod_${crypto.randomUUID().slice(0, 10)}`;
      const sku = input.sku.trim().toUpperCase();

      if (this.useMongo) {
        const existingSku = await ProductModel.findOne({ sku });
        if (existingSku) throw new AppError(409, 'A product with this SKU already exists.');
        const cat = await CategoryModel.findById(input.categoryId);
        if (!cat) throw new AppError(400, 'Selected category does not exist.');
        const sup = await SupplierModel.findById(input.supplierId);
        if (!sup) throw new AppError(400, 'Selected supplier does not exist.');

        const doc = await ProductModel.create({
          _id: id,
          ...input,
          sku,
          costPrice: roundCurrency(input.costPrice),
          sellingPrice: roundCurrency(input.sellingPrice),
          createdAt: now,
          updatedAt: now,
        });

        if (input.quantity > 0) {
          await StockMovementModel.create({
            _id: `mov_${crypto.randomUUID().slice(0, 10)}`,
            productId: id,
            productName: input.name,
            sku,
            type: 'IN',
            quantity: input.quantity,
            previousQuantity: 0,
            newQuantity: input.quantity,
            supplierId: input.supplierId,
            supplierName: sup.name,
            reference: 'INIT-STOCK',
            notes: 'Initial inventory balance upon SKU creation.',
            performedBy,
            createdAt: now,
          });
        }
        return docToObject<ProductDTO>(doc);
      }

      const state = await this.readJsonState();
      if (state.products.some((p) => p.sku.toUpperCase() === sku)) {
        throw new AppError(409, 'A product with this SKU already exists.');
      }
      if (!state.categories.some((c) => c.id === input.categoryId)) {
        throw new AppError(400, 'Selected category does not exist.');
      }
      const supplier = state.suppliers.find((s) => s.id === input.supplierId);
      if (!supplier) {
        throw new AppError(400, 'Selected supplier does not exist.');
      }

      const product: ProductDTO = {
        id,
        ...input,
        sku,
        costPrice: roundCurrency(input.costPrice),
        sellingPrice: roundCurrency(input.sellingPrice),
        createdAt: now,
        updatedAt: now,
      };
      state.products.push(product);

      if (product.quantity > 0) {
        state.stockMovements.unshift({
          id: `mov_${crypto.randomUUID().slice(0, 10)}`,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          type: 'IN',
          quantity: product.quantity,
          previousQuantity: 0,
          newQuantity: product.quantity,
          supplierId: supplier.id,
          supplierName: supplier.name,
          reference: 'INIT-STOCK',
          notes: 'Initial inventory balance upon SKU creation.',
          performedBy,
          createdAt: now,
        });
      }

      await this.writeJsonState(state);
      return product;
    });
  }

  async updateProduct(
    id: string,
    input: Partial<Omit<ProductDTO, 'id' | 'createdAt' | 'updatedAt' | 'quantity'>>
  ): Promise<ProductDTO> {
    await this.init();
    return this.runSerialized(async () => {
      const now = new Date().toISOString();
      if (this.useMongo) {
        const product = await ProductModel.findById(id);
        if (!product) throw new AppError(404, 'Product not found.');
        if (input.sku) {
          const sku = input.sku.trim().toUpperCase();
          const dup = await ProductModel.findOne({ sku, _id: { $ne: id } });
          if (dup) throw new AppError(409, 'SKU is already assigned to another product.');
          product.sku = sku;
        }
        if (input.name !== undefined) product.name = input.name.trim();
        if (input.categoryId !== undefined) product.categoryId = input.categoryId;
        if (input.supplierId !== undefined) product.supplierId = input.supplierId;
        if (input.costPrice !== undefined) product.costPrice = roundCurrency(input.costPrice);
        if (input.sellingPrice !== undefined) product.sellingPrice = roundCurrency(input.sellingPrice);
        if (input.reorderLevel !== undefined) product.reorderLevel = input.reorderLevel;
        if (input.unit !== undefined) product.unit = input.unit.trim();
        if (input.location !== undefined) product.location = input.location.trim();
        if (input.imageUrl !== undefined) product.imageUrl = input.imageUrl;
        if (input.description !== undefined) product.description = input.description.trim();
        product.updatedAt = now;
        await product.save();
        return docToObject<ProductDTO>(product);
      }

      const state = await this.readJsonState();
      const idx = state.products.findIndex((p) => p.id === id);
      if (idx === -1) throw new AppError(404, 'Product not found.');
      const current = state.products[idx];

      if (input.sku) {
        const sku = input.sku.trim().toUpperCase();
        if (state.products.some((p) => p.id !== id && p.sku.toUpperCase() === sku)) {
          throw new AppError(409, 'SKU is already assigned to another product.');
        }
        current.sku = sku;
      }

      const updated: ProductDTO = {
        ...current,
        ...input,
        sku: current.sku,
        costPrice: input.costPrice !== undefined ? roundCurrency(input.costPrice) : current.costPrice,
        sellingPrice:
          input.sellingPrice !== undefined ? roundCurrency(input.sellingPrice) : current.sellingPrice,
        updatedAt: now,
      };
      state.products[idx] = updated;
      await this.writeJsonState(state);
      return updated;
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.init();
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const res = await ProductModel.findByIdAndDelete(id);
        if (!res) throw new AppError(404, 'Product not found.');
        return;
      }
      const state = await this.readJsonState();
      const before = state.products.length;
      state.products = state.products.filter((p) => p.id !== id);
      if (state.products.length === before) throw new AppError(404, 'Product not found.');
      await this.writeJsonState(state);
    });
  }

  // --- Stock Movements (Atomic) ---

  async listStockMovements(): Promise<StockMovementDTO[]> {
    await this.init();
    if (this.useMongo) {
      const docs = await StockMovementModel.find().sort({ createdAt: -1 }).limit(300);
      return docs.map((d) => docToObject<StockMovementDTO>(d));
    }
    const state = await this.readJsonState();
    return [...state.stockMovements].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async recordStockMovement(input: {
    productId: string;
    type: MovementType;
    quantity: number;
    supplierId?: string;
    reference: string;
    notes: string;
    performedBy: string;
  }): Promise<{ product: ProductDTO; movement: StockMovementDTO }> {
    await this.init();
    return this.runSerialized(async () => {
      if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
        throw new AppError(400, 'Movement quantity must be a positive whole number.');
      }

      const now = new Date().toISOString();
      const movId = `mov_${crypto.randomUUID().slice(0, 10)}`;

      if (this.useMongo) {
        const product = await ProductModel.findById(input.productId);
        if (!product) throw new AppError(404, 'Product not found.');

        const prevQty = product.quantity;
        let nextQty = prevQty;
        if (input.type === 'IN') {
          nextQty = prevQty + input.quantity;
        } else if (input.type === 'OUT') {
          if (prevQty < input.quantity) {
            throw new AppError(
              400,
              `Insufficient stock for ${product.name}. Available: ${prevQty}, requested: ${input.quantity}.`
            );
          }
          nextQty = prevQty - input.quantity;
        } else {
          nextQty = input.quantity;
        }

        let supplierName = '';
        if (input.supplierId) {
          const sup = await SupplierModel.findById(input.supplierId);
          supplierName = sup?.name || '';
        }

        product.quantity = nextQty;
        product.updatedAt = now;
        await product.save();

        const movementDoc = await StockMovementModel.create({
          _id: movId,
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          type: input.type,
          quantity: input.quantity,
          previousQuantity: prevQty,
          newQuantity: nextQty,
          supplierId: input.supplierId || '',
          supplierName,
          reference: input.reference.trim(),
          notes: input.notes.trim(),
          performedBy: input.performedBy,
          createdAt: now,
        });

        return {
          product: docToObject<ProductDTO>(product),
          movement: docToObject<StockMovementDTO>(movementDoc),
        };
      }

      const state = await this.readJsonState();
      const pIdx = state.products.findIndex((p) => p.id === input.productId);
      if (pIdx === -1) throw new AppError(404, 'Product not found.');

      const product = state.products[pIdx];
      const prevQty = product.quantity;
      let nextQty = prevQty;

      if (input.type === 'IN') {
        nextQty = prevQty + input.quantity;
      } else if (input.type === 'OUT') {
        if (prevQty < input.quantity) {
          throw new AppError(
            400,
            `Insufficient stock for ${product.name}. Available: ${prevQty}, requested: ${input.quantity}.`
          );
        }
        nextQty = prevQty - input.quantity;
      } else {
        nextQty = input.quantity;
      }

      const supplier = input.supplierId
        ? state.suppliers.find((s) => s.id === input.supplierId)
        : undefined;

      const updatedProduct: ProductDTO = {
        ...product,
        quantity: nextQty,
        updatedAt: now,
      };
      state.products[pIdx] = updatedProduct;

      const movement: StockMovementDTO = {
        id: movId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: input.type,
        quantity: input.quantity,
        previousQuantity: prevQty,
        newQuantity: nextQty,
        supplierId: supplier?.id,
        supplierName: supplier?.name,
        reference: input.reference.trim(),
        notes: input.notes.trim(),
        performedBy: input.performedBy,
        createdAt: now,
      };
      state.stockMovements.unshift(movement);
      await this.writeJsonState(state);

      return { product: updatedProduct, movement };
    });
  }

  // --- Sales (Atomic multi-item stock validation & deduction) ---

  async listSales(): Promise<SaleDTO[]> {
    await this.init();
    if (this.useMongo) {
      const docs = await SaleModel.find().sort({ createdAt: -1 }).limit(300);
      return docs.map((d) => docToObject<SaleDTO>(d));
    }
    const state = await this.readJsonState();
    return [...state.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSale(input: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    paymentMethod: SaleDTO['paymentMethod'];
    status: SaleDTO['status'];
    taxRate: number;
    notes?: string;
    items: Array<{ productId: string; quantity: number }>;
    createdBy: string;
  }): Promise<SaleDTO> {
    await this.init();
    return this.runSerialized(async () => {
      if (!input.items.length) {
        throw new AppError(400, 'An order must contain at least one line item.');
      }

      const consolidated = new Map<string, number>();
      for (const item of input.items) {
        if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
          throw new AppError(400, 'Each line item quantity must be a positive integer.');
        }
        consolidated.set(item.productId, (consolidated.get(item.productId) || 0) + item.quantity);
      }

      const now = new Date().toISOString();
      const saleId = `sale_${crypto.randomUUID().slice(0, 10)}`;

      if (this.useMongo) {
        const productIds = Array.from(consolidated.keys());
        const docs = await ProductModel.find({ _id: { $in: productIds } });
        const docMap = new Map(docs.map((d) => [String(d._id), d]));

        const saleItems: SaleItemDTO[] = [];
        for (const [productId, qty] of consolidated.entries()) {
          const prod = docMap.get(productId);
          if (!prod) throw new AppError(404, `Product ${productId} not found.`);
          if (prod.quantity < qty) {
            throw new AppError(
              400,
              `Insufficient stock for ${prod.name}. Available: ${prod.quantity}, requested: ${qty}.`
            );
          }
          saleItems.push({
            productId: String(prod._id),
            productName: prod.name,
            sku: prod.sku,
            quantity: qty,
            unitPrice: prod.sellingPrice,
            costPrice: prod.costPrice,
            lineTotal: roundCurrency(qty * prod.sellingPrice),
          });
        }

        const totals = calculateSaleTotals(saleItems, input.taxRate);
        const existingSalesCount = await SaleModel.countDocuments();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(1001 + existingSalesCount).padStart(4, '0')}`;

        const saleDoc = await SaleModel.create({
          _id: saleId,
          invoiceNumber,
          customerName: input.customerName.trim(),
          customerEmail: input.customerEmail.trim(),
          customerPhone: input.customerPhone.trim(),
          items: saleItems,
          subtotal: totals.subtotal,
          taxRate: input.taxRate,
          taxAmount: totals.taxAmount,
          total: totals.total,
          paymentMethod: input.paymentMethod,
          status: input.status,
          notes: input.notes?.trim() || '',
          createdBy: input.createdBy,
          createdAt: now,
        });

        for (const item of saleItems) {
          const prod = docMap.get(item.productId)!;
          const prevQty = prod.quantity;
          prod.quantity = prevQty - item.quantity;
          prod.updatedAt = now;
          await prod.save();

          await StockMovementModel.create({
            _id: `mov_${crypto.randomUUID().slice(0, 10)}`,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            type: 'OUT',
            quantity: item.quantity,
            previousQuantity: prevQty,
            newQuantity: prod.quantity,
            reference: invoiceNumber,
            notes: `Sold to ${input.customerName.trim()}`,
            performedBy: input.createdBy,
            createdAt: now,
          });
        }

        return docToObject<SaleDTO>(saleDoc);
      }

      const state = await this.readJsonState();
      const saleItems: SaleItemDTO[] = [];

      // First pass: validate stock sufficiency for all items atomically before mutating
      for (const [productId, qty] of consolidated.entries()) {
        const prod = state.products.find((p) => p.id === productId);
        if (!prod) throw new AppError(404, `Product ${productId} not found.`);
        if (prod.quantity < qty) {
          throw new AppError(
            400,
            `Insufficient stock for ${prod.name}. Available: ${prod.quantity}, requested: ${qty}.`
          );
        }
        saleItems.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: qty,
          unitPrice: prod.sellingPrice,
          costPrice: prod.costPrice,
          lineTotal: roundCurrency(qty * prod.sellingPrice),
        });
      }

      const totals = calculateSaleTotals(saleItems, input.taxRate);
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(1041 + state.sales.length).padStart(4, '0')}`;

      const sale: SaleDTO = {
        id: saleId,
        invoiceNumber,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail.trim(),
        customerPhone: input.customerPhone.trim(),
        items: saleItems,
        subtotal: totals.subtotal,
        taxRate: input.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        paymentMethod: input.paymentMethod,
        status: input.status,
        notes: input.notes?.trim() || '',
        createdBy: input.createdBy,
        createdAt: now,
      };

      // Second pass: apply deductions and log movements
      for (const item of saleItems) {
        const idx = state.products.findIndex((p) => p.id === item.productId);
        const prod = state.products[idx];
        const prevQty = prod.quantity;
        const nextQty = prevQty - item.quantity;
        state.products[idx] = { ...prod, quantity: nextQty, updatedAt: now };

        state.stockMovements.unshift({
          id: `mov_${crypto.randomUUID().slice(0, 10)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          type: 'OUT',
          quantity: item.quantity,
          previousQuantity: prevQty,
          newQuantity: nextQty,
          reference: invoiceNumber,
          notes: `Sold to ${input.customerName.trim()}`,
          performedBy: input.createdBy,
          createdAt: now,
        });
      }

      state.sales.unshift(sale);
      await this.writeJsonState(state);
      return sale;
    });
  }

  async updateSaleStatus(id: string, status: SaleDTO['status']): Promise<SaleDTO> {
    await this.init();
    return this.runSerialized(async () => {
      if (this.useMongo) {
        const sale = await SaleModel.findByIdAndUpdate(id, { status }, { new: true });
        if (!sale) throw new AppError(404, 'Invoice not found.');
        return docToObject<SaleDTO>(sale);
      }

      const state = await this.readJsonState();
      const idx = state.sales.findIndex((s) => s.id === id);
      if (idx === -1) throw new AppError(404, 'Invoice not found.');
      state.sales[idx] = { ...state.sales[idx], status };
      await this.writeJsonState(state);
      return state.sales[idx];
    });
  }
}

export const repository = new InventoryRepository();
