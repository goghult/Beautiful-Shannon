/**
 * Format integer cents into a currency string (e.g. 12350 -> "$123.50")
 */
export function formatCentsToCurrency(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100;
  
  // Format based on currency type
  try {
    return new Intl.NumberFormat(navigator.language || 'en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch (error) {
    // Fallback format if language/currency code is invalid
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Convert string currency (e.g. "123.50") into integer cents (12350)
 */
export function parseCurrencyToCents(amountString: string): number {
  if (!amountString) return 0;
  // Remove currency symbols, commas, and spaces
  const cleanString = amountString.replace(/[^\d.-]/g, '');
  const parsedFloat = parseFloat(cleanString);
  if (isNaN(parsedFloat)) return 0;
  
  // Multiply by 100 and round to nearest integer to avoid float issues
  return Math.round(parsedFloat * 100);
}

/**
 * Currency conversion using a rate table
 */
export function convertCurrency(
  amountCents: number,
  fromRate: number = 1.0,
  _toRate: number = 1.0
): number {
  return Math.round(amountCents * fromRate);
}
