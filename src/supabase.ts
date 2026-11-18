import { createClient } from '@supabase/supabase-js';

// Publishable keys are designed for browser use. Row Level Security protects the data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wkemfpwmnxqrmqilmosr.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_fXii6oGwa4SVDlS3qorE6A_UB5vWpBt';

// Keep the auth session in persistent local storage so closing and reopening PUASH
// does not sign the customer out. The same storage is shared by every app page.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
