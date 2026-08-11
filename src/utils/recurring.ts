/**
 * Helper to calculate the next date based on frequency and interval
 */
export function calculateNextDate(currentDate: Date, frequency: string, interval: number): Date {
  const next = new Date(currentDate.getTime());
  switch (frequency.toLowerCase()) {
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }
  return next;
}

/**
 * Calculates budget alerts based on spent vs budget limit
 */
export function calculateBudgetAlert(spentCents: number, budgetCents: number): 'OK' | 'WARN_80' | 'ALERT_100' {
  if (budgetCents <= 0) return 'OK';
  const percentage = spentCents / budgetCents;
  if (percentage >= 1.0) return 'ALERT_100';
  if (percentage >= 0.8) return 'WARN_80';
  return 'OK';
}
