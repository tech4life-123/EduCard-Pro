"use server";

import * as z from "zod";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, hasRole } from "@/lib/auth";
import { parseDesign } from "@/lib/templates/schema";
import { TEMPLATE_COLUMNS } from "@/lib/templates/data";
import { catalogCustomKeys, ensureFieldsForDesigns, ensureFieldsForKeys } from "@/lib/templates/template-fields";
import type { ActionState } from "@/lib/action-state";

export async function setDefaultTemplate(templateId: string): Promise<void> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin") || !z.uuid().safeParse(templateId).success) return;
  const supabase = await createClient();
  // The template must be a global one or this organization's own (RLS also enforces visibility).
  const { data: t } = await supabase
    .from("card_templates")
    .select("id")
    .eq("id", templateId)
    .eq("is_active", true)
    .or(`organization_id.is.null,organization_id.eq.${org.id}`)
    .maybeSingle();
  if (!t) return;
  await supabase.from("organization_settings").update({ default_template_id: t.id }).eq("organization_id", org.id);
  // Make sure the member form has every custom field this design prints.
  const { data: full } = await supabase.from("card_templates").select("front_design, back_design").eq("id", t.id).maybeSingle();
  if (full) await ensureFieldsForDesigns(supabase, org.id, full.front_design, full.back_design);
  revalidatePath("/app/settings/fields");
  revalidatePath("/app/templates");
  revalidatePath(`/app/templates/${t.id}`);
  revalidatePath("/app/members", "layout");
}

const customizeSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(80),
  subtitle: z.string().trim().max(60).default(""),
  back_text: z.string().trim().max(300).default(""),
  show_logo: z.string().optional(),
});

/** Copy a template into the organization with a small, safe set of changes. The design is rebuilt on the server. */
export async function customizeTemplate(baseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return { error: "Only admins can customize templates." };
  if (!z.uuid().safeParse(baseId).success) return { error: "That template could not be found." };
  const parsed = customizeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };

  const supabase = await createClient();
  const { data: base } = await supabase
    .from("card_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("id", baseId)
    .or(`organization_id.is.null,organization_id.eq.${org.id}`)
    .maybeSingle();
  if (!base) return { error: "That template could not be found." };

  const edit = (design: unknown, apply: (el: ReturnType<typeof parseDesign>["elements"][number]) => void) => {
    const d = parseDesign(design);
    d.elements.forEach(apply);
    return d;
  };
  const front = edit(base.front_design, (el) => {
    if (el.locked) return;
    if (el.id === "subtitle" && el.type === "text" && parsed.data.subtitle) el.text = parsed.data.subtitle;
    if (el.type === "logo") el.hidden = parsed.data.show_logo !== "on";
  });
  const back = edit(base.back_design, (el) => {
    if (el.locked) return;
    if (el.id === "back_text" && el.type === "text" && parsed.data.back_text) el.text = parsed.data.back_text;
  });

  const slug = `${base.slug.replace(/-[0-9a-f]{6}$/, "")}-${randomBytes(3).toString("hex")}`;
  const { data: created, error } = await supabase
    .from("card_templates")
    .insert({
      organization_id: org.id,
      slug,
      name: parsed.data.name,
      category: base.category,
      orientation: base.orientation,
      width_mm: base.width_mm,
      height_mm: base.height_mm,
      bleed_mm: base.bleed_mm,
      safe_zone_mm: base.safe_zone_mm,
      photo_width_mm: base.photo_width_mm,
      photo_height_mm: base.photo_height_mm,
      front_design: front,
      back_design: back,
      sort_order: 100,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "Could not save the template. Please try again." };
  await ensureFieldsForDesigns(supabase, org.id, front, back);
  revalidatePath("/app/templates");
  redirect(`/app/templates/${created.id}`);
}

/** Create the custom fields one template needs (admin only). */
export async function addTemplateFields(templateId: string): Promise<void> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin") || !z.uuid().safeParse(templateId).success) return;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("card_templates")
    .select("front_design, back_design")
    .eq("id", templateId)
    .or(`organization_id.is.null,organization_id.eq.${org.id}`)
    .maybeSingle();
  if (!t) return;
  await ensureFieldsForDesigns(supabase, org.id, t.front_design, t.back_design);
  revalidatePath(`/app/templates/${templateId}`);
  revalidatePath("/app/settings/fields");
  revalidatePath("/app/members", "layout");
}

/** Create every custom field that any built-in template uses, in one click (admin only). */
export async function addAllTemplateFields(): Promise<void> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return;
  await ensureFieldsForKeys(await createClient(), org.id, catalogCustomKeys());
  revalidatePath("/app/templates", "layout");
  revalidatePath("/app/settings/fields");
  revalidatePath("/app/members", "layout");
}
