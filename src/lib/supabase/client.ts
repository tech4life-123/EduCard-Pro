import { createBrowserClient } from "@supabase/ssr";

/** Browser client. Uses only the public URL + publishable key; all access is governed by RLS. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
