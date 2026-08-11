import React, { useEffect, useState } from 'react';
import { api, getIsDemoMode } from '../../services/api';
import type { Transaction, Account, Category, BudgetStatus, DashboardSummary } from '../../types';
import { formatCentsToCurrency } from '../../utils/currency';
import { 
  FileSpreadsheet, FileText, Filter, Info, Shield
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ReportsProps {
  selectedMonth: number;
  selectedYear: number;
}

export const Reports: React.FC<ReportsProps> = ({ selectedMonth, selectedYear }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const start = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const end = new Date(selectedYear, selectedMonth, 0).toISOString();

      const [txs, accs, cats, sumData, budgetData] = await Promise.all([
        api.getTransactions({ startDate: start, endDate: end }),
        api.getAccounts(),
        api.getCategories(),
        api.getDashboardSummary(selectedYear, selectedMonth),
        api.getBudgetStatus(selectedYear, selectedMonth)
      ]);

      setTransactions(txs);
      setAccounts(accs);
      setCategories(cats);
      setSummary(sumData);
      setBudgets(budgetData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  // Apply filters locally on the month's transactions
  const filteredList = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterAccount !== 'all' && t.account_id !== filterAccount && t.destination_account_id !== filterAccount) return false;
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false;
    return true;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = ['Date', 'Type', 'Amount (Cents)', 'Amount (Formatted)', 'Currency', 'Account', 'Destination Account', 'Category', 'Note', 'Payment Method'];
    const rows = filteredList.map(t => [
      t.date.split('T')[0],
      t.type,
      t.amount_cents,
      (t.amount_cents / 100).toFixed(2),
      t.currency,
      t.account?.name || '',
      t.destination_account?.name || '',
      t.category?.name || '',
      t.note || '',
      t.payment_method || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FinFlow_Report_${months[selectedMonth - 1]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const reportElement = document.getElementById('report-pdf-container');
    if (!reportElement) return;

    setExporting(true);

    try {
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0c0f1a' // match background color
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 size in mm
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add image to first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Handle multi-page PDF spacing
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`FinFlow_Monthly_Summary_${months[selectedMonth - 1]}_${selectedYear}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      alert("Failed to generate PDF summary.");
    } finally {
      setExporting(false);
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
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-24">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Reports & Export</h2>
          <p className="text-zinc-400 text-xs mt-0.5">Filter, audit and export transactions to CSV or PDF</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold hover:bg-zinc-800 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold shadow-lg shadow-violet-500/10 transition-all disabled:opacity-50"
          >
            {exporting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span>{exporting ? 'Generating PDF...' : 'Download PDF Summary'}</span>
          </button>
        </div>
      </div>

      {/* Local Filter Ribbon */}
      <div className="glass-card p-5 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-violet-400" />
          <span>Active Filter Preview</span>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Type Select */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl glass-input text-white bg-zinc-950"
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>

          {/* Account Select */}
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl glass-input text-white bg-zinc-950"
          >
            <option value="all">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Category Select */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl glass-input text-white bg-zinc-950"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* PREVIEW CONTAINER FOR PDF EXPORT */}
      <div className="border border-zinc-800 rounded-3xl p-6 bg-zinc-950/40">
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-4 flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-zinc-500" />
          <span>PDF Statement Generation Sandbox</span>
        </div>

        {/* This container has specific width and styling for PDF rendering */}
        <div 
          id="report-pdf-container" 
          className="bg-[#0c0f1a] border border-zinc-850 p-12 rounded-2xl max-w-4xl mx-auto shadow-2xl space-y-10 text-white relative overflow-hidden"
        >
          {/* Decorative glowing lines */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-violet-600/5 blur-[100px]"></div>
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-8">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight m-0">FinFlow Financial</h1>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Monthly Balance Statement</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-white">{months[selectedMonth - 1]} {selectedYear}</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Statement Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-zinc-950/45 p-6 rounded-2xl border border-zinc-850">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Income</span>
              <p className="text-lg font-black text-emerald-400">{formatCentsToCurrency(summary?.total_income_cents || 0)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Expenses</span>
              <p className="text-lg font-black text-rose-400">{formatCentsToCurrency(summary?.total_expense_cents || 0)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Net Cash Flow</span>
              <p className="text-lg font-black text-white">{formatCentsToCurrency(summary?.net_savings_cents || 0)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Transactions</span>
              <p className="text-lg font-black text-zinc-300">{filteredList.length}</p>
            </div>
          </div>

          {/* Category Budgets Overview */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Budget Utilization</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {budgets.slice(0, 4).map(b => (
                <div key={b.category_id} className="bg-zinc-950/30 p-4 rounded-xl border border-zinc-900 text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-zinc-300">{b.category_name}</span>
                    <span className="text-zinc-500">{b.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        b.alert_level === 'ALERT_100' ? 'bg-rose-500' : b.alert_level === 'WARN_80' ? 'bg-amber-500' : 'bg-violet-600'
                      }`}
                      style={{ width: `${Math.min(100, b.percentage)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-zinc-500">
                    <span>Spent: {formatCentsToCurrency(b.spent_amount_cents)}</span>
                    <span>Budget: {formatCentsToCurrency(b.budget_amount_cents)}</span>
                  </div>
                </div>
              ))}
              {budgets.length === 0 && (
                <div className="col-span-2 text-zinc-500 text-xs italic py-4">No budgets active this period.</div>
              )}
            </div>
          </div>

          {/* Ledger Table */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Activity Ledger ({filteredList.length} items)</h3>
            <div className="border border-zinc-900 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/60 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider border-b border-zinc-900">
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Account</th>
                    <th className="px-5 py-3.5">Memo</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {filteredList.slice(0, 10).map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-950/20">
                      <td className="px-5 py-3 text-zinc-500">{t.date.split('T')[0]}</td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-white">{t.category?.name || (t.type === 'transfer' ? 'Transfer' : 'Uncategorized')}</span>
                      </td>
                      <td className="px-5 py-3">{t.account?.name}</td>
                      <td className="px-5 py-3 italic max-w-[200px] truncate">{t.note || '-'}</td>
                      <td className={`px-5 py-3 text-right font-bold ${
                        t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-rose-400' : 'text-blue-300'
                      }`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                        {formatCentsToCurrency(t.amount_cents, t.currency)}
                      </td>
                    </tr>
                  ))}
                  {filteredList.length > 10 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-3 text-center text-zinc-500 italic">
                        Showing first 10 items. Export to CSV to see all {filteredList.length} items.
                      </td>
                    </tr>
                  )}
                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-zinc-500 italic">
                        No transactions registered in this month filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer declaration */}
          <div className="border-t border-zinc-900 pt-6 flex items-center justify-between text-[9px] text-zinc-500">
            <span>© {selectedYear} FinFlow Inc. All rights reserved.</span>
            <span>Authentication Type: {getIsDemoMode() ? 'Mock Demo Credentials' : 'Supabase Auth Session'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
