import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customKeysUsed } from "@/lib/templates/schema";
import { CATALOG } from "@/lib/templates/families";

const MAX_FIELDS = 30;

/** "house_no" -> "House No" */
export const labelFromKey = (key: string) => key.split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

/** Custom field keys that any catalog template reads (e.g. block, house_no, house_code). */
export function catalogCustomKeys(): string[] {
  const keys = new Set<string>();
  for (const t of CATALOG) {
    for (const side of ["front", "back"] as const) {
      const recipe = side === "front"
        ? { kind: "front", family: t.front[0], cat: t.category, variant: t.front[1] }
        : { kind: "back", family: t.orientation === "portrait" ? "portrait" : "landscape", cat: t.category, variant: t.back };
      customKeysUsed({ recipe }).forEach((k) => keys.add(k));
    }
  }
  return [...keys];
}

/** Create any custom fields the given designs need and the organization does not have yet. Returns the keys added. */
export async function ensureFieldsForKeys(supabase: SupabaseClient, orgId: string, wanted: string[]): Promise<string[]> {
  if (wanted.length === 0) return [];
  const { data: existing } = await supabase.from("member_custom_field_defs").select("key").eq("organization_id", orgId);
  const have = new Set((existing ?? []).map((d: { key: string }) => d.key));
  const missing = wanted.filter((k) => !have.has(k));
  const room = Math.max(0, MAX_FIELDS - have.size);
  const toAdd = missing.slice(0, room);
  if (toAdd.length === 0) return [];
  const base = have.size;
  const { error } = await supabase.from("member_custom_field_defs").insert(
    toAdd.map((key, i) => ({ organization_id: orgId, key, label: labelFromKey(key), field_type: "text", options: null, required: false, sort_order: base + i })),
  );
  return error ? [] : toAdd;
}

export const ensureFieldsForDesigns = (supabase: SupabaseClient, orgId: string, ...designs: unknown[]) =>
  ensureFieldsForKeys(supabase, orgId, customKeysUsed(...designs));
