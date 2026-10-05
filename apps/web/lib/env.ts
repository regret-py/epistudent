// NEXT_PUBLIC_* are inlined at build time. Production defaults point at the epistudent.fr
// Supabase project; the publishable key is public by design (RLS protects the data).
const PROD_URL = "https://gayltuhbhsojbrfmjzvg.supabase.co";
const PROD_KEY = "sb_publishable_iret-zxfpn55E5yahTMkxg_XhYbVE-U";

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || PROD_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PROD_KEY,
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
