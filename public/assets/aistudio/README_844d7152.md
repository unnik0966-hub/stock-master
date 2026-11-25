# StockMaster – Inventory & Stock Management System

A full-stack commercial inventory, stock movement, supplier, sales invoicing, and analytics platform built with **React**, **Tailwind CSS**, **Recharts**, **Node.js**, **Express.js**, **MongoDB (Mongoose)**, and **JWT authentication**.

## Core Modules

- **Authentication & RBAC**: First-run administrator setup, staff registration, bcrypt password hashing, JWT Bearer authentication, and Admin/Staff role permissions.
- **Dashboard**: Real-time KPIs (Products, Categories, Suppliers, Inventory Valuation, Low-Stock Alerts, Sales Revenue), Monthly Sales Revenue area chart, Stock Availability stacked bar chart, and Recent Transactions ledger.
- **Product Management**: Full CRUD, SKU auto-generator, product image upload, search, category/status filters, multi-column sorting, and pagination.
- **Category Management**: CRUD operations and drill-down view of products per category.
- **Supplier Management**: Vendor directory CRUD and inbound purchase history inspection.
- **Stock Management**: Atomic Stock-In and Stock-Out movements, movement ledger, and low-stock notifications with one-click restock.
- **Sales Management**: Multi-item order builder with stock sufficiency validation, atomic stock deduction, auto-calculated tax/totals, sales history, and PDF invoice download.
- **Reports & Analytics**: Daily, Weekly, and Monthly sales reports, Inventory Valuation report, and Low-Stock replenishment report with **CSV** and **PDF** exports.
- **Users & Settings**: Admin team management, profile updates, password rotation, and role permissions matrix.

## Architecture

```
├── server.ts                    # Express + Vite server entry point (port 3000)
├── server/
│   ├── config/env.ts            # Environment & JWT secret configuration
│   ├── models/index.ts          # Mongoose schemas (User, Category, Supplier, Product, StockMovement, Sale)
│   ├── db/
│   │   ├── repository.ts        # MongoDB connection + transactional repository (with local persistent fallback)
│   │   └── seedData.ts          # Deterministic demo inventory dataset
│   ├── middleware/
│   │   ├── auth.ts              # JWT Bearer verification & RBAC guard
│   │   └── validate.ts          # Zod schema validation & NoSQL operator filtering
│   ├── controllers/             # Modular business logic controllers
│   └── routes/api.ts            # Express REST API router (/api/*)
├── src/
│   ├── utils/inventoryMath.ts   # Pure inventory, SKU, valuation, and sales math
│   ├── utils/exportUtils.ts     # CSV & jsPDF invoice/report generators
│   ├── context/                 # AuthContext (in-memory JWT) & ToastContext
│   └── components/              # Modular React views & reusable UI components
```

## Setup & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (copy `.env.example` to `.env`):
   - `MONGODB_URI`: Optional MongoDB connection string (e.g., `mongodb://127.0.0.1:27017/stockmaster`). If omitted, StockMaster automatically initializes a persistent atomic JSON store in `./data/stockmaster-db.json` with pre-loaded sample data.
   - `JWT_SECRET`: Secret key for signing JWT tokens (defaults to an ephemeral cryptographic random secret per process if unset).

3. Start the development server:
   ```bash
   npm run dev
   ```
   The application runs at `http://localhost:3000`.

4. Run unit tests:
   ```bash
   npx --yes tsx --test src/utils/inventoryMath.test.ts
   ```

5. Build for production:
   ```bash
   npm run build
   npm start
   ```
