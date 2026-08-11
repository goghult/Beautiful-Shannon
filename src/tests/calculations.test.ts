import { describe, test, expect } from 'vitest';
import { calculateNextDate, calculateBudgetAlert } from '../utils/recurring';
import { parseCurrencyToCents, convertCurrency } from '../utils/currency';

describe('Budget Alerts Threshold Logic', () => {
  test('Returns OK if budget is zero or negative', () => {
    expect(calculateBudgetAlert(1000, 0)).toBe('OK');
    expect(calculateBudgetAlert(1000, -100)).toBe('OK');
  });

  test('Returns OK when spent is below 80%', () => {
    expect(calculateBudgetAlert(799, 1000)).toBe('OK');
    expect(calculateBudgetAlert(0, 1000)).toBe('OK');
  });

  test('Returns WARN_80 when spent is exactly 80%', () => {
    expect(calculateBudgetAlert(800, 1000)).toBe('WARN_80');
  });

  test('Returns WARN_80 when spent is between 80% and 100%', () => {
    expect(calculateBudgetAlert(999, 1000)).toBe('WARN_80');
  });

  test('Returns ALERT_100 when spent is exactly 100%', () => {
    expect(calculateBudgetAlert(1000, 1000)).toBe('ALERT_100');
  });

  test('Returns ALERT_100 when spent exceeds 100%', () => {
    expect(calculateBudgetAlert(1200, 1000)).toBe('ALERT_100');
  });
});

describe('Recurring Scheduled Date Calculus', () => {
  test('Advances daily schedule correctly', () => {
    const start = new Date('2026-08-01T12:00:00.000Z');
    const next = calculateNextDate(start, 'daily', 3);
    expect(next.toISOString()).toBe('2026-08-04T12:00:00.000Z');
  });

  test('Advances weekly schedule correctly', () => {
    const start = new Date('2026-08-01T12:00:00.000Z');
    const next = calculateNextDate(start, 'weekly', 2);
    expect(next.toISOString()).toBe('2026-08-15T12:00:00.000Z');
  });

  test('Advances monthly schedule correctly', () => {
    const start = new Date('2026-08-01T12:00:00.000Z');
    const next = calculateNextDate(start, 'monthly', 1);
    expect(next.toISOString()).toBe('2026-09-01T12:00:00.000Z');
  });

  test('Advances yearly schedule correctly', () => {
    const start = new Date('2026-08-01T12:00:00.000Z');
    const next = calculateNextDate(start, 'yearly', 1);
    expect(next.toISOString()).toBe('2027-08-01T12:00:00.000Z');
    expect(next.getFullYear()).toBe(2027);
  });

  test('Handles monthly rollover across end of years correctly', () => {
    const start = new Date('2026-12-15T12:00:00.000Z');
    const next = calculateNextDate(start, 'monthly', 1);
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0); // January is 0
  });
});

describe('Currency and Cent Precision Logic', () => {
  test('Parses decimal currency strings to integer cents without floats', () => {
    expect(parseCurrencyToCents('123.45')).toBe(12345);
    expect(parseCurrencyToCents('$1,234.56')).toBe(123456);
    expect(parseCurrencyToCents('0.10')).toBe(10);
    expect(parseCurrencyToCents('0.00')).toBe(0);
    expect(parseCurrencyToCents('  ')).toBe(0);
  });

  test('Converts cents using conversion factors with correct rounding', () => {
    // 100 USD cents at exchange rate 83.333333 => 8333 INR cents
    expect(convertCurrency(100, 83.333333)).toBe(8333);
    // 1000 EUR cents at rate 1.1 => 1100 USD cents
    expect(convertCurrency(1000, 1.1)).toBe(1100);
  });
});
