"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, hasRole } from "@/lib/auth";
import { PUBLIC_FIELD_KEYS } from "@/lib/verify-settings";
import type { ActionState } from "@/lib/action-state";

const wording = z.string().trim().max(300, "Use at most 300 characters.");

export async function saveVerificationSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return { error: "Only admins can change these settings." };
  const w = wording.safeParse(formData.get("wording") ?? "");
  if (!w.success) return { fieldErrors: { wording: [w.error.issues[0].message] }, error: "Please fix the highlighted fields." };
  // Only allowlisted keys are ever stored, whatever the form sends.
  const fields = formData.getAll("fields").filter((f): f is string => typeof f === "string" && PUBLIC_FIELD_KEYS.includes(f));
  const supabase = await createClient();
  const [a, b] = await Promise.all([
    supabase.from("organization_settings").update({ public_verify_fields: [...new Set(fields)] }).eq("organization_id", org.id),
    supabase.from("organizations").update({ verification_wording: w.data === "" ? null : w.data }).eq("id", org.id),
  ]);
  if (a.error || b.error) return { error: "Could not save. Please try again." };
  revalidatePath("/app/settings/verification");
  return { message: "Saved." };
}
