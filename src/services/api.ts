import { supabase } from './supabase';
import type { 
  Account, Category, Transaction, Budget, RecurringTemplate, 
  BudgetStatus, DashboardSummary, MonthlyTrend, AlertLevelType, ExchangeRate
} from '../types';
import { seedUserData } from './seedService';

// Helper to determine if we are in demo mode
export function getIsDemoMode(): boolean {
  return localStorage.getItem('finflow_demo_mode') === 'true';
}

export function setIsDemoMode(val: boolean) {
  localStorage.setItem('finflow_demo_mode', val ? 'true' : 'false');
}

// ----------------------------------------------------
// LOCAL STORAGE STORE (MOCK DATABASE)
// ----------------------------------------------------
const STORAGE_KEYS = {
  ACCOUNTS: 'ff_db_accounts',
  CATEGORIES: 'ff_db_categories',
  TRANSACTIONS: 'ff_db_transactions',
  BUDGETS: 'ff_db_budgets',
  TEMPLATES: 'ff_db_templates',
  RATES: 'ff_db_rates',
};

const DEFAULT_RATES: ExchangeRate[] = [
  { from_currency: 'USD', to_currency: 'USD', rate: 1.0, updated_at: '' },
  { from_currency: 'EUR', to_currency: 'USD', rate: 1.10, updated_at: '' },
  { from_currency: 'USD', to_currency: 'EUR', rate: 0.909091, updated_at: '' },
  { from_currency: 'GBP', to_currency: 'USD', rate: 1.28, updated_at: '' },
  { from_currency: 'USD', to_currency: 'GBP', rate: 0.78125, updated_at: '' },
  { from_currency: 'INR', to_currency: 'USD', rate: 0.012, updated_at: '' },
  { from_currency: 'USD', to_currency: 'INR', rate: 83.333333, updated_at: '' },
];

function getLocalData<T>(key: string, defaultVal: T): T {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
}

function setLocalData<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Initialize Local Categories if empty
export function initLocalCategories() {
  const existing = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);
  if (existing.length > 0) return;

  const mockCategories: Category[] = [];
  const addCat = (name: string, type: 'income' | 'expense', color: string, icon: string, parentId: string | null = null): string => {
    const id = Math.random().toString(36).substring(2, 9);
    mockCategories.push({
      id,
      user_id: null,
      parent_id: parentId,
      name,
      type,
      color,
      icon,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    return id;
  };

  // Income categories
  addCat('Salary', 'income', '#10B981', 'briefcase');
  addCat('Freelance', 'income', '#34D399', 'laptop');
  addCat('Investments', 'income', '#6EE7B7', 'trending-up');
  addCat('Gifts', 'income', '#A7F3D0', 'gift');
  addCat('Other Income', 'income', '#059669', 'plus-circle');

  // Expense parents & children
  const foodId = addCat('Food & Dining', 'expense', '#EF4444', 'utensils');
  addCat('Groceries', 'expense', '#F87171', 'shopping-cart', foodId);
  addCat('Restaurants', 'expense', '#FCA5A5', 'coffee', foodId);

  const transId = addCat('Transport', 'expense', '#F59E0B', 'car');
  addCat('Fuel', 'expense', '#FBBF24', 'droplet', transId);
  addCat('Taxi & Rideshare', 'expense', '#FEF3C7', 'navigation', transId);

  const billsId = addCat('Bills & Utilities', 'expense', '#3B82F6', 'credit-card');
  addCat('Electricity', 'expense', '#60A5FA', 'zap', billsId);
  addCat('Internet', 'expense', '#BFDBFE', 'wifi', billsId);
  addCat('Phone', 'expense', '#DBEAFE', 'smartphone', billsId);

  const entId = addCat('Entertainment', 'expense', '#8B5CF6', 'tv');
  addCat('Movies', 'expense', '#A78BFA', 'film', entId);
  addCat('Subscriptions', 'expense', '#DDD6FE', 'youtube', entId);

  const shopId = addCat('Shopping', 'expense', '#EC4899', 'shopping-bag');
  addCat('Clothing', 'expense', '#F472B6', 'shirt', shopId);
  addCat('Electronics', 'expense', '#F9A8D4', 'laptop', shopId);

  const healthId = addCat('Health & Fitness', 'expense', '#10B981', 'heart');
  addCat('Gym', 'expense', '#34D399', 'dumbbell', healthId);
  addCat('Medical', 'expense', '#6EE7B7', 'pill', healthId);

  setLocalData(STORAGE_KEYS.CATEGORIES, mockCategories);
}

// ----------------------------------------------------
// TRANSACTION BALANCE TRIGGER SIMULATION FOR DEMO MODE
// ----------------------------------------------------
function simulateLocalBalanceTrigger(
  op: 'insert' | 'update' | 'delete',
  newTx: Transaction | null,
  oldTx: Transaction | null
) {
  const accounts = getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
  
  const updateBalance = (accId: string, diffCents: number) => {
    const accIdx = accounts.findIndex(a => a.id === accId);
    if (accIdx !== -1) {
      accounts[accIdx].current_balance_cents += diffCents;
    }
  };

  // Revert old transaction effects
  if ((op === 'update' || op === 'delete') && oldTx && !oldTx.deleted_at) {
    if (oldTx.type === 'expense') {
      updateBalance(oldTx.account_id, oldTx.amount_cents);
    } else if (oldTx.type === 'income') {
      updateBalance(oldTx.account_id, -oldTx.amount_cents);
    } else if (oldTx.type === 'transfer' && oldTx.destination_account_id) {
      updateBalance(oldTx.account_id, oldTx.amount_cents);
      updateBalance(oldTx.destination_account_id, -Math.round(oldTx.amount_cents * oldTx.exchange_rate));
    }
  }

  // Apply new transaction effects
  if ((op === 'insert' || op === 'update') && newTx && !newTx.deleted_at) {
    if (newTx.type === 'expense') {
      updateBalance(newTx.account_id, -newTx.amount_cents);
    } else if (newTx.type === 'income') {
      updateBalance(newTx.account_id, newTx.amount_cents);
    } else if (newTx.type === 'transfer' && newTx.destination_account_id) {
      updateBalance(newTx.account_id, -newTx.amount_cents);
      updateBalance(newTx.destination_account_id, Math.round(newTx.amount_cents * newTx.exchange_rate));
    }
  }

  setLocalData(STORAGE_KEYS.ACCOUNTS, accounts);
}


// ----------------------------------------------------
// EXPORTED INTEGRATED API CLIENT
// ----------------------------------------------------
export const api = {
  // --- ACCOUNTS ---
  async getAccounts(): Promise<Account[]> {
    if (getIsDemoMode()) {
      return getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []).filter(a => !a.deleted_at);
    }
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async createAccount(name: string, type: Account['type'], currency: string, initialBalanceCents: number): Promise<Account> {
    if (getIsDemoMode()) {
      const accounts = getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
      const newAcc: Account = {
        id: Math.random().toString(36).substring(2, 9),
        user_id: 'demo_user',
        name,
        type,
        currency,
        initial_balance_cents: initialBalanceCents,
        current_balance_cents: initialBalanceCents,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };
      accounts.push(newAcc);
      setLocalData(STORAGE_KEYS.ACCOUNTS, accounts);
      return newAcc;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name,
        type,
        currency,
        initial_balance_cents: initialBalanceCents,
        current_balance_cents: initialBalanceCents // trigger doesn't update initial, only transactions
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAccount(id: string, name: string, type: Account['type']): Promise<Account> {
    if (getIsDemoMode()) {
      const accounts = getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
      const idx = accounts.findIndex(a => a.id === id);
      if (idx === -1) throw new Error("Account not found");
      accounts[idx] = { ...accounts[idx], name, type, updated_at: new Date().toISOString() };
      setLocalData(STORAGE_KEYS.ACCOUNTS, accounts);
      return accounts[idx];
    }
    const { data, error } = await supabase
      .from('accounts')
      .update({ name, type, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAccount(id: string): Promise<void> {
    if (getIsDemoMode()) {
      const accounts = getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
      const idx = accounts.findIndex(a => a.id === id);
      if (idx !== -1) {
        accounts[idx].deleted_at = new Date().toISOString();
        setLocalData(STORAGE_KEYS.ACCOUNTS, accounts);
      }
      return;
    }
    const { error } = await supabase
      .from('accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    initLocalCategories();
    if (getIsDemoMode()) {
      return getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []).filter(c => !c.deleted_at);
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async createCategory(name: string, type: 'income' | 'expense', color: string, icon: string, parentId: string | null = null): Promise<Category> {
    if (getIsDemoMode()) {
      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      const newCat: Category = {
        id: Math.random().toString(36).substring(2, 9),
        user_id: 'demo_user',
        parent_id: parentId,
        name,
        type,
        color,
        icon,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };
      categories.push(newCat);
      setLocalData(STORAGE_KEYS.CATEGORIES, categories);
      return newCat;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        parent_id: parentId,
        name,
        type,
        color,
        icon
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id: string, name: string, color: string, icon: string): Promise<Category> {
    if (getIsDemoMode()) {
      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      const idx = categories.findIndex(c => c.id === id);
      if (idx === -1) throw new Error("Category not found");
      categories[idx] = { ...categories[idx], name, color, icon, updated_at: new Date().toISOString() };
      setLocalData(STORAGE_KEYS.CATEGORIES, categories);
      return categories[idx];
    }
    const { data, error } = await supabase
      .from('categories')
      .update({ name, color, icon, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    if (getIsDemoMode()) {
      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      const idx = categories.findIndex(c => c.id === id);
      if (idx !== -1) {
        categories[idx].deleted_at = new Date().toISOString();
        setLocalData(STORAGE_KEYS.CATEGORIES, categories);
      }
      return;
    }
    const { error } = await supabase
      .from('categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // --- TRANSACTIONS ---
  async getTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    accountId?: string;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<Transaction[]> {
    if (getIsDemoMode()) {
      let list = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []).filter(t => !t.deleted_at);
      const accounts = getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);

      if (filters) {
        if (filters.startDate) list = list.filter(t => t.date >= filters.startDate!);
        if (filters.endDate) list = list.filter(t => t.date <= filters.endDate!);
        if (filters.accountId) list = list.filter(t => t.account_id === filters.accountId || t.destination_account_id === filters.accountId);
        if (filters.categoryId) list = list.filter(t => t.category_id === filters.categoryId);
        if (filters.minAmount !== undefined) list = list.filter(t => t.amount_cents >= filters.minAmount!);
        if (filters.maxAmount !== undefined) list = list.filter(t => t.amount_cents <= filters.maxAmount!);
      }

      // Map relation properties
      return list.map(t => ({
        ...t,
        account: accounts.find(a => a.id === t.account_id),
        destination_account: t.destination_account_id ? accounts.find(a => a.id === t.destination_account_id) : undefined,
        category: t.category_id ? categories.find(c => c.id === t.category_id) : undefined
      })).sort((a, b) => b.date.localeCompare(a.date));
    }

    let query = supabase
      .from('transactions')
      .select(`
        *,
        account:accounts!transactions_account_id_fkey(*),
        destination_account:accounts!transactions_destination_account_id_fkey(*),
        category:categories(*)
      `)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (filters) {
      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);
      if (filters.accountId) {
        query = query.or(`account_id.eq.${filters.accountId},destination_account_id.eq.${filters.accountId}`);
      }
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.minAmount !== undefined) query = query.gte('amount_cents', filters.minAmount);
      if (filters.maxAmount !== undefined) query = query.lte('amount_cents', filters.maxAmount);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createTransaction(tx: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Transaction> {
    if (getIsDemoMode()) {
      const list = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
      const newTx: Transaction = {
        ...tx,
        id: Math.random().toString(36).substring(2, 9),
        user_id: 'demo_user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };
      list.push(newTx);
      setLocalData(STORAGE_KEYS.TRANSACTIONS, list);
      simulateLocalBalanceTrigger('insert', newTx, null);
      return newTx;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...tx, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTransaction(
    id: string, 
    tx: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>>
  ): Promise<Transaction> {
    if (getIsDemoMode()) {
      const list = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
      const idx = list.findIndex(t => t.id === id);
      if (idx === -1) throw new Error("Transaction not found");
      const oldTx = { ...list[idx] };
      list[idx] = { ...list[idx], ...tx, updated_at: new Date().toISOString() } as Transaction;
      setLocalData(STORAGE_KEYS.TRANSACTIONS, list);
      simulateLocalBalanceTrigger('update', list[idx], oldTx);
      return list[idx];
    }
    // Fetch old transaction for return if needed, but select single handles it
    const { data, error } = await supabase
      .from('transactions')
      .update({ ...tx, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTransaction(id: string): Promise<void> {
    if (getIsDemoMode()) {
      const list = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        const oldTx = { ...list[idx] };
        list[idx].deleted_at = new Date().toISOString();
        setLocalData(STORAGE_KEYS.TRANSACTIONS, list);
        simulateLocalBalanceTrigger('delete', null, oldTx);
      }
      return;
    }
    const { error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async bulkImportTransactions(txs: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>[]): Promise<void> {
    if (getIsDemoMode()) {
      const list = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
      txs.forEach((tx) => {
        const newTx: Transaction = {
          ...tx,
          id: Math.random().toString(36).substring(2, 9),
          user_id: 'demo_user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null
        };
        list.push(newTx);
        simulateLocalBalanceTrigger('insert', newTx, null);
      });
      setLocalData(STORAGE_KEYS.TRANSACTIONS, list);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const inserts = txs.map(tx => ({ ...tx, user_id: user.id }));
    const { error } = await supabase.from('transactions').insert(inserts);
    if (error) throw error;
  },

  // --- BUDGETS ---
  async getBudgets(): Promise<Budget[]> {
    if (getIsDemoMode()) {
      const list = getLocalData<Budget[]>(STORAGE_KEYS.BUDGETS, []).filter(b => !b.deleted_at);
      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      return list.map(b => ({
        ...b,
        category: categories.find(c => c.id === b.category_id)
      }));
    }
    const { data, error } = await supabase
      .from('budgets')
      .select('*, category:categories(*)')
      .is('deleted_at', null);
    if (error) throw error;
    return data || [];
  },

  async setBudget(categoryId: string, amountCents: number, month: number, year: number): Promise<Budget> {
    if (getIsDemoMode()) {
      const list = getLocalData<Budget[]>(STORAGE_KEYS.BUDGETS, []);
      const idx = list.findIndex(b => b.category_id === categoryId && b.month === month && b.year === year && !b.deleted_at);
      
      if (idx !== -1) {
        list[idx].amount_cents = amountCents;
        list[idx].updated_at = new Date().toISOString();
        setLocalData(STORAGE_KEYS.BUDGETS, list);
        return list[idx];
      } else {
        const newBudget: Budget = {
          id: Math.random().toString(36).substring(2, 9),
          user_id: 'demo_user',
          category_id: categoryId,
          amount_cents: amountCents,
          month,
          year,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null
        };
        list.push(newBudget);
        setLocalData(STORAGE_KEYS.BUDGETS, list);
        return newBudget;
      }
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Upsert budget using unique constraints
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('category_id', categoryId)
      .eq('month', month)
      .eq('year', year)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('budgets')
        .update({ amount_cents: amountCents, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          category_id: categoryId,
          amount_cents: amountCents,
          month,
          year
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // --- RECURRING TEMPLATES ---
  async getRecurringTemplates(): Promise<RecurringTemplate[]> {
    if (getIsDemoMode()) {
      const list = getLocalData<RecurringTemplate[]>(STORAGE_KEYS.TEMPLATES, []).filter(t => !t.deleted_at);
      const accounts = getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      return list.map(t => ({
        ...t,
        account: accounts.find(a => a.id === t.account_id),
        destination_account: t.destination_account_id ? accounts.find(a => a.id === t.destination_account_id) : undefined,
        category: t.category_id ? categories.find(c => c.id === t.category_id) : undefined
      }));
    }
    const { data, error } = await supabase
      .from('recurring_templates')
      .select('*, account:accounts!recurring_templates_account_id_fkey(*), category:categories(*)')
      .is('deleted_at', null);
    if (error) throw error;
    return data || [];
  },

  async createRecurringTemplate(temp: Omit<RecurringTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'last_generated_at'>): Promise<RecurringTemplate> {
    if (getIsDemoMode()) {
      const list = getLocalData<RecurringTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
      const newTemp: RecurringTemplate = {
        ...temp,
        id: Math.random().toString(36).substring(2, 9),
        user_id: 'demo_user',
        last_generated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };
      list.push(newTemp);
      setLocalData(STORAGE_KEYS.TEMPLATES, list);
      return newTemp;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from('recurring_templates')
      .insert({ ...temp, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRecurringTemplate(id: string, temp: Partial<Omit<RecurringTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<RecurringTemplate> {
    if (getIsDemoMode()) {
      const list = getLocalData<RecurringTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
      const idx = list.findIndex(t => t.id === id);
      if (idx === -1) throw new Error("Template not found");
      list[idx] = { ...list[idx], ...temp, updated_at: new Date().toISOString() } as RecurringTemplate;
      setLocalData(STORAGE_KEYS.TEMPLATES, list);
      return list[idx];
    }
    const { data, error } = await supabase
      .from('recurring_templates')
      .update({ ...temp, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteRecurringTemplate(id: string): Promise<void> {
    if (getIsDemoMode()) {
      const list = getLocalData<RecurringTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        list[idx].deleted_at = new Date().toISOString();
        setLocalData(STORAGE_KEYS.TEMPLATES, list);
      }
      return;
    }
    const { error } = await supabase
      .from('recurring_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // --- EXCHANGE RATES ---
  async getExchangeRates(): Promise<ExchangeRate[]> {
    if (getIsDemoMode()) {
      return getLocalData<ExchangeRate[]>(STORAGE_KEYS.RATES, DEFAULT_RATES);
    }
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  // --- DYNAMIC STORED PROCEDURES (RPCs) OR LOCAL EQUIVALENTS ---
  async getBudgetStatus(year: number, month: number): Promise<BudgetStatus[]> {
    if (getIsDemoMode()) {
      const budgets = getLocalData<Budget[]>(STORAGE_KEYS.BUDGETS, []).filter(b => b.month === month && b.year === year && !b.deleted_at);
      const transactions = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []).filter(t => !t.deleted_at);
      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []).filter(c => !c.deleted_at);

      const status: BudgetStatus[] = [];

      for (const budget of budgets) {
        const cat = categories.find(c => c.id === budget.category_id);
        if (!cat) continue;

        // Find child subcategories if this is a parent category
        const subCatIds = categories.filter(c => c.parent_id === cat.id).map(c => c.id);
        const allCatIds = [cat.id, ...subCatIds];

        // Sum expenses matching date and category list
        const spent = transactions
          .filter(t => {
            const tDate = new Date(t.date);
            return t.type === 'expense' &&
                   t.category_id && 
                   allCatIds.includes(t.category_id) &&
                   tDate.getFullYear() === year &&
                   tDate.getMonth() + 1 === month;
          })
          .reduce((sum, t) => sum + t.amount_cents, 0);

        const percentage = budget.amount_cents === 0 ? 0 : Math.round((spent / budget.amount_cents) * 10000) / 100;
        let alert_level: AlertLevelType = 'OK';
        if (budget.amount_cents > 0) {
          if (spent >= budget.amount_cents) alert_level = 'ALERT_100';
          else if (spent >= budget.amount_cents * 0.8) alert_level = 'WARN_80';
        }

        const parentCat = cat.parent_id ? categories.find(c => c.id === cat.parent_id) : null;

        status.push({
          category_id: cat.id,
          category_name: cat.name,
          parent_category_name: parentCat ? parentCat.name : null,
          budget_amount_cents: budget.amount_cents,
          spent_amount_cents: spent,
          percentage,
          alert_level
        });
      }
      return status;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase.rpc('get_budget_status', {
      p_user_id: user.id,
      p_year: year,
      p_month: month
    });
    if (error) throw error;
    return data || [];
  },

  async getDashboardSummary(year: number, month: number): Promise<DashboardSummary> {
    if (getIsDemoMode()) {
      const transactions = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []).filter(t => !t.deleted_at);
      
      const filterMonthTx = (y: number, m: number) => {
        return transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate.getFullYear() === y && tDate.getMonth() + 1 === m;
        });
      };

      const currTxs = filterMonthTx(year, month);
      const total_income_cents = currTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount_cents, 0);
      const total_expense_cents = currTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount_cents, 0);

      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevTxs = filterMonthTx(prevYear, prevMonth);
      const prev_month_expense_cents = prevTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount_cents, 0);

      const mom_expense_percentage = prev_month_expense_cents === 0 ? 0 :
        Math.round(((total_expense_cents - prev_month_expense_cents) / prev_month_expense_cents) * 10000) / 100;

      return {
        total_income_cents,
        total_expense_cents,
        net_savings_cents: total_income_cents - total_expense_cents,
        prev_month_expense_cents,
        mom_expense_percentage
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase.rpc('get_dashboard_summary', {
      p_user_id: user.id,
      p_year: year,
      p_month: month
    });
    if (error) throw error;
    
    if (data && data.length > 0) {
      return data[0];
    }
    return {
      total_income_cents: 0,
      total_expense_cents: 0,
      net_savings_cents: 0,
      prev_month_expense_cents: 0,
      mom_expense_percentage: 0
    };
  },

  async getMonthlyTrends(): Promise<MonthlyTrend[]> {
    if (getIsDemoMode()) {
      const transactions = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []).filter(t => !t.deleted_at);
      const trends: MonthlyTrend[] = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        
        const mthTxs = transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate.getFullYear() === y && tDate.getMonth() + 1 === m;
        });

        const income = mthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount_cents, 0);
        const expense = mthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount_cents, 0);

        trends.push({
          month_name: monthNames[d.getMonth()],
          year_num: y,
          month_num: m,
          income_cents: income,
          expense_cents: expense
        });
      }
      return trends;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase.rpc('get_monthly_trends', {
      p_user_id: user.id
    });
    if (error) throw error;
    return data || [];
  },

  // --- TRIGGER RECURRING TRANSACTION GENERATION (EDGE FUNCTION SIMULATION) ---
  async triggerRecurringGeneration(): Promise<{ success: boolean; message: string }> {
    if (getIsDemoMode()) {
      const templates = getLocalData<RecurringTemplate[]>(STORAGE_KEYS.TEMPLATES, []).filter(t => t.is_active && !t.deleted_at);
      const transactions = getLocalData<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
      const rates = getLocalData<ExchangeRate[]>(STORAGE_KEYS.RATES, DEFAULT_RATES);
      const accounts = getLocalData<Account[]>(STORAGE_KEYS.ACCOUNTS, []);

      const now = new Date();
      let genCount = 0;

      const findRate = (from: string, to: string) => {
        if (from === to) return 1.0;
        const r = rates.find(x => x.from_currency === from && x.to_currency === to);
        return r ? r.rate : 1.0;
      };

      const calculateNextDate = (curr: Date, freq: string, interval: number): Date => {
        const next = new Date(curr.getTime());
        if (freq === 'daily') next.setDate(next.getDate() + interval);
        else if (freq === 'weekly') next.setDate(next.getDate() + interval * 7);
        else if (freq === 'monthly') next.setMonth(next.getMonth() + interval);
        else if (freq === 'yearly') next.setFullYear(next.getFullYear() + interval);
        return next;
      };

      const updatedTemplates = getLocalData<RecurringTemplate[]>(STORAGE_KEYS.TEMPLATES, []);

      for (const t of templates) {
        let currentNextDate = new Date(t.next_generation_date);
        const endDate = t.end_date ? new Date(t.end_date) : null;
        let isActive = t.is_active;

        const generated: Transaction[] = [];

        while (currentNextDate <= now && isActive) {
          if (endDate && currentNextDate > endDate) {
            isActive = false;
            break;
          }

          let rate = 1.0;
          if (t.type === 'transfer' && t.destination_account_id) {
            const srcAcc = accounts.find(a => a.id === t.account_id);
            const destAcc = accounts.find(a => a.id === t.destination_account_id);
            if (srcAcc && destAcc) {
              rate = findRate(srcAcc.currency, destAcc.currency);
            }
          }

          const newTx: Transaction = {
            id: Math.random().toString(36).substring(2, 9),
            user_id: 'demo_user',
            account_id: t.account_id,
            destination_account_id: t.destination_account_id,
            category_id: t.category_id,
            type: t.type,
            amount_cents: t.amount_cents,
            currency: t.currency,
            exchange_rate: rate,
            date: currentNextDate.toISOString(),
            note: t.note ? `Auto-generated: ${t.note}` : 'Auto-generated recurring transaction',
            payment_method: (t.payment_method as any) || 'other',
            recurring_template_id: t.id,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            deleted_at: null
          };

          generated.push(newTx);
          transactions.push(newTx);
          simulateLocalBalanceTrigger('insert', newTx, null);

          currentNextDate = calculateNextDate(currentNextDate, t.frequency, t.interval);
          if (endDate && currentNextDate > endDate) {
            isActive = false;
          }
        }

        if (generated.length > 0) {
          genCount += generated.length;
          const idx = updatedTemplates.findIndex(x => x.id === t.id);
          if (idx !== -1) {
            updatedTemplates[idx].next_generation_date = currentNextDate.toISOString();
            updatedTemplates[idx].last_generated_at = now.toISOString();
            updatedTemplates[idx].is_active = isActive;
          }
        }
      }

      setLocalData(STORAGE_KEYS.TEMPLATES, updatedTemplates);
      setLocalData(STORAGE_KEYS.TRANSACTIONS, transactions);

      return { success: true, message: `Checked templates, auto-generated ${genCount} transaction(s).` };
    }

    // Call Supabase Edge Function
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    
    if (!token) throw new Error("Not authenticated");

    let response: Response;
    try {
      response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to reach recurring function: ${error.message || 'Network error'}`);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error || 'Failed to call Deno Edge Function');
    }

    const res = await response.json();
    return { success: true, message: res.message || 'Processed scheduled items.' };
  },

  // --- SEED TRIGGER ---
  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    if (getIsDemoMode()) {
      // Clean local storage and populate
      localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.BUDGETS);
      localStorage.removeItem(STORAGE_KEYS.TEMPLATES);
      initLocalCategories();

      const accIdChecking = Math.random().toString(36).substring(2, 9);
      const accIdCash = Math.random().toString(36).substring(2, 9);
      const accIdCredit = Math.random().toString(36).substring(2, 9);
      const accIdSavings = Math.random().toString(36).substring(2, 9);

      const accounts: Account[] = [
        { id: accIdChecking, user_id: 'demo_user', name: 'Main Checking', type: 'checking', currency: 'USD', initial_balance_cents: 500000, current_balance_cents: 500000, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
        { id: accIdCash, user_id: 'demo_user', name: 'Pocket Cash', type: 'cash', currency: 'USD', initial_balance_cents: 20000, current_balance_cents: 20000, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
        { id: accIdCredit, user_id: 'demo_user', name: 'Travel Credit Card', type: 'credit_card', currency: 'USD', initial_balance_cents: -15000, current_balance_cents: -15000, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
        { id: accIdSavings, user_id: 'demo_user', name: 'High-Yield Savings', type: 'savings', currency: 'USD', initial_balance_cents: 1200000, current_balance_cents: 1200000, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
      ];
      setLocalData(STORAGE_KEYS.ACCOUNTS, accounts);

      const categories = getLocalData<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      const findCat = (n: string) => categories.find(c => c.name === n) || categories[0];

      // Insert budgets for current month
      const now = new Date();
      const m = now.getMonth() + 1;
      const y = now.getFullYear();

      const budgetLimits = [
        { name: 'Food & Dining', amount: 50000 },
        { name: 'Transport', amount: 20000 },
        { name: 'Bills & Utilities', amount: 40000 },
        { name: 'Entertainment', amount: 15000 },
        { name: 'Shopping', amount: 30000 },
        { name: 'Health & Fitness', amount: 10000 },
      ];

      const budgets = budgetLimits.map(lim => ({
        id: Math.random().toString(36).substring(2, 9),
        user_id: 'demo_user',
        category_id: findCat(lim.name).id,
        amount_cents: lim.amount,
        month: m,
        year: y,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      }));
      setLocalData(STORAGE_KEYS.BUDGETS, budgets);

      const daysAgo = (num: number) => {
        const d = new Date();
        d.setDate(d.getDate() - num);
        return d.toISOString();
      };

      const transactions: Transaction[] = [
        // Income
        { id: 't1', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Salary').id, type: 'income', amount_cents: 350000, currency: 'USD', exchange_rate: 1.0, date: daysAgo(30), note: 'Monthly Salary Paycheck', payment_method: 'transfer', recurring_template_id: null, created_at: daysAgo(30), updated_at: daysAgo(30), deleted_at: null },
        { id: 't2', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Salary').id, type: 'income', amount_cents: 350000, currency: 'USD', exchange_rate: 1.0, date: daysAgo(1), note: 'Monthly Salary Paycheck', payment_method: 'transfer', recurring_template_id: null, created_at: daysAgo(1), updated_at: daysAgo(1), deleted_at: null },
        { id: 't3', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Freelance').id, type: 'income', amount_cents: 65000, currency: 'USD', exchange_rate: 1.0, date: daysAgo(12), note: 'Web Dev Consulting invoice', payment_method: 'online_payment', recurring_template_id: null, created_at: daysAgo(12), updated_at: daysAgo(12), deleted_at: null },
        
        // Expenses
        { id: 't4', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Groceries').id, type: 'expense', amount_cents: 11040, currency: 'USD', exchange_rate: 1.0, date: daysAgo(25), note: 'Costco Wholesale groceries', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(25), updated_at: daysAgo(25), deleted_at: null },
        { id: 't5', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Groceries').id, type: 'expense', amount_cents: 8520, currency: 'USD', exchange_rate: 1.0, date: daysAgo(10), note: 'Trader Joes', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(10), updated_at: daysAgo(10), deleted_at: null },
        { id: 't6', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Groceries').id, type: 'expense', amount_cents: 4500, date: daysAgo(3), note: 'Local Corner Store', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(3), updated_at: daysAgo(3), deleted_at: null, currency: 'USD', exchange_rate: 1.0 },

        { id: 't7', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Restaurants').id, type: 'expense', amount_cents: 6520, currency: 'USD', exchange_rate: 1.0, date: daysAgo(22), note: 'Dinner out at Olive Garden', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(22), updated_at: daysAgo(22), deleted_at: null },
        { id: 't8', user_id: 'demo_user', account_id: accIdCash, destination_account_id: null, category_id: findCat('Restaurants').id, type: 'expense', amount_cents: 1800, currency: 'USD', exchange_rate: 1.0, date: daysAgo(15), note: 'Lunch Cafe', payment_method: 'cash', recurring_template_id: null, created_at: daysAgo(15), updated_at: daysAgo(15), deleted_at: null },
        { id: 't9', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Restaurants').id, type: 'expense', amount_cents: 9500, currency: 'USD', exchange_rate: 1.0, date: daysAgo(4), note: 'Fancy steakhouse date', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(4), updated_at: daysAgo(4), deleted_at: null },

        { id: 't10', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Fuel').id, type: 'expense', amount_cents: 4200, currency: 'USD', exchange_rate: 1.0, date: daysAgo(20), note: 'Chevron Gas Fill', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(20), updated_at: daysAgo(20), deleted_at: null },
        { id: 't11', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Fuel').id, type: 'expense', amount_cents: 4500, currency: 'USD', exchange_rate: 1.0, date: daysAgo(5), note: 'Shell Station Fuel', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(5), updated_at: daysAgo(5), deleted_at: null },

        { id: 't12', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Electricity').id, type: 'expense', amount_cents: 12000, currency: 'USD', exchange_rate: 1.0, date: daysAgo(24), note: 'Electric Bill', payment_method: 'transfer', recurring_template_id: null, created_at: daysAgo(24), updated_at: daysAgo(24), deleted_at: null },
        { id: 't13', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Internet').id, type: 'expense', amount_cents: 6500, currency: 'USD', exchange_rate: 1.0, date: daysAgo(24), note: 'Xfinity Broadband', payment_method: 'transfer', recurring_template_id: null, created_at: daysAgo(24), updated_at: daysAgo(24), deleted_at: null },

        { id: 't14', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Subscriptions').id, type: 'expense', amount_cents: 1549, currency: 'USD', exchange_rate: 1.0, date: daysAgo(15), note: 'Netflix Subscription', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(15), updated_at: daysAgo(15), deleted_at: null },
        { id: 't15', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Subscriptions').id, type: 'expense', amount_cents: 999, currency: 'USD', exchange_rate: 1.0, date: daysAgo(15), note: 'Spotify subscription', payment_method: 'card', recurring_template_id: null, created_at: daysAgo(15), updated_at: daysAgo(15), deleted_at: null },

        { id: 't16', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Gym').id, type: 'expense', amount_cents: 5000, currency: 'USD', exchange_rate: 1.0, date: daysAgo(10), note: 'Planet Fitness Gym fee', payment_method: 'transfer', recurring_template_id: null, created_at: daysAgo(10), updated_at: daysAgo(10), deleted_at: null },

        // Transfers
        { id: 't17', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: accIdSavings, category_id: null, type: 'transfer', amount_cents: 100000, currency: 'USD', exchange_rate: 1.0, date: daysAgo(29), note: 'Monthly savings goal transfer', payment_method: 'transfer', recurring_template_id: null, created_at: daysAgo(29), updated_at: daysAgo(29), deleted_at: null },
        { id: 't18', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: accIdCredit, category_id: null, type: 'transfer', amount_cents: 50000, currency: 'USD', exchange_rate: 1.0, date: daysAgo(16), note: 'Credit Card Bill Payment', payment_method: 'transfer', recurring_template_id: null, created_at: daysAgo(16), updated_at: daysAgo(16), deleted_at: null }
      ];

      // Run triggers simulation to compute final balances
      setLocalData(STORAGE_KEYS.TRANSACTIONS, transactions);
      
      // Calculate balances from initial values
      for (const a of accounts) {
        let bal = a.initial_balance_cents;
        const list = transactions.filter(t => !t.deleted_at);
        for (const t of list) {
          if (t.type === 'expense' && t.account_id === a.id) {
            bal -= t.amount_cents;
          } else if (t.type === 'income' && t.account_id === a.id) {
            bal += t.amount_cents;
          } else if (t.type === 'transfer') {
            if (t.account_id === a.id) bal -= t.amount_cents;
            if (t.destination_account_id === a.id) bal += Math.round(t.amount_cents * t.exchange_rate);
          }
        }
        a.current_balance_cents = bal;
      }
      setLocalData(STORAGE_KEYS.ACCOUNTS, accounts);

      // Templates
      const templates = [
        { id: 'temp1', user_id: 'demo_user', account_id: accIdChecking, destination_account_id: null, category_id: findCat('Salary').id, type: 'income', amount_cents: 350000, currency: 'USD', frequency: 'monthly', interval: 1, start_date: daysAgo(30), next_generation_date: daysAgo(-30), note: 'Salary Direct Deposit', payment_method: 'transfer', is_active: true, created_at: daysAgo(30), updated_at: daysAgo(30), deleted_at: null },
        { id: 'temp2', user_id: 'demo_user', account_id: accIdCredit, destination_account_id: null, category_id: findCat('Subscriptions').id, type: 'expense', amount_cents: 1549, currency: 'USD', frequency: 'monthly', interval: 1, start_date: daysAgo(15), next_generation_date: daysAgo(-15), note: 'Netflix Subscription', payment_method: 'card', is_active: true, created_at: daysAgo(15), updated_at: daysAgo(15), deleted_at: null }
      ];
      setLocalData(STORAGE_KEYS.TEMPLATES, templates);

      return { success: true, message: 'Local storage populated with demo data!' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return await seedUserData(user.id);
  }
};
