import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (import.meta.env.DEV) {
  console.log('runtime env:', {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'present' : 'missing',
  });
} else {
  console.log('runtime env: VITE_SUPABASE_URL is', !!import.meta.env.VITE_SUPABASE_URL ? 'present' : 'missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
