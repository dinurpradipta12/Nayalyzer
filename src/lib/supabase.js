import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Login aplikasi dimatikan by default agar app bisa langsung dipakai.
// Set VITE_DISABLE_APP_LOGIN=false untuk mengaktifkan Supabase Auth lagi.
export const APP_LOGIN_DISABLED = import.meta.env.VITE_DISABLE_APP_LOGIN !== 'false';

// True when env vars are present — gates all Supabase calls
export const SUPABASE_ENABLED = !!(supabaseUrl && supabaseKey);

export const supabase = SUPABASE_ENABLED
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
