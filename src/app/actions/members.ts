"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/auth";
import { MEMBER_STATUSES, type CustomFieldDef } from "@/lib/member-fields";
import type { ActionState } from "@/lib/action-state";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .default(null);

const baseSchema = z.object({
  first_name: z.string().trim().min(1, "Enter a first name.").max(80),
  middle_name: optional(80),
  last_name: z.string().trim().min(1, "Enter a last name.").max(80),
  date_of_birth: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date()), {
      message: "Enter a valid date of birth in the past.",
    })
    .nullable()
    .default(null),
  gender: z
    .enum(["", "female", "male", "other"])
    .transform((v) => (v === "" ? null : v))
    .default(null),
  status: z.enum(MEMBER_STATUSES).default("active"),
  role_title: optional(120),
  department: optional(120),
  class_name: optional(80),
  section: optional(80),
  grade_level: optional(80),
  academic_year: optional(40),
  student_number: optional(60),
  employee_number: optional(60),
  phone: optional(40),
  address: optional(300),
});

/** Validate org-defined custom fields against their definitions. Unknown keys are ignored. */
function readCustomFields(
  formData: FormData,
  defs: CustomFieldDef[],
): { values: Record<string, string | number | boolean>; errors: Record<string, string[]> } {
  const values: Record<string, string | number | boolean> = {};
  const errors: Record<string, string[]> = {};
  for (const def of defs) {
    const name = `cf_${def.key}`;
    const raw = formData.get(name);
    const text = typeof raw === "string" ? raw.trim() : "";
    if (def.field_type === "boolean") {
      values[def.key] = raw === "on";
      continue;
    }
    if (text === "") {
      if (def.required) errors[name] = [`${def.label} is required.`];
      continue;
    }
    if (def.field_type === "number") {
      const n = Number(text);
      if (!Number.isFinite(n)) errors[name] = [`${def.label} must be a number.`];
      else values[def.key] = n;
    } else if (def.field_type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) errors[name] = [`${def.label} must be a date.`];
      else values[def.key] = text;
    } else if (def.field_type === "select") {
      if (!def.options?.includes(text)) errors[name] = [`Choose a valid ${def.label}.`];
      else values[def.key] = text;
    } else {
      if (text.length > 300) errors[name] = [`${def.label} is too long.`];
      else values[def.key] = text;
    }
  }
  return { values, errors };
}

async function loadDefs(orgId: string): Promise<CustomFieldDef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_custom_field_defs")
    .select("id, key, label, field_type, options, required, sort_order")
    .eq("organization_id", orgId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as CustomFieldDef[];
}

export async function saveMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // The organization always comes from the verified session, never from the form.
  const { org, user } = await requireOrg();
  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" && idRaw !== "" ? z.uuid().safeParse(idRaw) : null;
  if (id && !id.success) return { error: "That member could not be found." };

  const parsed = baseSchema.safeParse(Object.fromEntries(formData));
  const defs = await loadDefs(org.id);
  const custom = readCustomFields(formData, defs);
  if (!parsed.success || Object.keys(custom.errors).length > 0) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
        ...custom.errors,
      },
      error: "Please fix the highlighted fields.",
    };
  }

  const supabase = await createClient();
  const fields = { ...parsed.data, custom_fields: custom.values };
  let newId: string | null = null;

  if (id?.success) {
    const { data, error } = await supabase
      .from("members")
      .update(fields)
      .eq("id", id.data)
      .eq("organization_id", org.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "Could not save changes. Please try again." };
  } else {
    const { data: number, error: numError } = await supabase.rpc("next_member_number", { p_org: org.id });
    if (numError || !number) return { error: "Could not allocate a member number. Please try again." };
    const { data: created, error } = await supabase
      .from("members")
      .insert({ ...fields, organization_id: org.id, member_number: number as string, created_by: user.id })
      .select("id")
      .single();
    if (error || !created) return { error: "Could not add the member. Please try again." };
    newId = created.id;
  }

  revalidatePath("/app/members");
  revalidatePath("/app");
  // A new member goes straight to their page so a photo can be added.
  redirect(newId ? `/app/members/${newId}?added=1` : "/app/members");
}

/** Archive instead of deleting, so issued cards keep a valid history. */
export async function setMemberStatus(id: string, status: (typeof MEMBER_STATUSES)[number]) {
  const { org } = await requireOrg();
  if (!z.uuid().safeParse(id).success || !MEMBER_STATUSES.includes(status)) return;
  const supabase = await createClient();
  await supabase.from("members").update({ status }).eq("id", id).eq("organization_id", org.id);
  revalidatePath("/app/members");
  revalidatePath("/app");
  redirect("/app/members");
}
