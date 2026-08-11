import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Account, AccountType, ExchangeRate } from '../../types';
import { formatCentsToCurrency, parseCurrencyToCents } from '../../utils/currency';
import { 
  Plus, ArrowRightLeft, CreditCard, Landmark, Coins, PiggyBank,
  Edit, Trash2, X, Info
} from 'lucide-react';

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Account Form Fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AccountType>('checking');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formInitialBalance, setFormInitialBalance] = useState('');

  // Transfer Form Fields
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, rates] = await Promise.all([
        api.getAccounts(),
        api.getExchangeRates()
      ]);
      setAccounts(accs);
      setExchangeRates(rates);

      if (accs.length > 0) {
        setFromAccountId(accs[0].id);
        setToAccountId(accs[1]?.id || accs[0].id);
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

  const openAddModal = () => {
    setEditingAccount(null);
    setFormName('');
    setFormType('checking');
    setFormCurrency('USD');
    setFormInitialBalance('0.00');
    setIsFormOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setFormName(acc.name);
    setFormType(acc.type);
    setFormCurrency(acc.currency);
    setFormInitialBalance((acc.initial_balance_cents / 100).toString());
    setIsFormOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceCents = parseCurrencyToCents(formInitialBalance);

    try {
      if (editingAccount) {
        await api.updateAccount(editingAccount.id, formName, formType);
      } else {
        await api.createAccount(formName, formType, formCurrency, balanceCents);
      }
      setIsFormOpen(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to save account");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this account? Transactions associated will remain but the balance won't show in your net worth list.")) return;
    try {
      await api.deleteAccount(id);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete account");
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromAccountId === toAccountId) {
      alert("Source and Destination accounts must be different.");
      return;
    }

    const amountCents = parseCurrencyToCents(transferAmount);
    if (amountCents <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }

    const fromAcc = accounts.find(a => a.id === fromAccountId)!;
    const toAcc = accounts.find(a => a.id === toAccountId)!;

    // Exchange rate calculation
    let rate = 1.0;
    if (fromAcc.currency !== toAcc.currency) {
      const match = exchangeRates.find(
        r => r.from_currency === fromAcc.currency && r.to_currency === toAcc.currency
      );
      if (match) {
        rate = Number(match.rate);
      } else {
        // Look up reverse
        const revMatch = exchangeRates.find(
          r => r.from_currency === toAcc.currency && r.to_currency === fromAcc.currency
        );
        rate = revMatch ? 1 / Number(revMatch.rate) : 1.0;
      }
    }

    try {
      await api.createTransaction({
        account_id: fromAccountId,
        destination_account_id: toAccountId,
        category_id: null,
        type: 'transfer',
        amount_cents: amountCents,
        currency: fromAcc.currency,
        exchange_rate: rate,
        date: new Date(transferDate).toISOString(),
        note: transferNote || `Transfer from ${fromAcc.name} to ${toAcc.name}`,
        payment_method: 'transfer'
      });
      setIsTransferOpen(false);
      setTransferAmount('');
      setTransferNote('');
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to complete transfer");
    }
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'credit_card': return CreditCard;
      case 'savings': return PiggyBank;
      case 'cash': return Coins;
      default: return Landmark;
    }
  };

  // Group accounts for summary card
  const totalCentsByCurrency = accounts.reduce((acc: Record<string, number>, curr) => {
    if (!acc[curr.currency]) acc[curr.currency] = 0;
    acc[curr.currency] += curr.current_balance_cents;
    return acc;
  }, {});

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Accounts & Transfers</h2>
          <p className="text-zinc-400 text-xs mt-0.5">Manage financial accounts and execute transfers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTransferOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold hover:bg-zinc-800 transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Funds</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold shadow-lg shadow-violet-500/10 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Net Worth Summary Panel */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4">Net Worth Summary</h3>
        <div className="flex flex-wrap gap-8 items-center">
          {Object.entries(totalCentsByCurrency).map(([currency, totalCents]) => (
            <div key={currency} className="space-y-1 pr-8 border-r border-zinc-800/80 last:border-0">
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">{currency} Total</p>
              <h4 className="text-2xl font-extrabold text-white">
                {formatCentsToCurrency(totalCents, currency)}
              </h4>
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="text-zinc-500 text-xs">Create an account to see your total balance summary.</p>
          )}
        </div>
      </div>

      {/* Account Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {accounts.map((acc) => {
          const Icon = getAccountIcon(acc.type);
          return (
            <div key={acc.id} className="glass-card p-6 rounded-2xl flex flex-col justify-between h-48 group relative">
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditModal(acc)}
                  className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="p-1 rounded bg-zinc-800 text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 text-zinc-300 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-white font-bold text-base truncate pr-10">{acc.name}</h4>
                <p className="text-[10px] text-zinc-500 uppercase font-semibold capitalize mt-0.5">{acc.type.replace('_', ' ')}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-baseline justify-between">
                <span className="text-[10px] text-zinc-500">Balance</span>
                <span className="text-white font-black text-lg">
                  {formatCentsToCurrency(acc.current_balance_cents, acc.currency)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ACCOUNT DETAILS FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </h3>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chase College Checking, Cash Wallet"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Account Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as AccountType)}
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Currency</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    disabled={!!editingAccount} // Currency immutable on edit to keep accounting intact
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs disabled:opacity-50"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CAD">CAD (C$)</option>
                  </select>
                </div>
              </div>

              {!editingAccount && (
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Initial Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formInitialBalance}
                    onChange={(e) => setFormInitialBalance(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs font-bold"
                  />
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

      {/* TRANSFER MODAL */}
      {isTransferOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsTransferOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">Transfer Funds</h3>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Source Account</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Destination Account</label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Transfer Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Date</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Memo / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Savings deposit"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                />
              </div>

              {/* Exchange rate warnings if currencies differ */}
              {fromAccountId && toAccountId && fromAccountId !== toAccountId && (
                (() => {
                  const fromAcc = accounts.find(a => a.id === fromAccountId);
                  const toAcc = accounts.find(a => a.id === toAccountId);
                  if (fromAcc && toAcc && fromAcc.currency !== toAcc.currency) {
                    const match = exchangeRates.find(r => r.from_currency === fromAcc.currency && r.to_currency === toAcc.currency);
                    return (
                      <div className="p-3.5 rounded-xl bg-violet-600/10 border border-violet-500/20 text-[10px] text-violet-300 flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
                        <div>
                          <p className="font-semibold text-white mb-0.5">Multi-Currency Conversion</p>
                          <p>
                            Transfer converts from {fromAcc.currency} to {toAcc.currency} at the fixed rate of{' '}
                            <span className="text-white font-bold">{match ? match.rate : '1.0'}</span>.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
