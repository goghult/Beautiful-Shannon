-- Supabase Migration: Initial Schema Setup for Personal Expense Tracker

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  base_currency text not null default 'USD',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

-- 2. EXCHANGE RATES TABLE (Fixed Rates for multi-currency conversion)
create table public.exchange_rates (
  from_currency text not null,
  to_currency text not null,
  rate numeric(12, 6) not null check (rate > 0),
  updated_at timestamp with time zone default now() not null,
  primary key (from_currency, to_currency)
);

-- Seed exchange rates
insert into public.exchange_rates (from_currency, to_currency, rate) values
  ('USD', 'USD', 1.000000),
  ('EUR', 'USD', 1.100000),
  ('USD', 'EUR', 0.909091),
  ('GBP', 'USD', 1.280000),
  ('USD', 'GBP', 0.781250),
  ('INR', 'USD', 0.012000),
  ('USD', 'INR', 83.333333),
  ('JPY', 'USD', 0.006500),
  ('USD', 'JPY', 153.846154),
  ('CAD', 'USD', 0.730000),
  ('USD', 'CAD', 1.369863),
  ('AUD', 'USD', 0.650000),
  ('USD', 'AUD', 1.538462);

-- 3. ACCOUNTS TABLE
create table public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'checking', 'credit_card', 'savings')),
  currency text not null default 'USD',
  initial_balance_cents integer not null default 0,
  current_balance_cents integer not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

-- Index for account searches
create index accounts_user_id_idx on public.accounts(user_id) where deleted_at is null;

-- 4. CATEGORIES TABLE
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade, -- null means default system category
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text,
  icon text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

-- Index and unique constraints
create index categories_user_parent_idx on public.categories(user_id, parent_id) where deleted_at is null;
create unique index categories_user_parent_name_idx 
on public.categories (user_id, parent_id, name) 
where deleted_at is null;

-- 5. TRANSACTIONS TABLE
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  destination_account_id uuid references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  exchange_rate numeric(12, 6) not null default 1.0,
  date timestamp with time zone default now() not null,
  note text,
  payment_method text check (payment_method in ('cash', 'card', 'transfer', 'online_payment', 'other')),
  recurring_template_id uuid, -- filled if generated from template
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  
  constraint check_transaction_type_fields check (
    (type = 'transfer' and destination_account_id is not null and destination_account_id <> account_id) or
    (type <> 'transfer' and destination_account_id is null)
  )
);

create index transactions_user_date_idx on public.transactions(user_id, date desc) where deleted_at is null;
create index transactions_account_idx on public.transactions(account_id) where deleted_at is null;

-- 6. RECURRING TEMPLATES TABLE
create table public.recurring_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  destination_account_id uuid references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval integer not null default 1 check (interval > 0),
  start_date timestamp with time zone not null,
  end_date timestamp with time zone,
  last_generated_at timestamp with time zone,
  next_generation_date timestamp with time zone not null,
  note text,
  payment_method text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,

  constraint check_template_type_fields check (
    (type = 'transfer' and destination_account_id is not null and destination_account_id <> account_id) or
    (type <> 'transfer' and destination_account_id is null)
  )
);

create index recurring_templates_active_schedule_idx 
on public.recurring_templates(is_active, next_generation_date) 
where deleted_at is null;

-- 7. BUDGETS TABLE
create table public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  amount_cents integer not null check (amount_cents >= 0),
  month integer not null check (month >= 1 and month <= 12),
  year integer not null check (year >= 2000 and year <= 2100),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create unique index budgets_user_category_month_year_idx
on public.budgets (user_id, category_id, month, year)
where deleted_at is null;


-- ==========================================
-- TRIGGERS & FUNCTIONS
-- ==========================================

-- A. Auto-create Profile Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, base_currency)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'base_currency', 'USD')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- B. Balance Update Trigger on Transactions CRUD
create or replace function public.fn_update_account_balances()
returns trigger as $$
begin
  -- 1. REVERT OLD TRANSACTION (IF UPDATE OR DELETE)
  if (TG_OP = 'UPDATE' or TG_OP = 'DELETE') then
    if (OLD.deleted_at is null) then
      if OLD.type = 'expense' then
        update public.accounts 
        set current_balance_cents = current_balance_cents + OLD.amount_cents
        where id = OLD.account_id;
      elsif OLD.type = 'income' then
        update public.accounts 
        set current_balance_cents = current_balance_cents - OLD.amount_cents
        where id = OLD.account_id;
      elsif OLD.type = 'transfer' then
        update public.accounts 
        set current_balance_cents = current_balance_cents + OLD.amount_cents
        where id = OLD.account_id;
        
        update public.accounts 
        set current_balance_cents = current_balance_cents - cast(OLD.amount_cents * OLD.exchange_rate as integer)
        where id = OLD.destination_account_id;
      end if;
    end if;
  end if;

  -- 2. APPLY NEW TRANSACTION (IF INSERT OR UPDATE)
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    if (NEW.deleted_at is null) then
      if NEW.type = 'expense' then
        update public.accounts 
        set current_balance_cents = current_balance_cents - NEW.amount_cents
        where id = NEW.account_id;
      elsif NEW.type = 'income' then
        update public.accounts 
        set current_balance_cents = current_balance_cents + NEW.amount_cents
        where id = NEW.account_id;
      elsif NEW.type = 'transfer' then
        update public.accounts 
        set current_balance_cents = current_balance_cents - NEW.amount_cents
        where id = NEW.account_id;
        
        update public.accounts 
        set current_balance_cents = current_balance_cents + cast(NEW.amount_cents * NEW.exchange_rate as integer)
        where id = NEW.destination_account_id;
      end if;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_update_account_balances
after insert or update or delete on public.transactions
for each row execute function public.fn_update_account_balances();


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.budgets enable row level security;
alter table public.exchange_rates enable row level security;

-- Profiles Policies
create policy "Users can view own profile" on public.profiles for select using (id = auth.uid());
create policy "Users can update own profile" on public.profiles for update using (id = auth.uid());

-- Accounts Policies
create policy "Users can view own accounts" on public.accounts for select using (user_id = auth.uid() and deleted_at is null);
create policy "Users can insert own accounts" on public.accounts for insert with check (user_id = auth.uid());
create policy "Users can update own accounts" on public.accounts for update using (user_id = auth.uid() and deleted_at is null);

-- Categories Policies
create policy "Users can view categories" on public.categories for select using ((user_id is null or user_id = auth.uid()) and deleted_at is null);
create policy "Users can insert own categories" on public.categories for insert with check (user_id = auth.uid());
create policy "Users can update own categories" on public.categories for update using (user_id = auth.uid() and deleted_at is null);

-- Transactions Policies
create policy "Users can view own transactions" on public.transactions for select using (user_id = auth.uid() and deleted_at is null);
create policy "Users can insert own transactions" on public.transactions for insert with check (user_id = auth.uid());
create policy "Users can update own transactions" on public.transactions for update using (user_id = auth.uid() and deleted_at is null);

-- Recurring Templates Policies
create policy "Users can view own templates" on public.recurring_templates for select using (user_id = auth.uid() and deleted_at is null);
create policy "Users can insert own templates" on public.recurring_templates for insert with check (user_id = auth.uid());
create policy "Users can update own templates" on public.recurring_templates for update using (user_id = auth.uid() and deleted_at is null);

-- Budgets Policies
create policy "Users can view own budgets" on public.budgets for select using (user_id = auth.uid() and deleted_at is null);
create policy "Users can insert own budgets" on public.budgets for insert with check (user_id = auth.uid());
create policy "Users can update own budgets" on public.budgets for update using (user_id = auth.uid() and deleted_at is null);

-- Exchange Rates (Read-only for everyone)
create policy "Anyone can view exchange rates" on public.exchange_rates for select using (true);


-- ==========================================
-- STORED PROCEDURES (RPCs)
-- ==========================================

-- 1. get_budget_status: Calculates budget vs spent per category
create or replace function public.get_budget_status(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  category_id uuid,
  category_name text,
  parent_category_name text,
  budget_amount_cents integer,
  spent_amount_cents integer,
  percentage numeric,
  alert_level text
) as $$
begin
  return query
  with category_spent as (
    -- Collect expenses in current month
    select 
      t.category_id,
      coalesce(sum(t.amount_cents), 0)::integer as spent
    from public.transactions t
    where t.user_id = p_user_id
      and extract(year from t.date) = p_year
      and extract(month from t.date) = p_month
      and t.type = 'expense'
      and t.deleted_at is null
    group by t.category_id
  )
  select 
    c.id as category_id,
    c.name as category_name,
    parent.name as parent_category_name,
    coalesce(b.amount_cents, 0)::integer as budget_amount_cents,
    coalesce(s.spent, 0)::integer as spent_amount_cents,
    case 
      when coalesce(b.amount_cents, 0) = 0 then 0.0
      else round((coalesce(s.spent, 0)::numeric / b.amount_cents::numeric) * 100, 2)
    end as percentage,
    case 
      when coalesce(b.amount_cents, 0) = 0 then 'OK'
      when coalesce(s.spent, 0)::numeric / b.amount_cents::numeric >= 1.0 then 'ALERT_100'
      when coalesce(s.spent, 0)::numeric / b.amount_cents::numeric >= 0.8 then 'WARN_80'
      else 'OK'
    end as alert_level
  from public.categories c
  join public.budgets b on b.category_id = c.id
  left join public.categories parent on c.parent_id = parent.id
  left join category_spent s on s.category_id = c.id
  where b.user_id = p_user_id 
    and b.month = p_month 
    and b.year = p_year
    and b.deleted_at is null
    and c.deleted_at is null;
end;
$$ language plpgsql security definer;


-- 2. get_dashboard_summary: Income, Expense, Net savings, MoM indicators
create or replace function public.get_dashboard_summary(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  total_income_cents integer,
  total_expense_cents integer,
  net_savings_cents integer,
  prev_month_expense_cents integer,
  mom_expense_percentage numeric
) as $$
declare
  v_income integer := 0;
  v_expense integer := 0;
  v_prev_expense integer := 0;
  v_prev_month integer;
  v_prev_year integer;
begin
  -- Compute current month sums
  select coalesce(sum(amount_cents), 0)::integer
  into v_income
  from public.transactions
  where user_id = p_user_id 
    and extract(year from date) = p_year 
    and extract(month from date) = p_month 
    and type = 'income' 
    and deleted_at is null;

  select coalesce(sum(amount_cents), 0)::integer
  into v_expense
  from public.transactions
  where user_id = p_user_id 
    and extract(year from date) = p_year 
    and extract(month from date) = p_month 
    and type = 'expense' 
    and deleted_at is null;

  -- Determine previous month details
  if p_month = 1 then
    v_prev_month := 12;
    v_prev_year := p_year - 1;
  else
    v_prev_month := p_month - 1;
    v_prev_year := p_year;
  end if;

  select coalesce(sum(amount_cents), 0)::integer
  into v_prev_expense
  from public.transactions
  where user_id = p_user_id 
    and extract(year from date) = v_prev_year 
    and extract(month from date) = v_prev_month 
    and type = 'expense' 
    and deleted_at is null;

  return query
  select 
    v_income,
    v_expense,
    (v_income - v_expense),
    v_prev_expense,
    case 
      when v_prev_expense = 0 then 0.0
      else round(((v_expense - v_prev_expense)::numeric / v_prev_expense::numeric) * 100, 2)
    end;
end;
$$ language plpgsql security definer;


-- 3. get_monthly_trends: Monthly sums for the last 12 months
create or replace function public.get_monthly_trends(
  p_user_id uuid
)
returns table (
  month_name text,
  year_num integer,
  month_num integer,
  income_cents integer,
  expense_cents integer
) as $$
begin
  return query
  with dates as (
    -- Generate series of the last 12 months
    select 
      extract(year from d)::integer as yr,
      extract(month from d)::integer as mth,
      to_char(d, 'Mon') as mth_name
    from generate_series(
      now() - interval '11 months',
      now(),
      interval '1 month'
    ) d
  )
  select 
    d.mth_name::text,
    d.yr,
    d.mth,
    coalesce(sum(case when t.type = 'income' then t.amount_cents else 0 end), 0)::integer as income_cents,
    coalesce(sum(case when t.type = 'expense' then t.amount_cents else 0 end), 0)::integer as expense_cents
  from dates d
  left join public.transactions t on t.user_id = p_user_id
    and extract(year from t.date) = d.yr
    and extract(month from t.date) = d.mth
    and t.deleted_at is null
  group by d.yr, d.mth, d.mth_name
  order by d.yr asc, d.mth asc;
end;
$$ language plpgsql security definer;


-- ==========================================
-- SEED SYSTEM DEFAULT CATEGORIES
-- ==========================================

-- Insert parent categories first, then their children
do $$
declare
  food_id uuid;
  trans_id uuid;
  bills_id uuid;
  ent_id uuid;
  shop_id uuid;
  health_id uuid;
begin
  -- 1. INCOME (No subcategories required, direct system categories)
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, null, 'Salary', 'income', '#10B981', 'briefcase'),
    (null, null, 'Freelance', 'income', '#34D399', 'laptop'),
    (null, null, 'Investments', 'income', '#6EE7B7', 'trending-up'),
    (null, null, 'Gifts & Grants', 'income', '#A7F3D0', 'gift'),
    (null, null, 'Other Income', 'income', '#059669', 'plus-circle');

  -- 2. EXPENSE PARENTS
  insert into public.categories (user_id, parent_id, name, type, color, icon) 
    values (null, null, 'Food & Dining', 'expense', '#EF4444', 'utensils')
    returning id into food_id;

  insert into public.categories (user_id, parent_id, name, type, color, icon) 
    values (null, null, 'Transport', 'expense', '#F59E0B', 'car')
    returning id into trans_id;

  insert into public.categories (user_id, parent_id, name, type, color, icon) 
    values (null, null, 'Bills & Utilities', 'expense', '#3B82F6', 'credit-card')
    returning id into bills_id;

  insert into public.categories (user_id, parent_id, name, type, color, icon) 
    values (null, null, 'Entertainment', 'expense', '#8B5CF6', 'tv')
    returning id into ent_id;

  insert into public.categories (user_id, parent_id, name, type, color, icon) 
    values (null, null, 'Shopping', 'expense', '#EC4899', 'shopping-bag')
    returning id into shop_id;

  insert into public.categories (user_id, parent_id, name, type, color, icon) 
    values (null, null, 'Health & Fitness', 'expense', '#10B981', 'heart')
    returning id into health_id;

  -- Generic expense parents
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, null, 'Education', 'expense', '#6366F1', 'book-open'),
    (null, null, 'Travel', 'expense', '#14B8A6', 'plane'),
    (null, null, 'Miscellaneous', 'expense', '#6B7280', 'help-circle');

  -- 3. EXPENSE CHILDREN (SUBCATEGORIES)
  -- Food children
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, food_id, 'Groceries', 'expense', '#F87171', 'shopping-cart'),
    (null, food_id, 'Restaurants', 'expense', '#FCA5A5', 'coffee'),
    (null, food_id, 'Fast Food', 'expense', '#FEE2E2', 'pizza');

  -- Transport children
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, trans_id, 'Fuel', 'expense', '#FBBF24', 'droplet'),
    (null, trans_id, 'Public Transport', 'expense', '#FDE68A', 'bus'),
    (null, trans_id, 'Taxi & Rideshare', 'expense', '#FEF3C7', 'navigation');

  -- Bills children
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, bills_id, 'Electricity', 'expense', '#60A5FA', 'zap'),
    (null, bills_id, 'Water', 'expense', '#93C5FD', 'droplet'),
    (null, bills_id, 'Internet', 'expense', '#BFDBFE', 'wifi'),
    (null, bills_id, 'Phone', 'expense', '#DBEAFE', 'smartphone');

  -- Entertainment children
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, ent_id, 'Movies', 'expense', '#A78BFA', 'film'),
    (null, ent_id, 'Games', 'expense', '#C4B5FD', 'gamepad-2'),
    (null, ent_id, 'Subscriptions', 'expense', '#DDD6FE', 'youtube');

  -- Shopping children
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, shop_id, 'Clothing', 'expense', '#F472B6', 'shirt'),
    (null, shop_id, 'Electronics', 'expense', '#F9A8D4', 'laptop');

  -- Health children
  insert into public.categories (user_id, parent_id, name, type, color, icon) values
    (null, health_id, 'Gym', 'expense', '#34D399', 'dumbbell'),
    (null, health_id, 'Medical', 'expense', '#6EE7B7', 'pill');

end $$;
