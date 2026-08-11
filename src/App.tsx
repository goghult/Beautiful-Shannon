import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Auth } from './components/Auth';
import { Dashboard } from './features/dashboard/Dashboard';
import { Transactions } from './features/transactions/Transactions';
import { Accounts } from './features/accounts/Accounts';
import { Budgeting } from './features/budgeting/Budgeting';
import { Recurring } from './features/recurring/Recurring';
import { Categories } from './features/categories/Categories';
import { Reports } from './features/reports/Reports';
import { getIsDemoMode, setIsDemoMode, api } from './services/api';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [isDemo, setIsDemo] = useState(getIsDemoMode());
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSeeded, setIsSeeded] = useState(false);

  // Global active month/year state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Check if we already have transactions/accounts to decide on seeding
  const checkDataStatus = async () => {
    try {
      const accs = await api.getAccounts();
      setIsSeeded(accs.length > 0);
    } catch (e) {
      console.error("Database connection failed or tables not initialized yet:", e);
      setIsSeeded(false);
    }
  };

  useEffect(() => {
    if (user || isDemo) {
      checkDataStatus();
    }
  }, [user, isDemo]);

  const handleBypassDemo = async () => {
    setIsDemoMode(true);
    setIsDemo(true);
    // Auto seed demo data in localStorage
    await api.seedDemoData();
    setIsSeeded(true);
    setCurrentTab('dashboard');
  };

  const handleSeedData = async () => {
    const confirmSeed = window.confirm(
      "This will populate your account with sample transactions, budgets, and accounts for testing. Proceed?"
    );
    if (!confirmSeed) return;

    try {
      const result = await api.seedDemoData();
      alert(result.message);
      setIsSeeded(true);
      // Reload active view
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "Failed to seed data");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090b11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 text-xs font-semibold">Initializing FinFlow...</p>
        </div>
      </div>
    );
  }

  // Show Auth if not logged in and not in demo mode
  if (!user && !isDemo) {
    return <Auth onBypassDemo={handleBypassDemo} />;
  }

  // Determine active view title
  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'transactions': return 'Transaction Audit';
      case 'accounts': return 'Accounts & Liquidity';
      case 'budgets': return 'Budget Settings';
      case 'recurring': return 'Recurring Bill Schedules';
      case 'categories': return 'Custom Categories';
      case 'reports': return 'Financial Report Statement';
      default: return 'FinFlow';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#090b11] text-zinc-100">
      {/* Sidebar */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar 
          title={getTabTitle()}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          onSeedDemoData={handleSeedData}
          isSeeded={isSeeded}
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <Dashboard 
              selectedMonth={selectedMonth} 
              selectedYear={selectedYear} 
            />
          )}
          {currentTab === 'transactions' && <Transactions />}
          {currentTab === 'accounts' && <Accounts />}
          {currentTab === 'budgets' && (
            <Budgeting 
              selectedMonth={selectedMonth} 
              selectedYear={selectedYear} 
            />
          )}
          {currentTab === 'recurring' && <Recurring />}
          {currentTab === 'categories' && <Categories />}
          {currentTab === 'reports' && (
            <Reports 
              selectedMonth={selectedMonth} 
              selectedYear={selectedYear} 
            />
          )}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
