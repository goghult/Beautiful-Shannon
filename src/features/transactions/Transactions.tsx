import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Transaction, Account, Category, TransactionType, PaymentMethodType } from '../../types';
import { formatCentsToCurrency, parseCurrencyToCents } from '../../utils/currency';
import { suggestCategory } from '../../utils/categorization';
import { 
  Plus, Upload, Filter, Search, ArrowRightLeft, Edit, Trash2,
  FileSpreadsheet, X, Check, Info, AlertTriangle
} from 'lucide-react';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [_loading, setLoading] = useState(true);

  // Filter States
  const [searchNote, setSearchNote] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Form Fields
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formDestAccountId, setFormDestAccountId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNote, setFormNote] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethodType>('card');
  const [isSuggested, setIsSuggested] = useState(false);

  // CSV Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, cats, txs] = await Promise.all([
        api.getAccounts(),
        api.getCategories(),
        api.getTransactions()
      ]);
      setAccounts(accs);
      setCategories(cats);
      setTransactions(txs);

      // Default account selection in form
      if (accs.length > 0) {
        setFormAccountId(accs[0].id);
        setFormDestAccountId(accs[1]?.id || accs[0].id);
      }
      // Default category
      const expCats = cats.filter(c => c.type === 'expense');
      if (expCats.length > 0) {
        setFormCategoryId(expCats[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Description input handler for Auto-Categorization
  const handleNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormNote(val);

    // Auto-categorize only if type is NOT transfer
    if (formType !== 'transfer') {
      const suggested = suggestCategory(val, categories.filter(c => c.type === formType));
      if (suggested) {
        setFormCategoryId(suggested.id);
        setIsSuggested(true);
      } else {
        setIsSuggested(false);
      }
    }
  };

  const handleTypeChange = (type: TransactionType) => {
    setFormType(type);
    setIsSuggested(false);
    
    // Auto-set first available category matching the new type
    const matchedCats = categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense'));
    if (matchedCats.length > 0) {
      setFormCategoryId(matchedCats[0].id);
    }
  };

  const openAddModal = () => {
    setEditingTransaction(null);
    setFormType('expense');
    setFormAmount('');
    setFormNote('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPaymentMethod('card');
    setIsSuggested(false);
    
    if (accounts.length > 0) {
      setFormAccountId(accounts[0].id);
      setFormDestAccountId(accounts[1]?.id || accounts[0].id);
    }
    const expCats = categories.filter(c => c.type === 'expense');
    if (expCats.length > 0) {
      setFormCategoryId(expCats[0].id);
    }

    setIsFormOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setFormType(tx.type);
    setFormAmount((tx.amount_cents / 100).toString());
    setFormAccountId(tx.account_id);
    setFormDestAccountId(tx.destination_account_id || '');
    setFormCategoryId(tx.category_id || '');
    setFormDate(tx.date.split('T')[0]);
    setFormNote(tx.note || '');
    setFormPaymentMethod(tx.payment_method || 'other');
    setIsSuggested(false);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseCurrencyToCents(formAmount);
    if (amountCents <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }

    if (formType === 'transfer' && formAccountId === formDestAccountId) {
      alert("Source and Destination accounts must be different");
      return;
    }

    const payload = {
      account_id: formAccountId,
      destination_account_id: formType === 'transfer' ? formDestAccountId : null,
      category_id: formType === 'transfer' ? null : formCategoryId || null,
      type: formType,
      amount_cents: amountCents,
      currency: accounts.find(a => a.id === formAccountId)?.currency || 'USD',
      exchange_rate: 1.0, // defaults, trigger will recalculate if needed
      date: new Date(formDate).toISOString(),
      note: formNote,
      payment_method: formType === 'transfer' ? 'transfer' : formPaymentMethod
    };

    try {
      if (editingTransaction) {
        await api.updateTransaction(editingTransaction.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      setIsFormOpen(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to save transaction");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this transaction? (Soft delete will be applied)")) return;
    try {
      await api.deleteTransaction(id);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete transaction");
    }
  };

  // CSV Import Parsing Logic
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setImporting(true);
    setImportLogs(['Reading CSV file...']);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length <= 1) {
          throw new Error("CSV file is empty or missing data rows.");
        }

        // Parse header
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        setImportLogs(prev => [...prev, `Found headers: ${headers.join(', ')}`]);

        const dateIdx = headers.indexOf('date');
        const typeIdx = headers.indexOf('type');
        const amountIdx = headers.indexOf('amount');
        const categoryIdx = headers.indexOf('category');
        const accountIdx = headers.indexOf('account');
        const noteIdx = headers.indexOf('note');
        const methodIdx = headers.indexOf('payment method') !== -1 ? headers.indexOf('payment method') : headers.indexOf('method');

        if (dateIdx === -1 || typeIdx === -1 || amountIdx === -1 || accountIdx === -1) {
          throw new Error("Required column headers missing. Ensure CSV has: Date, Type, Amount, Account.");
        }

        const parsedTransactions: any[] = [];
        let successCount = 0;
        let skipCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          
          // Basic check
          if (cols.length < headers.length) {
            skipCount++;
            continue;
          }

          const rawDate = cols[dateIdx];
          const rawType = cols[typeIdx].toLowerCase(); // income, expense, transfer
          const rawAmount = cols[amountIdx];
          const rawCategory = categoryIdx !== -1 ? cols[categoryIdx] : 'Miscellaneous';
          const rawAccount = cols[accountIdx];
          const rawNote = noteIdx !== -1 ? cols[noteIdx] : '';
          const rawMethod = methodIdx !== -1 ? cols[methodIdx].toLowerCase() : 'other';

          // Match Account ID by Name
          let matchedAcc = accounts.find(a => a.name.toLowerCase() === rawAccount.toLowerCase());
          if (!matchedAcc) {
            // Create a temporary local account or assign to first available
            matchedAcc = accounts[0];
          }

          // Match Category ID by Name
          let matchedCat = categories.find(c => c.name.toLowerCase() === rawCategory.toLowerCase());
          if (!matchedCat && rawType !== 'transfer') {
            // Auto create custom category per user
            matchedCat = categories.find(c => c.name === 'Miscellaneous');
          }

          // Parse amount to cents
          const amountCents = parseCurrencyToCents(rawAmount);
          if (amountCents <= 0) {
            skipCount++;
            continue;
          }

          parsedTransactions.push({
            account_id: matchedAcc?.id || accounts[0].id,
            destination_account_id: null, // transfers not fully supported in simple imports, default to null
            category_id: rawType === 'transfer' ? null : matchedCat?.id || null,
            type: rawType as TransactionType,
            amount_cents: amountCents,
            currency: matchedAcc?.currency || 'USD',
            exchange_rate: 1.0,
            date: new Date(rawDate).toISOString(),
            note: rawNote,
            payment_method: rawMethod as PaymentMethodType
          });
          successCount++;
        }

        setImportLogs(prev => [...prev, `Successfully parsed ${successCount} row(s). Skipped ${skipCount} row(s).`]);
        setImportLogs(prev => [...prev, `Uploading transactions to database...`]);

        await api.bulkImportTransactions(parsedTransactions);
        setImportLogs(prev => [...prev, `Import complete!`]);
        
        setTimeout(() => {
          setIsImportOpen(false);
          setCsvFile(null);
          setImportLogs([]);
          loadData();
        }, 1500);

      } catch (err: any) {
        setImportLogs(prev => [...prev, `Error: ${err.message}`]);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(csvFile);
  };

  // Filter & Search Logic (applied locally to transactions list)
  const filteredTransactions = transactions.filter(t => {
    if (searchNote && !t.note?.toLowerCase().includes(searchNote.toLowerCase())) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterAccount !== 'all' && t.account_id !== filterAccount && t.destination_account_id !== filterAccount) return false;
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false;
    if (startDate && t.date < new Date(startDate).toISOString()) return false;
    if (endDate && t.date > new Date(endDate).toISOString() + 'T23:59:59') return false;
    return true;
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Transactions</h2>
          <p className="text-zinc-400 text-xs mt-0.5">Manage and audit income, expenses, and transfers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold hover:bg-zinc-800 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold shadow-lg shadow-violet-500/10 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-violet-400" />
          <span>Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Note Search */}
          <div className="relative col-span-1 lg:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search note/description..."
              value={searchNote}
              onChange={(e) => setSearchNote(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl glass-input text-white"
            />
          </div>

          {/* Type Select */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl glass-input text-white bg-zinc-950"
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
            className="px-3 py-2 text-xs rounded-xl glass-input text-white bg-zinc-950"
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
            className="px-3 py-2 text-xs rounded-xl glass-input text-white bg-zinc-950"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Date range pickers */}
          <div className="flex items-center gap-2 col-span-1 sm:col-span-2 lg:col-span-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2 py-2 text-[10px] rounded-xl glass-input text-white"
            />
            <span className="text-zinc-500 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2 py-2 text-[10px] rounded-xl glass-input text-white"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/20 text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Account / Flow</th>
                <th className="px-6 py-4">Note / Description</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';

                  return (
                    <tr key={tx.id} className="hover:bg-zinc-800/10 group transition-all">
                      <td className="px-6 py-4 text-zinc-300">
                        {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        {isTransfer ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-medium">
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Transfer</span>
                          </span>
                        ) : tx.category ? (
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full font-medium"
                            style={{ 
                              backgroundColor: `${tx.category.color}15`, 
                              color: tx.category.color || '#9ca3af' 
                            }}
                          >
                            {tx.category.name}
                          </span>
                        ) : (
                          <span className="text-zinc-500">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-300">
                        {isTransfer ? (
                          <div className="flex items-center gap-2">
                            <span>{tx.account?.name}</span>
                            <ArrowRightLeft className="w-3 h-3 text-zinc-500" />
                            <span>{tx.destination_account?.name}</span>
                          </div>
                        ) : (
                          <span>{tx.account?.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white font-medium max-w-xs truncate">
                        {tx.note || <span className="text-zinc-500 italic">No description</span>}
                      </td>
                      <td className="px-6 py-4 text-zinc-400 capitalize">
                        {tx.payment_method?.replace('_', ' ')}
                      </td>
                      <td className={`px-6 py-4 text-right font-bold text-sm ${
                        isIncome ? 'text-emerald-400' : isExpense ? 'text-rose-400' : 'text-blue-300'
                      }`}>
                        {isIncome ? '+' : isExpense ? '-' : ''}
                        {formatCentsToCurrency(tx.amount_cents, tx.currency)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(tx)}
                            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 rounded bg-zinc-800 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No transactions found. Add one or import CSV to start tracking!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">
              {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
            </h3>

            {/* Type selector tabs */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(['expense', 'income', 'transfer'] as TransactionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                    formType === type
                      ? type === 'expense'
                        ? 'bg-rose-500/25 border border-rose-500/40 text-rose-300'
                        : type === 'income'
                        ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300'
                        : 'bg-blue-500/25 border border-blue-500/40 text-blue-300'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Amount (USD/Base)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs font-bold"
                  />
                </div>

                {/* Date Input */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                  />
                </div>
              </div>

              {/* Accounts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">
                    {formType === 'transfer' ? 'Source Account' : 'Account'}
                  </label>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>

                {formType === 'transfer' ? (
                  <div>
                    <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Destination Account</label>
                    <select
                      value={formDestAccountId}
                      onChange={(e) => setFormDestAccountId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Category</label>
                    <div className="relative">
                      <select
                        value={formCategoryId}
                        onChange={(e) => {
                          setFormCategoryId(e.target.value);
                          setIsSuggested(false);
                        }}
                        required
                        className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                      >
                        {categories
                          .filter(c => c.type === (formType === 'income' ? 'income' : 'expense'))
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                      {isSuggested && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Note / Description */}
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1.5">
                  Note / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Starbucks, Costco groceries, Freelance logo design"
                  value={formNote}
                  onChange={handleNoteChange}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                />
                {isSuggested && (
                  <p className="text-[10px] text-violet-400 flex items-center gap-1 mt-1 font-semibold">
                    <Info className="w-3 h-3" />
                    <span>Auto-suggested category based on description!</span>
                  </p>
                )}
              </div>

              {formType !== 'transfer' && (
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Payment Method</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethodType)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="online_payment">Online Payment (PayPal/Venmo)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsImportOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-3">Bulk CSV Transaction Import</h3>
            <p className="text-zinc-400 text-xs mb-6">
              Upload a standard comma-separated values (.csv) file. Headers must include at minimum: 
              <span className="text-white font-semibold"> Date, Type, Amount, Account</span>. 
              Optional columns: <span className="text-white font-semibold">Category, Note, Payment Method</span>.
            </p>

            <form onSubmit={handleCsvImport} className="space-y-6">
              <div className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/20 p-8 rounded-xl text-center flex flex-col items-center">
                <FileSpreadsheet className="w-10 h-10 text-violet-400 mb-3" />
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  required
                  className="text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer"
                />
              </div>

              {importLogs.length > 0 && (
                <div className="bg-zinc-950 p-4 rounded-xl text-[10px] font-mono space-y-1.5 h-32 overflow-y-auto text-zinc-300 border border-zinc-850">
                  {importLogs.map((log, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {log.startsWith('Error') ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      ) : log.includes('complete') ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0"></span>
                      )}
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!csvFile || importing}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold"
                >
                  {importing ? 'Processing...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
