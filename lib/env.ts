import "server-only";

/** Read a required server env var, failing loudly with the variable's name. */
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local and to Vercel.`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
