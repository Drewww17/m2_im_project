# AgriVet Retail Management System

Next.js + Prisma + MySQL/MariaDB web app for POS, inventory, customer credit, suppliers, purchase orders, and reports.

## 1) Requirements

- Node.js 18+
- MySQL or MariaDB server
- npm

## 2) Install dependencies

```bash
npm install
```

## 3) Configure database connection

Create `.env` in project root:

```env
DATABASE_URL="mysql://root:password@localhost:3306/agrivet_db"
JWT_SECRET="change-this-to-a-strong-secret"
```

Replace `root`, `password`, host, port, and database name with your actual DB values.

## 4) Put your AgriVet database

You can do either option below:

### Option A: Use your existing AgriVet database dump (`.sql`)

1. Create a database (if needed):

```sql
CREATE DATABASE agrivet_db;
```

2. Import your SQL dump into `agrivet_db` (via phpMyAdmin, MySQL Workbench, or CLI).
3. Keep `DATABASE_URL` pointed to that database.
4. Run:

```bash
npx prisma db pull
npx prisma generate
```

### Option B: Start from Prisma schema (empty DB)

1. Create an empty database (e.g. `agrivet_db`).
2. Run:

```bash
npx prisma db push
npx prisma generate
```

## 5) Create first manager account (one-time bootstrap)

`/api/auth/register` is manager-protected, so first manager must be inserted once via script.

Run this in PowerShell from project root:

```powershell
node -e "const bcrypt=require('bcryptjs'); const {PrismaClient}=require('@prisma/client'); (async()=>{ const prisma=new PrismaClient(); const username='admin'; const password='admin123'; const fullName='System Admin'; const hash=await bcrypt.hash(password,10); const existing=await prisma.users.findUnique({where:{username}}); if(existing){console.log('User already exists:', username);} else {await prisma.users.create({data:{username,password_hash:hash,full_name:fullName,role:'MANAGER',is_active:true}}); console.log('Created manager:', username, 'password:', password);} await prisma.$disconnect(); })().catch(async(e)=>{console.error(e); process.exit(1);});"
```

Change the username/password immediately after first login.

## 6) Run the app

```bash
npm run dev
```

Open http://localhost:3000

## 7) How to log in

1. Go to `http://localhost:3000/login`
2. Enter the manager credentials you created in step 5
3. After login, you are redirected to the POS/dashboard based on access

## 8) Create more users

Once logged in as manager, create additional users through:

- `POST /api/auth/register` (manager-only)

Payload example:

```json
{
	"username": "cashier1",
	"password": "cashier123",
	"fullName": "Cashier One",
	"role": "CASHIER"
}
```

## 9) Useful commands

```bash
npm run dev
npm run lint
npx prisma studio
```

## 10) Full instruction: open and use the application

### A. Open the app (everyday startup)

1. Start your MySQL/MariaDB service.
2. Open terminal in project root.
3. Run:

```bash
npm run dev
```

4. Open your browser:

- Login page: http://localhost:3000/login
- App root: http://localhost:3000

### B. First-time system setup flow

Use this order so data dependencies are correct:

1. Login as manager account.
2. Add suppliers in Suppliers page.
3. Add products in Products page.
4. Add inventory via:

- Purchase Orders -> Receive Delivery, or
- Inventory -> Add Stock

5. Add customers (optional for credit sales).
6. Start selling in POS page.

### C. Daily operations flow (recommended)

1. Check Dashboard (manager) for KPIs and alerts.
2. Check Inventory alerts for low stock / expiring items.
3. Create Purchase Orders for low stock products.
4. Receive supplier deliveries and update batch/expiry.
5. Process transactions in POS.
6. Review Sales History for returns/void checks.
7. Export Reports (Daily Sales / Ledger) at end of day.

### D. How to use each module

- POS (`/pos`): scan/search product, add cart, pick payment method (cash/credit/mixed), complete sale.
- Products (`/products`): create/edit products, set category, pricing, reorder level.
- Customers (`/customers`): manage customer records, credit limits, and payment posting.
- Suppliers (`/suppliers`): manage supplier records and payable payments.
- Inventory (`/inventory`): monitor stock batches, expiry, adjustments, and conversions.
- Purchase Orders (`/purchase-orders`): create orders, track status, receive partial/full deliveries.
- Sales (`/sales`): inspect invoices, sale details, and void transactions.
- Reports (`/reports`): generate/export daily sales and ledger CSV.
- Dashboard (`/dashboard`): revenue summary, trends, receivables/payables, top metrics.

### E. Role access guide

- CASHIER: POS-focused operations.
- CLERK: cashier access + master data/stock/supplier workflows.
- MANAGER: full access including reports and user registration API.

### F. Logout and session

- Use the sidebar logout.
- Session is cookie-based JWT (default 24h).
- If access is denied, login again with an account that has the required role.

## 11) Quick API test for creating users (optional)

After logging in as manager, you can create users with tools like Postman:

- Method: `POST`
- URL: `http://localhost:3000/api/auth/register`
- Body:

```json
{
	"username": "clerk1",
	"password": "clerk123",
	"fullName": "Clerk One",
	"role": "CLERK"
}
```

## 12) Common startup issues

- `npm run dev` exits immediately:
	- check `.env` exists and `DATABASE_URL` is valid.
	- ensure DB server is running and reachable.
	- run `npx prisma generate` again.
- Login fails with `Invalid credentials`:
	- verify manager bootstrap user exists in `users` table.
	- re-run bootstrap command in step 5 if needed.
- Blank/empty tables in UI:
	- seed or import data first (products, suppliers, inventory).
