import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { BudgetStatus, Category } from '../../types';
import { formatCentsToCurrency, parseCurrencyToCents } from '../../utils/currency';
import { 
  PiggyBank, Edit2, AlertCircle, AlertTriangle, CheckCircle, 
  ChevronRight, Sparkles, X 
} from 'lucide-react';

interface BudgetingProps {
  selectedMonth: number;
  selectedYear: number;
}

export const Budgeting: React.FC<BudgetingProps> = ({ selectedMonth, selectedYear }) => {
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [editingBudget, setEditingBudget] = useState<BudgetStatus | null>(null);
  const [newBudgetAmount, setNewBudgetAmount] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [status, cats] = await Promise.all([
        api.getBudgetStatus(selectedYear, selectedMonth),
        api.getCategories()
      ]);
      setBudgets(status);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const handleEditClick = (b: BudgetStatus) => {
    setEditingBudget(b);
    setNewBudgetAmount((b.budget_amount_cents / 100).toString());
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;

    const amountCents = parseCurrencyToCents(newBudgetAmount);
    if (amountCents < 0) {
      alert("Amount cannot be negative");
      return;
    }

    try {
      await api.setBudget(editingBudget.category_id, amountCents, selectedMonth, selectedYear);
      setEditingBudget(null);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to set budget");
    }
  };

  // Find categories that don't have budgets set for this month yet
  const unbudgetedCategories = categories.filter(
    c => c.type === 'expense' && !budgets.some(b => b.category_id === c.id)
  );

  const handleAddBudget = async (categoryId: string) => {
    try {
      await api.setBudget(categoryId, 0, selectedMonth, selectedYear);
      // Immediately open editing modal for the newly added item
      const tempStatus: BudgetStatus = {
        category_id: categoryId,
        category_name: categories.find(c => c.id === categoryId)?.name || 'New Budget',
        parent_category_name: null,
        budget_amount_cents: 0,
        spent_amount_cents: 0,
        percentage: 0,
        alert_level: 'OK'
      };
      setEditingBudget(tempStatus);
      setNewBudgetAmount('0.00');
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to initialize budget");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      {/* Title Bar */}
      <div>
        <h2 className="text-xl font-bold text-white">Budgets</h2>
        <p className="text-zinc-400 text-xs mt-0.5">Control expenses by setting monthly limits per category</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Budgets Progress List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">
            <span>Category Budget</span>
            <span className="text-right">Spent / Limit</span>
          </div>

          {budgets.length > 0 ? (
            budgets.map((b) => {
              const limit = b.budget_amount_cents;
              const spent = b.spent_amount_cents;
              const percent = b.percentage;
              const isOver80 = b.alert_level === 'WARN_80';
              const isOver100 = b.alert_level === 'ALERT_100';

              let progressColor = 'bg-violet-600';
              if (isOver100) progressColor = 'bg-rose-500';
              else if (isOver80) progressColor = 'bg-amber-500';

              return (
                <div 
                  key={b.category_id} 
                  className={`glass-card p-5 rounded-2xl border transition-all duration-200 ${
                    isOver100 
                      ? 'border-rose-500/30 bg-rose-950/5' 
                      : isOver80 
                      ? 'border-amber-500/20 bg-amber-950/5' 
                      : 'border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-bold text-sm">{b.category_name}</h4>
                        {isOver100 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-[9px] font-extrabold text-rose-400">
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span>100%+ Exceeded</span>
                          </span>
                        ) : isOver80 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-[9px] font-extrabold text-amber-400">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>80% Warning</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-extrabold text-emerald-400">
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>On Track</span>
                          </span>
                        )}
                      </div>
                      {b.parent_category_name && (
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">{b.parent_category_name}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1.5">
                        <span className="text-white font-black text-sm">{formatCentsToCurrency(spent)}</span>
                        <span className="text-zinc-500 text-xs">/</span>
                        <span className="text-zinc-400 text-xs font-semibold">{formatCentsToCurrency(limit)}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-semibold">{percent}% spent</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-zinc-950/60 rounded-full overflow-hidden mb-4 border border-zinc-900">
                    <div 
                      className={`h-full rounded-full ${progressColor} transition-all duration-300`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleEditClick(b)}
                      className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors font-bold uppercase"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Set Limit</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass-card p-12 text-center text-zinc-500 text-xs rounded-2xl">
              No budgets defined for this month yet. Configure category limits using the panel on the right.
            </div>
          )}
        </div>

        {/* Set Categories Budgets Sidebar Panel */}
        <div className="glass-card p-6 rounded-2xl space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>Unbudgeted Categories</span>
            </h3>
            <p className="text-zinc-500 text-xs">Categories missing spending goals for this month</p>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {unbudgetedCategories.length > 0 ? (
              unbudgetedCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleAddBudget(cat.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/15 hover:bg-zinc-800/20 text-zinc-300 hover:text-white text-xs font-semibold transition-all group"
                >
                  <span className="truncate pr-4">{cat.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))
            ) : (
              <p className="text-zinc-500 text-xs py-4 text-center">All categories have active budgets configured!</p>
            )}
          </div>
        </div>
      </div>

      {/* EDIT BUDGET MODAL */}
      {editingBudget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-sm rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setEditingBudget(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center text-violet-400 border border-violet-500/20">
                <PiggyBank className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Set Limit</h3>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <p className="text-zinc-400 text-xs font-semibold mb-1">Category</p>
                <p className="text-white text-sm font-bold">{editingBudget.category_name}</p>
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Monthly Budget Limit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs font-bold"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingBudget(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold"
                >
                  Save Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
