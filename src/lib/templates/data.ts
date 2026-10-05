import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, type Branding, type TemplateRow } from "@/lib/templates/schema";
import type { CardData } from "@/components/card-svg";

export const TEMPLATE_COLUMNS =
  "id, organization_id, slug, name, category, orientation, width_mm, height_mm, bleed_mm, safe_zone_mm, photo_width_mm, photo_height_mm, front_design, back_design, version";

/** Branding for an organization: colors, contact line and a short-lived signed logo URL. */
export async function loadBranding(orgId: string): Promise<Branding> {
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("organizations")
    .select("name, logo_path, primary_color, secondary_color, contact_email, contact_phone, address")
    .eq("id", orgId)
    .maybeSingle();
  let logoUrl: string | null = null;
  if (o?.logo_path) {
    const { data } = await supabase.storage.from("org-assets").createSignedUrl(o.logo_path, 60 * 30);
    logoUrl = data?.signedUrl ?? null;
  }
  return {
    orgName: o?.name ?? "Your Organization",
    primary: o?.primary_color ?? DEFAULT_PRIMARY,
    secondary: o?.secondary_color ?? DEFAULT_SECONDARY,
    logoUrl,
    contact: [o?.contact_phone, o?.contact_email, o?.address].filter(Boolean).join(" · "),
  };
}

export async function loadTemplates(orgId: string): Promise<TemplateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("is_active", true)
    .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    .order("sort_order")
    .order("name");
  return (data ?? []) as unknown as TemplateRow[];
}

export async function loadDefaultTemplateId(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("organization_settings").select("default_template_id").eq("organization_id", orgId).maybeSingle();
  return data?.default_template_id ?? null;
}

export const SAMPLE_VALUES: CardData["values"] = {
  full_name: "Amara Johnson",
  first_name: "Amara",
  last_name: "Johnson",
  member_number: "MEM-000123",
  card_number: "CARD-000123",
  role_title: "Member",
  department: "Science",
  class_name: "Grade 10",
  section: "A",
  grade_level: "Grade 10",
  academic_year: "2026/2027",
  student_number: "S-2026-014",
  employee_number: "E-0042",
  phone: "+231 77 000 0000",
  issue_date: "01 Oct 2026",
  expiry_date: "30 Sep 2027",
  "custom:block": "B",
  "custom:house_no": "45",
  "custom:house_code": "BMB-B-45",
};

type MemberLike = Record<string, unknown> & { custom_fields?: unknown };

/** Map a member row (plus branding) to the values a template can bind to. */
export function memberCardValues(m: MemberLike, brand: Branding): CardData["values"] {
  const s = (k: string) => (typeof m[k] === "string" && m[k] ? (m[k] as string) : null);
  const values: CardData["values"] = {
    full_name: s("full_name"),
    first_name: s("first_name"),
    last_name: s("last_name"),
    member_number: s("member_number"),
    card_number: null,
    role_title: s("role_title"),
    department: s("department"),
    class_name: s("class_name"),
    section: s("section"),
    grade_level: s("grade_level"),
    academic_year: s("academic_year"),
    student_number: s("student_number"),
    employee_number: s("employee_number"),
    phone: s("phone"),
    org_name: brand.orgName,
    org_contact: brand.contact,
  };
  const custom = (m.custom_fields ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(custom)) values[`custom:${k}`] = v === null || v === undefined ? null : String(v);
  return values;
}
