import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Don't throw here — this file is imported at module load time and a hard
  // crash would take down the whole app before the login screen can explain
  // what's missing. Components that need the client check `isSupabaseConfigured`.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in your .env file (see .env.example).'
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
