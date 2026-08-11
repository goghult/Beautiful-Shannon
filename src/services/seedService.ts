import { supabase } from './supabase';


export async function seedUserData(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Fetch system default categories (where user_id is null)
    const { data: defaultCategories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .is('user_id', null);

    if (catError) throw catError;
    if (!defaultCategories || defaultCategories.length === 0) {
      throw new Error('Default categories not found in database. Run database migrations first.');
    }

    // Helper to find category by name
    const findCat = (name: string) => defaultCategories.find((c: any) => c.name === name) || defaultCategories[0];

    // 2. Create standard accounts
    const accountsData = [
      { user_id: userId, name: 'Main Checking', type: 'checking', currency: 'USD', initial_balance_cents: 500000, current_balance_cents: 500000 },
      { user_id: userId, name: 'Pocket Cash', type: 'cash', currency: 'USD', initial_balance_cents: 20000, current_balance_cents: 20000 },
      { user_id: userId, name: 'Travel Credit Card', type: 'credit_card', currency: 'USD', initial_balance_cents: -15000, current_balance_cents: -15000 },
      { user_id: userId, name: 'High-Yield Savings', type: 'savings', currency: 'USD', initial_balance_cents: 1200000, current_balance_cents: 1200000 },
    ];

    const { data: insertedAccounts, error: accError } = await supabase
      .from('accounts')
      .insert(accountsData)
      .select();

    if (accError) throw accError;
    if (!insertedAccounts) throw new Error('Failed to create accounts');

    const checkingAcc = insertedAccounts.find((a: any) => a.name === 'Main Checking')!;
    const cashAcc = insertedAccounts.find((a: any) => a.name === 'Pocket Cash')!;
    const creditAcc = insertedAccounts.find((a: any) => a.name === 'Travel Credit Card')!;
    const savingsAcc = insertedAccounts.find((a: any) => a.name === 'High-Yield Savings')!;

    // 3. Create monthly budgets for the current year/month and previous month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const budgetLimits = [
      { name: 'Food & Dining', amount: 50000 },
      { name: 'Transport', amount: 20000 },
      { name: 'Bills & Utilities', amount: 40000 },
      { name: 'Entertainment', amount: 15000 },
      { name: 'Shopping', amount: 30000 },
      { name: 'Health & Fitness', amount: 10000 },
    ];

    const budgetsToInsert = [];
    for (const lim of budgetLimits) {
      const cat = findCat(lim.name);
      budgetsToInsert.push(
        { user_id: userId, category_id: cat.id, amount_cents: lim.amount, month: currentMonth, year: currentYear },
        { user_id: userId, category_id: cat.id, amount_cents: lim.amount, month: prevMonth, year: prevYear }
      );
    }

    const { error: budError } = await supabase
      .from('budgets')
      .insert(budgetsToInsert);

    if (budError) throw budError;

    // 4. Create sample transactions (expenses, income, transfers)
    // We generate data spread over the last 45 days
    const txData = [];

    // Helper to get ISO date relative to today
    const daysAgo = (num: number) => {
      const d = new Date();
      d.setDate(d.getDate() - num);
      return d.toISOString();
    };

    // Salary (Income)
    txData.push(
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Salary').id, type: 'income', amount_cents: 350000, date: daysAgo(30), note: 'Monthly Salary Paycheck', payment_method: 'transfer' },
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Salary').id, type: 'income', amount_cents: 350000, date: daysAgo(1), note: 'Monthly Salary Paycheck', payment_method: 'transfer' }
    );

    // Freelance (Income)
    txData.push(
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Freelance').id, type: 'income', amount_cents: 45000, date: daysAgo(15), note: 'Logo Design Project', payment_method: 'online_payment' },
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Freelance').id, type: 'income', amount_cents: 60000, date: daysAgo(25), note: 'Web Dev Consulting', payment_method: 'online_payment' }
    );

    // Food (Groceries, Restaurants, Fast Food)
    txData.push(
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Groceries').id, type: 'expense', amount_cents: 12540, date: daysAgo(28), note: 'Weekly Groceries at Costco', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Groceries').id, type: 'expense', amount_cents: 8420, date: daysAgo(21), note: 'Trader Joes groceries', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Groceries').id, type: 'expense', amount_cents: 11050, date: daysAgo(14), note: 'Whole Foods purchase', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Groceries').id, type: 'expense', amount_cents: 9380, date: daysAgo(7), note: 'Weekly grocery restock', payment_method: 'card' },
      
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Restaurants').id, type: 'expense', amount_cents: 7550, date: daysAgo(25), note: 'Dinner with friends at Italian Place', payment_method: 'card' },
      { user_id: userId, account_id: cashAcc.id, category_id: findCat('Restaurants').id, type: 'expense', amount_cents: 2200, date: daysAgo(18), note: 'Lunch meeting', payment_method: 'cash' },
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Restaurants').id, type: 'expense', amount_cents: 8900, date: daysAgo(10), note: 'Date Night dinner', payment_method: 'card' },
      
      { user_id: userId, account_id: cashAcc.id, category_id: findCat('Fast Food').id, type: 'expense', amount_cents: 1250, date: daysAgo(23), note: 'Starbucks Coffee', payment_method: 'cash' },
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Fast Food').id, type: 'expense', amount_cents: 1850, date: daysAgo(12), note: 'McDonalds drive-thru', payment_method: 'card' },
      { user_id: userId, account_id: cashAcc.id, category_id: findCat('Fast Food').id, type: 'expense', amount_cents: 850, date: daysAgo(3), note: 'Local Coffee Shop', payment_method: 'cash' }
    );

    // Transport (Fuel, Taxi)
    txData.push(
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Fuel').id, type: 'expense', amount_cents: 4500, date: daysAgo(27), note: 'Shell gas station', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Fuel').id, type: 'expense', amount_cents: 4800, date: daysAgo(13), note: 'Chevron Fueling', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Taxi & Rideshare').id, type: 'expense', amount_cents: 2450, date: daysAgo(24), note: 'Uber ride home', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Taxi & Rideshare').id, type: 'expense', amount_cents: 1900, date: daysAgo(5), note: 'Lyft ride to office', payment_method: 'card' }
    );

    // Bills & Utilities
    txData.push(
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Electricity').id, type: 'expense', amount_cents: 11500, date: daysAgo(26), note: 'Power Utility Bill', payment_method: 'transfer' },
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Internet').id, type: 'expense', amount_cents: 6500, date: daysAgo(26), note: 'Comcast Internet', payment_method: 'transfer' },
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Phone').id, type: 'expense', amount_cents: 8000, date: daysAgo(26), note: 'Verizon Mobile Plan', payment_method: 'transfer' }
    );

    // Entertainment & Subscriptions
    txData.push(
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Movies').id, type: 'expense', amount_cents: 2800, date: daysAgo(22), note: 'AMC IMAX Movie Ticket', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Subscriptions').id, type: 'expense', amount_cents: 1549, date: daysAgo(15), note: 'Netflix Subscription', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Subscriptions').id, type: 'expense', amount_cents: 999, date: daysAgo(15), note: 'Spotify Family Plan', payment_method: 'card' }
    );

    // Shopping
    txData.push(
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Clothing').id, type: 'expense', amount_cents: 12000, date: daysAgo(20), note: 'Nike Shoes purchase', payment_method: 'card' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Electronics').id, type: 'expense', amount_cents: 15000, date: daysAgo(8), note: 'Mechanical Keyboard from Amazon', payment_method: 'card' }
    );

    // Health
    txData.push(
      { user_id: userId, account_id: checkingAcc.id, category_id: findCat('Gym').id, type: 'expense', amount_cents: 5000, date: daysAgo(10), note: 'Monthly Gym Membership', payment_method: 'transfer' },
      { user_id: userId, account_id: creditAcc.id, category_id: findCat('Medical').id, type: 'expense', amount_cents: 2500, date: daysAgo(17), note: 'Pharmacy Co-pay', payment_method: 'card' }
    );

    // Transfers
    txData.push(
      // Savings transfer
      { user_id: userId, account_id: checkingAcc.id, destination_account_id: savingsAcc.id, type: 'transfer', amount_cents: 100000, exchange_rate: 1.0, date: daysAgo(29), note: 'Monthly Savings Allocation', payment_method: 'transfer' },
      { user_id: userId, account_id: checkingAcc.id, destination_account_id: savingsAcc.id, type: 'transfer', amount_cents: 100000, exchange_rate: 1.0, date: daysAgo(2), note: 'Monthly Savings Allocation', payment_method: 'transfer' },
      // Credit card bill payment
      { user_id: userId, account_id: checkingAcc.id, destination_account_id: creditAcc.id, type: 'transfer', amount_cents: 50000, exchange_rate: 1.0, date: daysAgo(16), note: 'Credit Card Payment', payment_method: 'transfer' }
    );

    // Insert all transactions
    const { error: txError } = await supabase
      .from('transactions')
      .insert(txData);

    if (txError) throw txError;

    // 5. Create recurring templates
    const templatesData = [
      {
        user_id: userId,
        account_id: checkingAcc.id,
        category_id: findCat('Salary').id,
        type: 'income',
        amount_cents: 350000,
        currency: 'USD',
        frequency: 'monthly',
        interval: 1,
        start_date: daysAgo(0),
        next_generation_date: daysAgo(-30), // Scheduled next month
        note: 'Salary Paycheck Direct Deposit',
        payment_method: 'transfer',
        is_active: true
      },
      {
        user_id: userId,
        account_id: creditAcc.id,
        category_id: findCat('Subscriptions').id,
        type: 'expense',
        amount_cents: 1549,
        currency: 'USD',
        frequency: 'monthly',
        interval: 1,
        start_date: daysAgo(0),
        next_generation_date: daysAgo(-7), // Scheduled next week
        note: 'Netflix Premium Plan',
        payment_method: 'card',
        is_active: true
      },
      {
        user_id: userId,
        account_id: checkingAcc.id,
        category_id: findCat('Gym').id,
        type: 'expense',
        amount_cents: 5000,
        currency: 'USD',
        frequency: 'monthly',
        interval: 1,
        start_date: daysAgo(0),
        next_generation_date: daysAgo(-12),
        note: 'Gym Membership',
        payment_method: 'transfer',
        is_active: true
      }
    ];

    const { error: tempError } = await supabase
      .from('recurring_templates')
      .insert(templatesData);

    if (tempError) throw tempError;

    return { success: true, message: 'Sample financial accounts, budgets, transactions, and scheduled templates created!' };
  } catch (error: any) {
    console.error('Error seeding data:', error);
    return { success: false, message: error.message || 'Unknown error occurred while seeding.' };
  }
}
