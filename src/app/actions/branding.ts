"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrg, hasRole } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a color like #1e3a8a.");
const opt = (n: number) => z.string().trim().max(n).transform((v) => (v === "" ? null : v));

const schema = z.object({
  primary_color: hex,
  secondary_color: hex,
  contact_email: opt(120).refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email."),
  contact_phone: opt(40),
  address: opt(200),
});

export async function saveBranding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return { error: "Only admins can change branding." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update(parsed.data).eq("id", org.id);
  if (error) return { error: "Could not save branding. Please try again." };
  revalidatePath("/app", "layout");
  return { message: "Branding saved." };
}

/** Called after the browser uploaded the logo. Path must be inside this organization's folder. */
export async function recordLogo(path: string | null): Promise<ActionState> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return { error: "Only admins can change the logo." };
  if (path !== null && !new RegExp(`^${org.id}/logo/[0-9a-f-]{36}\\.(png|jpg|webp)$`).test(path)) return { error: "Invalid logo upload." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("organizations").select("logo_path").eq("id", org.id).maybeSingle();
  const { error } = await supabase.from("organizations").update({ logo_path: path }).eq("id", org.id);
  if (error) return { error: "Could not save the logo." };
  if (cur?.logo_path && cur.logo_path !== path) {
    try {
      await createAdminClient().storage.from("org-assets").remove([cur.logo_path]);
    } catch {}
  }
  revalidatePath("/app", "layout");
  return { message: path ? "Logo saved." : "Logo removed." };
}
