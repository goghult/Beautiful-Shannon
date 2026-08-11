# FinFlow - Advanced Personal Expense Tracker

FinFlow is an advanced, premium-tier personal expense tracker web application built with React, TypeScript, Tailwind CSS, and Supabase. It uses a high-performance dark-mode glassmorphic interface and incorporates integer-cent-based calculations to prevent floating-point rounding errors.

---

## 🚀 Tech Stack

* **Frontend:** React (TypeScript) + Vite
* **Styling:** Tailwind CSS + Glassmorphism Custom Token System
* **Backend Database & Auth:** Supabase (PostgreSQL, Row Level Security, pg_cron)
* **Server-side Logic:** Supabase Deno Edge Functions
* **Data Visualization:** Recharts
* **Testing:** Vitest

---

## ✨ Core Features

1. **Transaction Management:** Complete CRUD interface for expenses, income, and transfers.
2. **Account Balances (Auto-Triggered):** A database-level trigger ensures account balances are recalculated atomically on transaction inserts, updates, and soft-deletes.
3. **Auto-Categorization:** Descriptions typed by the user trigger a case-insensitive keyword matcher that auto-selects categories as they type.
4. **Intelligent Budgets:** Set monthly category budgets. Color-coded alerts automatically flag category spending when it exceeds **80% (warning)** or **100% (exceeded)** of the monthly allocation.
5. **Recurring Schedules:** Auto-generate recurring income/expenses (daily/weekly/monthly/yearly) using a Deno Edge Function scheduled with `pg_cron`.
6. **Multi-Currency:** Multi-account support with automatic conversions for transfers between accounts using a fixed exchange rate table.
7. **Reports & Exports:** Filter transactions by date range, account, type, or category, and export to CSV, or generate a printable PDF summary.

---

## 🛠️ Step-by-Step Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
* **Node.js** (v18.x or newer)
* **npm** (v9.x or newer)
* **Supabase Account** (if deploying online) or **Supabase CLI** (if developing locally)

### 2. Database Schema Configuration
To setup the database, you have two options depending on your hosting path:

#### Option A: Supabase Web Dashboard (Recommended)
1. Go to your project dashboard on [supabase.com](https://supabase.com/).
2. Click on the **SQL Editor** tab on the left sidebar.
3. Click **New Query**.
4. Open the SQL migration file located at [supabase/migrations/20260807000000_initial_schema.sql](file:///c:/Users/goghu/Documents/antigravity/beautiful-shannon/supabase/migrations/20260807000000_initial_schema.sql), copy its contents, paste them into the SQL editor, and click **Run**.
5. This initializes the tables, seeds the default categories, configures row-level security (RLS) policies, links triggers, and deploys the stored aggregation functions.

#### Option B: Supabase CLI (Local Development)
If you run a local Supabase stack, simply run:
```bash
supabase db reset
```
The CLI will automatically discover the migration inside `supabase/migrations/` and apply it to your local Postgres container.

### 3. Environment Configuration
Create a `.env` file at the root of the project:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> [!NOTE]
> If these values are omitted or incorrect, FinFlow will automatically launch in **Local Demo Mode** using local-storage-backed mock triggers. This allows developers to test the application's full functionality instantly without setting up a live database.

### 4. Installation & Dev Server
1. Clone this repository and open the workspace.
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the development server locally:
   ```bash
   npm run dev
   ```
4. Access the application in your browser at `http://localhost:5173`.

### 5. Deploying the Frontend to Vercel
This app is a static Vite frontend and can deploy cleanly on Vercel.

1. Create a new Vercel project and connect it to this repository.
2. Use the following settings:
   - Framework Preset: `Vite`
   - Root Directory: `/`
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy the project.

If you need a free Supabase backend, use Supabase Free tier for auth and your recurring edge function.

### 6. Deploying the Recurring Scheduler
The recurring transaction engine runs in Deno inside a Supabase Edge Function:
1. Log in to Supabase CLI:
   ```bash
   supabase login
   ```
2. Deploy the Edge Function:
   ```bash
   supabase functions deploy generate-recurring --project-ref your_project_ref
   ```
3. Configure the Edge Function's access keys in Supabase secrets so it can query templates:
   ```bash
   supabase secrets set --project-ref your_project_ref SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   Use `SERVICE_ROLE_KEY` instead of a name that starts with `SUPABASE_`, because Supabase CLI reserves that prefix.
4. Schedule the cron runner inside your Supabase dashboard or via SQL Editor using `pg_cron` (run every day at midnight):
   ```sql
   select cron.schedule(
     'generate-recurring-transactions',
     '0 0 * * *',
     $$ select net.http_post(
          'https://your_project_ref.supabase.co/functions/v1/generate-recurring',
          headers:=jsonb_build_object('Content-Type','application/json', 'Authorization', 'Bearer your_service_role_key')
        ) $$
   );
   ```

---

## 🧪 Running Unit Tests
Unit tests validate the core budgeting math, currency conversions, and date calculations:
```bash
npx vitest run
```
This runs the Vitest suite located in [src/tests/calculations.test.ts](file:///c:/Users/goghu/Documents/antigravity/beautiful-shannon/src/tests/calculations.test.ts) and logs the output.
