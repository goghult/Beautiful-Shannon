export type AccountType = 'cash' | 'checking' | 'credit_card' | 'savings';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type PaymentMethodType = 'cash' | 'card' | 'transfer' | 'online_payment' | 'other';
export type AlertLevelType = 'OK' | 'WARN_80' | 'ALERT_100';

export interface Profile {
  id: string;
  name: string | null;
  base_currency: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_cents: number;
  current_balance_cents: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Category {
  id: string;
  user_id: string | null; // null for system default categories
  parent_id: string | null;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  parent?: Category | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  destination_account_id?: string | null;
  category_id?: string | null;
  type: TransactionType;
  amount_cents: number;
  currency: string;
  exchange_rate: number;
  date: string;
  note?: string | null;
  payment_method?: PaymentMethodType | null;
  recurring_template_id?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  
  // Joins
  account?: Account;
  destination_account?: Account;
  category?: Category;
}

export interface RecurringTemplate {
  id: string;
  user_id: string;
  account_id: string;
  destination_account_id?: string | null;
  category_id?: string | null;
  type: TransactionType;
  amount_cents: number;
  currency: string;
  frequency: FrequencyType;
  interval: number;
  start_date: string;
  end_date?: string | null;
  last_generated_at?: string | null;
  next_generation_date: string;
  note?: string | null;
  payment_method?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  account?: Account;
  destination_account?: Account;
  category?: Category;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount_cents: number;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  category?: Category;
}

export interface BudgetStatus {
  category_id: string;
  category_name: string;
  parent_category_name: string | null;
  budget_amount_cents: number;
  spent_amount_cents: number;
  percentage: number;
  alert_level: AlertLevelType;
}

export interface DashboardSummary {
  total_income_cents: number;
  total_expense_cents: number;
  net_savings_cents: number;
  prev_month_expense_cents: number;
  mom_expense_percentage: number;
}

export interface MonthlyTrend {
  month_name: string;
  year_num: number;
  month_num: number;
  income_cents: number;
  expense_cents: number;
}
