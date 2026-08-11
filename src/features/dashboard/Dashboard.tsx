import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { DashboardSummary, MonthlyTrend, BudgetStatus } from '../../types';
import { formatCentsToCurrency } from '../../utils/currency';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Percent, RefreshCw, Layers, Award
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

interface DashboardProps {
  selectedMonth: number;
  selectedYear: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ selectedMonth, selectedYear }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumData, trendData, budgetData] = await Promise.all([
        api.getDashboardSummary(selectedYear, selectedMonth),
        api.getMonthlyTrends(),
        api.getBudgetStatus(selectedYear, selectedMonth)
      ]);
      setSummary(sumData);
      setTrends(trendData);
      setBudgets(budgetData);
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const handleTriggerRecurring = async () => {
    setRefreshing(true);
    try {
      const res = await api.triggerRecurringGeneration();
      alert(res.message);
      await fetchData();
    } catch (e: any) {
      alert(e.message || "Failed to trigger recurring transactions");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Pre-process category breakdown data for Pie Chart
  const pieData = budgets
    .filter(b => b.spent_amount_cents > 0)
    .map(b => ({
      name: b.category_name,
      value: b.spent_amount_cents / 100
    }));

  const CHART_COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6'];

  // Top 5 spending categories
  const topSpending = [...budgets]
    .sort((a, b) => b.spent_amount_cents - a.spent_amount_cents)
    .slice(0, 5)
    .filter(b => b.spent_amount_cents > 0);

  // Recharts custom tooltips (glassmorphic style)
  const formatCurrencyTooltip = (value: any) => [`$${Number(value).toFixed(2)}`, ''];

  // Bar Chart Data (Comparison)
  const comparisonData = [
    {
      name: 'Comparison',
      Income: (summary?.total_income_cents || 0) / 100,
      Expense: (summary?.total_expense_cents || 0) / 100
    }
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      {/* Action Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Overview</h2>
          <p className="text-zinc-400 text-xs mt-0.5">Real-time statistics and budget progress</p>
        </div>
        <button
          onClick={handleTriggerRecurring}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold hover:bg-zinc-800/80 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Sync Recurring Bills</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Income Card */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total Income</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-white">
            {formatCentsToCurrency(summary?.total_income_cents || 0)}
          </h3>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Active month</span>
          </p>
        </div>

        {/* Expenses Card */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-white">
            {formatCentsToCurrency(summary?.total_expense_cents || 0)}
          </h3>
          <div className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1.5 flex-wrap">
            {summary && summary.mom_expense_percentage > 0 ? (
              <>
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400 font-semibold">+{summary.mom_expense_percentage}%</span>
              </>
            ) : summary && summary.mom_expense_percentage < 0 ? (
              <>
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">{summary.mom_expense_percentage}%</span>
              </>
            ) : (
              <>
                <Percent className="w-3.5 h-3.5 text-zinc-400" />
                <span>0% change</span>
              </>
            )}
            <span>vs last month</span>
          </div>
        </div>

        {/* Net Savings Card */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-all"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Net Savings</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-white">
            {formatCentsToCurrency(summary?.net_savings_cents || 0)}
          </h3>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-violet-400" />
            <span>Savings rate: </span>
            <span className="text-violet-300 font-semibold">
              {summary && summary.total_income_cents > 0
                ? Math.max(0, Math.round((summary.net_savings_cents / summary.total_income_cents) * 100))
                : 0}%
            </span>
          </p>
        </div>
      </div>

      {/* Primary Trend Chart */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Cash Flow History</h3>
        <div className="h-80 w-full">
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222530" />
                <XAxis dataKey="month_name" stroke="#9ca3af" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis 
                  stroke="#9ca3af" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  formatter={(val) => [`$${Number(val).toFixed(2)}`, '']}
                  contentStyle={{ backgroundColor: 'rgba(22, 25, 37, 0.95)', borderColor: '#222530', borderRadius: '8px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey={(d) => d.income_cents / 100} 
                  name="Income" 
                  stroke="#10B981" 
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey={(d) => d.expense_cents / 100} 
                  name="Expense" 
                  stroke="#8B5CF6" 
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              No trend data available. Add transactions to see trends.
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Pie Chart */}
        <div className="glass-card p-6 rounded-2xl lg:col-span-2">
          <h3 className="text-lg font-bold text-white mb-4">Spending by Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-64 w-full">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={formatCurrencyTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                  No expense records for selected month.
                </div>
              )}
            </div>

            {/* Legend layout */}
            <div className="space-y-3">
              {pieData.length > 0 ? (
                pieData.map((item, index) => {
                  const percent = summary?.total_expense_cents 
                    ? Math.round((item.value * 100 / (summary.total_expense_cents / 100))) 
                    : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        ></div>
                        <span className="text-zinc-300 font-medium truncate max-w-[120px]">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-semibold">${item.value.toFixed(2)}</span>
                        <span className="text-zinc-500 ml-1.5 font-medium">{percent}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-zinc-500 text-xs">Categories with expenses will show up here.</p>
              )}
            </div>
          </div>
        </div>

        {/* Top 5 Spending categories list + Income vs Expense mini bar */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Top Spending</h3>
            <div className="space-y-4">
              {topSpending.length > 0 ? (
                topSpending.map((cat, idx) => (
                  <div key={cat.category_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                        #{idx + 1}
                      </div>
                      <span className="text-zinc-300 text-xs font-semibold">{cat.category_name}</span>
                    </div>
                    <span className="text-white font-bold text-xs">
                      {formatCentsToCurrency(cat.spent_amount_cents)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 text-xs text-center py-6">No expenses found for this period.</p>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Flow Balance</h4>
            <div className="h-28 w-full flex items-center justify-center">
              {summary && (summary.total_income_cents > 0 || summary.total_expense_cents > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} layout="vertical" barSize={14}>
                    <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip formatter={formatCurrencyTooltip} />
                    <Bar dataKey="Income" fill="#10B981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Expense" fill="#EF4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-zinc-500 text-xs">No flow data.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
