import * as z from "zod";

/**
 * Card designs are DATA. A design is a background plus a list of elements positioned in
 * millimetres on the card. One renderer (components/card-svg.tsx) draws any design, so adding
 * templates is a data change. Colors may be plain hex or a brand token resolved at render time.
 */

export const COLOR_TOKENS = ["$primary", "$secondary", "$ink", "$muted", "$paper"] as const;

const color = z.union([z.enum(COLOR_TOKENS), z.string().regex(/^#[0-9a-fA-F]{6}$/)]);
const mm = z.number().min(-20).max(220);

/** Values a `field` element can show. `custom:<key>` binds an organization custom field. */
export const FIELD_BINDINGS = [
  "full_name",
  "first_name",
  "last_name",
  "member_number",
  "card_number",
  "role_title",
  "department",
  "class_name",
  "section",
  "grade_level",
  "academic_year",
  "student_number",
  "employee_number",
  "phone",
  "org_name",
  "org_contact",
  "issue_date",
  "expiry_date",
] as const;

export const FIELD_LABELS: Record<(typeof FIELD_BINDINGS)[number], string> = {
  full_name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  member_number: "Member number",
  card_number: "Card number",
  role_title: "Role / title",
  department: "Department",
  class_name: "Class",
  section: "Section",
  grade_level: "Grade / level",
  academic_year: "Academic year",
  student_number: "Student number",
  employee_number: "Employee number",
  phone: "Phone",
  org_name: "Organization name",
  org_contact: "Organization contact",
  issue_date: "Issue date",
  expiry_date: "Expiry date",
};

const base = {
  id: z.string().min(1).max(40),
  /** Hidden elements are kept in the design but not drawn (this is how orgs switch things off). */
  hidden: z.boolean().optional(),
  /** Elements an organization may not hide or alter (QR zone, photo, etc.). */
  locked: z.boolean().optional(),
};

const textStyle = {
  fontPt: z.number().min(3).max(40).default(8),
  weight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).default(400),
  color: color.default("$ink"),
  align: z.enum(["start", "middle", "end"]).default("start"),
  opacity: z.number().min(0).max(1).optional(),
  uppercase: z.boolean().optional(),
  letterSpacing: z.number().min(0).max(2).optional(),
};

export const elementSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("text"), x: mm, y: mm, w: mm, h: mm, text: z.string().max(400), lines: z.number().int().min(1).max(6).optional(), ...textStyle }),
  z.object({
    ...base,
    type: z.literal("field"),
    x: mm,
    y: mm,
    w: mm,
    h: mm,
    binding: z.union([z.enum(FIELD_BINDINGS), z.string().regex(/^custom:[a-z][a-z0-9_]{0,40}$/)]),
    label: z.string().max(40).optional(),
    ...textStyle,
  }),
  z.object({
    ...base,
    type: z.literal("photo"),
    x: mm,
    y: mm,
    w: mm,
    h: mm,
    shape: z.enum(["rect", "rounded", "circle"]).default("rect"),
    stroke: color.optional(),
    strokeMm: z.number().min(0).max(2).optional(),
  }),
  z.object({ ...base, type: z.literal("qr"), x: mm, y: mm, size: z.number().min(10).max(40) }),
  z.object({ ...base, type: z.literal("logo"), x: mm, y: mm, w: mm, h: mm }),
  z.object({
    ...base,
    type: z.literal("shape"),
    kind: z.enum(["rect", "circle", "line"]),
    x: mm,
    y: mm,
    w: mm,
    h: mm,
    fill: color.optional(),
    stroke: color.optional(),
    strokeMm: z.number().min(0).max(3).optional(),
    radius: z.number().min(0).max(30).optional(),
    opacity: z.number().min(0).max(1).optional(),
  }),
]);

export const designSchema = z.object({
  background: color.default("$paper"),
  elements: z.array(elementSchema).max(60).default([]),
});

export type CardElement = z.infer<typeof elementSchema>;
export type CardDesign = z.infer<typeof designSchema>;

/** Parse a stored design defensively: bad elements are dropped rather than breaking the page. */
export function parseDesign(raw: unknown): CardDesign {
  const result = designSchema.safeParse(raw);
  if (result.success) return result.data;
  const obj = (raw && typeof raw === "object" ? raw : {}) as { background?: unknown; elements?: unknown[] };
  const elements = Array.isArray(obj.elements)
    ? obj.elements.flatMap((e) => {
        const r = elementSchema.safeParse(e);
        return r.success ? [r.data] : [];
      })
    : [];
  const bg = color.safeParse(obj.background);
  return { background: bg.success ? bg.data : "$paper", elements };
}

export type TemplateRow = {
  id: string;
  organization_id: string | null;
  slug: string;
  name: string;
  category: string;
  orientation: "landscape" | "portrait";
  width_mm: number;
  height_mm: number;
  bleed_mm: number;
  safe_zone_mm: number;
  photo_width_mm: number;
  photo_height_mm: number;
  front_design: unknown;
  back_design: unknown;
  version: number;
};

export type Branding = {
  orgName: string;
  primary: string;
  secondary: string;
  logoUrl: string | null;
  contact: string;
};

export const DEFAULT_PRIMARY = "#1e3a8a";
export const DEFAULT_SECONDARY = "#f59e0b";
