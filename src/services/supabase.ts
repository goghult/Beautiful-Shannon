import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Opt-in runtime logging. Enable by setting `VITE_ENABLE_RUNTIME_LOGS=true` in your Vite env or
// the app will log automatically in `import.meta.env.DEV` (local development).
const enableRuntimeLogs = (import.meta.env.VITE_ENABLE_RUNTIME_LOGS === 'true') || !!import.meta.env.DEV;

if (enableRuntimeLogs) {
	console.info('FinFlow runtime info:', {
		mode: import.meta.env.MODE,
		VITE_SUPABASE_URL_present: !!import.meta.env.VITE_SUPABASE_URL,
		VITE_SUPABASE_ANON_KEY_present: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
	});
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
