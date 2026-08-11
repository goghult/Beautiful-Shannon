import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { RecurringTemplate, Account, Category, FrequencyType } from '../../types';
import { formatCentsToCurrency, parseCurrencyToCents } from '../../utils/currency';
import { 
  Plus, Calendar, ToggleLeft, ToggleRight, Trash2, Edit2, X, Info
} from 'lucide-react';

export const Recurring: React.FC = () => {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [_loading, setLoading] = useState(true);

  // Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);

  // Form Fields
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formFrequency, setFormFrequency] = useState<FrequencyType>('monthly');
  const [formInterval, setFormInterval] = useState('1');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('transfer');

  const loadData = async () => {
    setLoading(true);
    try {
      const [temps, accs, cats] = await Promise.all([
        api.getRecurringTemplates(),
        api.getAccounts(),
        api.getCategories()
      ]);
      setTemplates(temps);
      setAccounts(accs);
      setCategories(cats);

      if (accs.length > 0) setFormAccountId(accs[0].id);
      const expCats = cats.filter(c => c.type === 'expense');
      if (expCats.length > 0) setFormCategoryId(expCats[0].id);
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
    setEditingTemplate(null);
    setFormType('expense');
    setFormAmount('');
    setFormFrequency('monthly');
    setFormInterval('1');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate('');
    setFormNote('');
    setFormPaymentMethod('transfer');

    if (accounts.length > 0) setFormAccountId(accounts[0].id);
    const expCats = categories.filter(c => c.type === 'expense');
    if (expCats.length > 0) setFormCategoryId(expCats[0].id);

    setIsFormOpen(true);
  };

  const openEditModal = (temp: RecurringTemplate) => {
    setEditingTemplate(temp);
    setFormType(temp.type as 'income' | 'expense');
    setFormAmount((temp.amount_cents / 100).toString());
    setFormAccountId(temp.account_id);
    setFormCategoryId(temp.category_id || '');
    setFormFrequency(temp.frequency);
    setFormInterval(temp.interval.toString());
    setFormStartDate(temp.start_date.split('T')[0]);
    setFormEndDate(temp.end_date ? temp.end_date.split('T')[0] : '');
    setFormNote(temp.note || '');
    setFormPaymentMethod(temp.payment_method || 'transfer');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseCurrencyToCents(formAmount);
    if (amountCents <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }

    const intervalVal = parseInt(formInterval);
    if (isNaN(intervalVal) || intervalVal <= 0) {
      alert("Please enter a valid interval greater than 0");
      return;
    }

    const payload = {
      account_id: formAccountId,
      destination_account_id: null,
      category_id: formCategoryId || null,
      type: formType,
      amount_cents: amountCents,
      currency: accounts.find(a => a.id === formAccountId)?.currency || 'USD',
      frequency: formFrequency,
      interval: intervalVal,
      start_date: new Date(formStartDate).toISOString(),
      end_date: formEndDate ? new Date(formEndDate).toISOString() : null,
      next_generation_date: new Date(formStartDate).toISOString(), // Start generating from start date
      note: formNote,
      payment_method: formPaymentMethod,
      is_active: editingTemplate ? editingTemplate.is_active : true
    };

    try {
      if (editingTemplate) {
        await api.updateRecurringTemplate(editingTemplate.id, payload);
      } else {
        await api.createRecurringTemplate(payload);
      }
      setIsFormOpen(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to save template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template? Future auto-generation will cease.")) return;
    try {
      await api.deleteRecurringTemplate(id);
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete template");
    }
  };

  const toggleActive = async (temp: RecurringTemplate) => {
    try {
      await api.updateRecurringTemplate(temp.id, { is_active: !temp.is_active });
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to toggle template status");
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Recurring Transactions</h2>
          <p className="text-zinc-400 text-xs mt-0.5">Schedule recurring templates for automated generation</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold shadow-lg shadow-violet-500/10 transition-all hover:scale-[1.01]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Schedule</span>
        </button>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-2xl bg-zinc-950/20 border border-zinc-800 flex items-start gap-3.5 max-w-3xl">
        <Info className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-white">How it works</p>
          <p>
            Recurring transactions are automatically created on their scheduled dates. The server processes active schedules daily. Click the "Sync Recurring Bills" button on the Dashboard to run this check manually.
          </p>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((t) => {
          const cat = categories.find(c => c.id === t.category_id);
          const acc = accounts.find(a => a.id === t.account_id);
          const nextDate = new Date(t.next_generation_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

          return (
            <div 
              key={t.id} 
              className={`glass-card p-6 rounded-2xl border flex flex-col justify-between h-56 transition-all duration-200 ${
                t.is_active ? 'border-zinc-800' : 'border-zinc-800/40 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-bold text-sm truncate max-w-[200px]">{t.note || 'Scheduled Transaction'}</h4>
                    <span className="text-[10px] text-zinc-500 capitalize bg-zinc-800/60 px-2 py-0.5 rounded-full font-semibold">
                      {t.frequency} {t.interval > 1 ? `(every ${t.interval})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span 
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${cat?.color}15`, color: cat?.color || '#9ca3af' }}
                    >
                      {cat?.name || 'Uncategorized'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase">on {acc?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(t)}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    {t.is_active ? (
                      <ToggleRight className="w-6 h-6 text-violet-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>

              <div className="my-4 pt-4 border-t border-zinc-800/50 flex justify-between items-center text-xs">
                <span className="text-zinc-500">Next Scheduled Date</span>
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{nextDate}</span>
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-auto">
                <span className={`text-base font-extrabold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {t.type === 'income' ? '+' : '-'}
                  {formatCentsToCurrency(t.amount_cents, t.currency)}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(t)}
                    className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded bg-zinc-800 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <div className="glass-card col-span-2 p-12 text-center text-zinc-500 text-xs rounded-2xl">
            No recurring transaction templates scheduled. Add one using the button above!
          </div>
        )}
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
              {editingTemplate ? 'Edit Scheduled Transaction' : 'Schedule Recurring Transaction'}
            </h3>

            {/* Type selector tabs */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {(['expense', 'income'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormType(type)}
                  className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                    formType === type
                      ? type === 'expense'
                        ? 'bg-rose-500/25 border border-rose-500/40 text-rose-300'
                        : 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300'
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
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Amount ($)</label>
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

                {/* Account */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Account</label>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    {categories
                      .filter(c => c.type === formType)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as FrequencyType)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Interval */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Interval</label>
                  <input
                    type="number"
                    min="1"
                    value={formInterval}
                    onChange={(e) => setFormInterval(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    required
                    className="w-full px-2 py-2.5 rounded-xl glass-input text-white text-xs"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-zinc-400 text-xs font-semibold mb-1.5">End Date (Opt)</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-2 py-2.5 rounded-xl glass-input text-white text-xs"
                  />
                </div>
              </div>

              {/* Note / Memo */}
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Memo / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Landlord Rent Payment, Gym dues"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                />
              </div>

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
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
