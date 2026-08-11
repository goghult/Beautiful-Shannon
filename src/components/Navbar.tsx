import React from 'react';
import { CalendarDays, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


interface NavbarProps {
  title: string;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  onSeedDemoData?: () => void;
  isSeeded?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  onSeedDemoData,
  isSeeded
}) => {
  const { profile } = useAuth();


  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2024, 2025, 2026, 2027];

  return (
    <header className="glass-panel border-b border-zinc-800 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight m-0">{title}</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Welcome back, {profile?.name || 'User'}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Seed Data Button for Demo Mode / Empty Supabase Mode */}
        {onSeedDemoData && !isSeeded && (
          <button
            onClick={onSeedDemoData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600 border border-violet-500/40 text-violet-200 hover:text-white text-xs font-semibold transition-all duration-200"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Seed Sample Data</span>
          </button>
        )}

        {/* Global Date Selector */}
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-1.5">
          <CalendarDays className="w-4 h-4 text-zinc-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent border-none text-xs font-medium text-white focus:outline-none cursor-pointer pr-1"
          >
            {months.map((name, index) => (
              <option key={name} value={index + 1} className="bg-zinc-950 text-white">
                {name}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent border-none text-xs font-medium text-white focus:outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-zinc-950 text-white">
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
