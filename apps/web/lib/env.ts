// NEXT_PUBLIC_* are inlined at build time (GitHub Actions variables in production).
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
