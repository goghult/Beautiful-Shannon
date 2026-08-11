import React from 'react';
import { 
  LayoutDashboard, ArrowLeftRight, Wallet, PieChart, 
  Calendar, FileText, Tags, LogOut, Shield 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getIsDemoMode } from '../services/api';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { profile, user, signOut } = useAuth();
  const isDemo = getIsDemoMode();

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', name: 'Transactions', icon: ArrowLeftRight },
    { id: 'accounts', name: 'Accounts & Transfers', icon: Wallet },
    { id: 'budgets', name: 'Budgets', icon: PieChart },
    { id: 'recurring', name: 'Recurring Tx', icon: Calendar },
    { id: 'categories', name: 'Categories', icon: Tags },
    { id: 'reports', name: 'Reports & Export', icon: FileText },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-zinc-800 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/10">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-none">FinFlow</h2>
          <span className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">
            {isDemo ? 'Local Demo Mode' : 'Supabase Active'}
          </span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600/30 to-fuchsia-600/20 border border-violet-500/20 text-white shadow-inner shadow-violet-500/5'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40 border border-transparent'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-violet-400' : 'text-zinc-400 group-hover:text-white'}`} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* User Section / Footer */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-950/20">
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-semibold text-white uppercase border border-zinc-700">
            {isDemo ? 'DM' : profile?.name?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {isDemo ? 'Demo User' : profile?.name || 'User'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">
              {isDemo ? 'local@finflow.demo' : user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-200"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
