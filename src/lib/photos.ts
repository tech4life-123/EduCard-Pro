import "server-only";
import { createClient } from "@/lib/supabase/server";

export const ORIGINAL_BUCKET = "member-photos-original";
export const PROCESSED_BUCKET = "member-photos-processed";

/** Photo object paths are `<org id>/<member id>/<random uuid>.jpg`. Anything else is rejected. */
export function photoPathPattern(orgId: string, memberId: string) {
  return new RegExp(`^${orgId}/${memberId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`);
}

/** Short-lived signed URLs for private processed photos. Missing/unauthorized paths are simply absent. */
export async function signedPhotoUrls(paths: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(PROCESSED_BUCKET).createSignedUrls(unique, 60 * 30);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) result.set(row.path, row.signedUrl);
  }
  return result;
}
