/**
 * Public Supabase settings, shared by the browser, middleware and server clients.
 * Next.js only inlines NEXT_PUBLIC_* vars for literal `process.env.X` reads, so each is read by name here.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local and to Vercel.`);
  return value;
}

export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = (): string => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
