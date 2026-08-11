import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Category } from '../../types';
import { 
  Plus, Edit, Trash2, X,
  Tag, Check 
} from 'lucide-react';

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', 
  '#8B5CF6', '#EC4899', '#14B8A6', '#6B7280', '#06B6D4'
];

const ICONS = [
  'utensils', 'car', 'credit-card', 'tv', 'shopping-bag', 
  'heart', 'book-open', 'plane', 'briefcase', 'laptop', 
  'gift', 'trending-up', 'coffee', 'shopping-cart', 'dumbbell'
];

export const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formParentId, setFormParentId] = useState<string>('none');
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formIcon, setFormIcon] = useState(ICONS[0]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormType('expense');
    setFormParentId('none');
    setFormColor(COLORS[0]);
    setFormIcon(ICONS[0]);
    setIsFormOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormParentId(cat.parent_id || 'none');
    setFormColor(cat.color || COLORS[0]);
    setFormIcon(cat.icon || ICONS[0]);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Name cannot be empty");
      return;
    }

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, formName, formColor, formIcon);
      } else {
        const parentId = formParentId === 'none' ? null : formParentId;
        await api.createCategory(formName, formType, formColor, formIcon, parentId);
      }
      setIsFormOpen(false);
      await loadCategories();
    } catch (e: any) {
      alert(e.message || "Failed to save category");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this category? (Soft delete will be applied)")) return;
    try {
      await api.deleteCategory(id);
      await loadCategories();
    } catch (e: any) {
      alert(e.message || "Failed to delete category");
    }
  };

  // Separate parent and subcategories
  const parentCategories = categories.filter(c => c.parent_id === null);

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
          <h2 className="text-xl font-bold text-white">Categories</h2>
          <p className="text-zinc-400 text-xs mt-0.5">Manage and organize system and custom transaction categories</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold shadow-lg shadow-violet-500/10 transition-all hover:scale-[1.01]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Parent categories and subcategories rendering */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parentCategories.map((parent) => {
          // Find children subcategories
          const subcats = categories.filter(c => c.parent_id === parent.id);
          const isSystem = parent.user_id === null;

          return (
            <div key={parent.id} className="glass-card p-6 rounded-2xl flex flex-col justify-between min-h-[160px] group relative">
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isSystem && (
                  <>
                    <button
                      onClick={() => openEditModal(parent)}
                      className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(parent.id)}
                      className="p-1 rounded bg-zinc-800 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: `${parent.color}20`, color: parent.color || '#9ca3af' }}
                  >
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">{parent.name}</h4>
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">{parent.type}</span>
                  </div>
                </div>

                {/* Subcategories list */}
                {subcats.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Subcategories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {subcats.map((sub) => {
                        const isSubSystem = sub.user_id === null;
                        return (
                          <div 
                            key={sub.id} 
                            className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full bg-zinc-900 border border-zinc-850 text-[10px] font-semibold text-zinc-300 hover:border-zinc-700 transition-all hover:text-white group/sub"
                          >
                            <span>{sub.name}</span>
                            {!isSubSystem && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(sub.id);
                                }}
                                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-colors"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs italic">No subcategories defined.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FORM MODAL */}
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
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dining Out, Utilities, Pets"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs"
                />
              </div>

              {!editingCategory && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Type</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as 'income' | 'expense')}
                      className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 text-xs font-semibold mb-1.5">Parent Category</label>
                    <select
                      value={formParentId}
                      onChange={(e) => setFormParentId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl glass-input text-white bg-zinc-950 text-xs"
                    >
                      <option value="none">None (Is Parent)</option>
                      {parentCategories
                        .filter(c => c.type === formType)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Color picker */}
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-2">Display Color</label>
                <div className="flex flex-wrap gap-2.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className="w-6 h-6 rounded-full border border-zinc-900 flex items-center justify-center hover:scale-105 transition-transform"
                      style={{ backgroundColor: c }}
                    >
                      {formColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
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
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
