export function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

export function envBool(name: string): boolean {
  const v = getEnv(name);
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const env = {
  // Public (exposed to browser)
  // NOTE: Must be accessed via process.env.VAR_NAME directly for Next.js to inline them in the browser.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: () => process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  NEXT_PUBLIC_SUPABASE_URL: () => process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,

  // Server-only
  CLERK_SECRET_KEY: () => mustGetEnv("CLERK_SECRET_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: () => mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"),
  CRON_SECRET: () => mustGetEnv("CRON_SECRET"),
  SLACK_WEBHOOK_URL: () => getEnv("SLACK_WEBHOOK_URL"),
  SLACK_BOT_TOKEN: () => getEnv("SLACK_BOT_TOKEN"),
  SLACK_DM_USER_ID: () => getEnv("SLACK_DM_USER_ID"),
  SLACK_WORKFLOW_SHARED_SECRET: () => mustGetEnv("SLACK_WORKFLOW_SHARED_SECRET"),

  // Demo / training
  DEMO_MODE: () => envBool("DEMO_MODE"),
  DEMO_SECRET: () => getEnv("DEMO_SECRET"),
};

