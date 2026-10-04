import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES RLS. Server-only (the "server-only" import makes the build fail
 * if this is ever pulled into client code). Use ONLY for narrow, reviewed operations such as the
 * public verify_credential RPC and background batch jobs. Never pass user input into raw queries.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server is missing Supabase configuration.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
