import type { Category } from '../types';

const KEYWORD_MAP: Record<string, string[]> = {
  'groceries': ['groceries', 'supermarket', 'walmart', 'costco', 'safeway', 'kroger', 'aldi', 'whole foods', 'trader joe'],
  'restaurants': ['restaurant', 'dining', 'dinner', 'lunch', 'breakfast', 'eats', 'uber eats', 'doordash', 'grubhub', 'subway', 'mcdonald', 'burger', 'pizza'],
  'fast food': ['mcdonalds', 'starbucks', 'dunkin', 'kfc', 'taco bell', 'burger king', 'wendys', 'pizza', 'cafe', 'coffee'],
  'fuel': ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'mobil', 'bp', 'costco gas', 'petrol'],
  'public transport': ['metro', 'subway', 'train', 'bus', 'transit', 'amtrak'],
  'taxi & rideshare': ['uber', 'lyft', 'taxi', 'cab', 'ride'],
  'electricity': ['electric', 'power', 'coned', 'utility', 'electricity'],
  'water': ['water bill', 'sewer', 'utility water'],
  'internet': ['comcast', 'xfinity', 'spectrum', 'fios', 'att internet', 'wifi'],
  'phone': ['verizon', 't-mobile', 'tmobile', 'at&t', 'sprint', 'phone bill', 'mobile'],
  'movies': ['cinema', 'movie', 'amc', 'regal', 'netflix', 'hulu', 'hbo', 'disney+'],
  'games': ['steam', 'nintendo', 'playstation', 'xbox', 'epic games', 'game'],
  'subscriptions': ['spotify', 'youtube premium', 'apple', 'amazon prime', 'patreon', 'subscription'],
  'clothing': ['zara', 'h&m', 'uniqlo', 'nike', 'adidas', 'clothing', 'shoes', 'nordstrom'],
  'electronics': ['best buy', 'apple store', 'computer', 'gadget', 'electronics', 'microsoft'],
  'gym': ['gym', 'fitness', 'planet fitness', 'equinox', 'membership', 'workout'],
  'medical': ['doctor', 'pharmacy', 'cvs', 'walgreens', 'hospital', 'medical', 'dental', 'dentist', 'pill'],
  'salary': ['salary', 'payroll', 'direct deposit', 'paycheck', 'wage', 'stipend'],
  'freelance': ['freelance', 'upwork', 'fiverr', 'invoice', 'contract'],
  'investments': ['dividend', 'robinhood', 'fidelity', 'schwab', 'crypto', 'coinbase', 'stock']
};

/**
 * Suggests a category based on the description keyword matching
 */
export function suggestCategory(description: string, categories: Category[]): Category | null {
  if (!description) return null;
  const descLower = description.toLowerCase();

  // 1. Try exact keyword matching from our map
  for (const [categoryName, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (descLower.includes(keyword)) {
        // Find a category that matches this keyword mapping
        const matchedCategory = categories.find(
          (c) => c.name.toLowerCase() === categoryName || c.name.toLowerCase() === categoryName.replace(' & ', ' ')
        );
        if (matchedCategory) return matchedCategory;
      }
    }
  }

  // 2. Try matching directly on category names
  for (const category of categories) {
    const catNameLower = category.name.toLowerCase();
    if (descLower.includes(catNameLower)) {
      return category;
    }
  }

  // 3. Fallback to check parent categories
  for (const category of categories) {
    if (category.parent_id === null) {
      const parentName = category.name.toLowerCase();
      // Try to clean name like "Food & Dining" to "food"
      const words = parentName.split(/\s+&\s+|\s+/);
      for (const word of words) {
        if (word.length > 3 && descLower.includes(word)) {
          return category;
        }
      }
    }
  }

  return null;
}
