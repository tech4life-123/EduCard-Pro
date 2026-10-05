"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasRole, requireOrg } from "@/lib/auth";
import { keyFromLabel } from "@/lib/member-fields";
import type { ActionState } from "@/lib/action-state";

const schema = z.object({
  label: z.string().trim().min(2, "Enter a label.").max(60),
  field_type: z.enum(["text", "number", "date", "boolean", "select"]),
  options: z.string().trim().max(600).optional().default(""),
  required: z.string().optional(),
});

export async function addCustomField(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return { error: "Only administrators can change custom fields." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  let options: string[] | null = null;
  if (parsed.data.field_type === "select") {
    options = [...new Set(parsed.data.options.split(",").map((o) => o.trim()).filter(Boolean))].slice(0, 30);
    if (options.length < 2) return { fieldErrors: { options: ["Enter at least two choices, separated by commas."] } };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("member_custom_field_defs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);
  if ((count ?? 0) >= 30) return { error: "You can have at most 30 custom fields." };

  const { error } = await supabase.from("member_custom_field_defs").insert({
    organization_id: org.id,
    key: keyFromLabel(parsed.data.label),
    label: parsed.data.label,
    field_type: parsed.data.field_type,
    options,
    required: parsed.data.required === "on" && parsed.data.field_type !== "boolean",
    sort_order: count ?? 0,
  });
  if (error) {
    if (error.code === "23505") return { fieldErrors: { label: ["You already have a field with that name."] } };
    return { error: "Could not add the field. Please try again." };
  }
  revalidatePath("/app/settings/fields");
  return { message: "Field added." };
}

export async function deleteCustomField(id: string) {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin") || !z.uuid().safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("member_custom_field_defs").delete().eq("id", id).eq("organization_id", org.id);
  revalidatePath("/app/settings/fields");
}
