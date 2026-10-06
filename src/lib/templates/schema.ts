import * as z from "zod";
import { expandRecipe } from "@/lib/templates/families";

/**
 * Card designs are DATA. A design is a background plus a list of elements positioned in
 * millimetres on the card. One renderer (components/card-svg.tsx) draws any design, so adding
 * templates is a data change. Colors may be plain hex or a brand token resolved at render time.
 */

export const COLOR_TOKENS = [
  "$primary", "$primaryDark", "$primaryLight", "$secondary", "$secondaryDark", "$secondaryLight", "$ink", "$muted", "$paper", "$cream",
] as const;

const color = z.union([z.enum(COLOR_TOKENS), z.string().regex(/^#[0-9a-fA-F]{6}$/)]);
const mm = z.number().min(-20).max(220);

/** Linear gradient. angle 0 = left to right, 90 = top to bottom, 135 = top-left to bottom-right. */
const gradient = z.object({ type: z.literal("linear"), from: color, to: color, angle: z.number().min(0).max(360).default(90) });
export const paint = z.union([color, gradient]);
export type Paint = z.infer<typeof paint>;
export type Gradient = z.infer<typeof gradient>;

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
    /** Draw "LABEL: value" on one line instead of a small label above the value. */
    inline: z.boolean().optional(),
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
  z.object({ ...base, type: z.literal("logo"), x: mm, y: mm, w: mm, h: mm, opacity: z.number().min(0).max(1).optional() }),
  z.object({
    ...base,
    type: z.literal("shape"),
    kind: z.enum(["rect", "circle", "line", "poly"]),
    /** For kind "poly": absolute points in mm. x/y/w/h hold the bounding box. */
    points: z.array(z.tuple([mm, mm])).min(3).max(12).optional(),
    x: mm,
    y: mm,
    w: mm,
    h: mm,
    fill: paint.optional(),
    stroke: color.optional(),
    strokeMm: z.number().min(0).max(3).optional(),
    radius: z.number().min(0).max(30).optional(),
    opacity: z.number().min(0).max(1).optional(),
  }),
]);

export const designSchema = z.object({
  background: paint.default("$paper"),
  elements: z.array(elementSchema).max(60).default([]),
});

export type CardElement = z.infer<typeof elementSchema>;
export type CardDesign = z.infer<typeof designSchema>;

/** Parse a stored design defensively: bad elements are dropped rather than breaking the page. */
export function parseDesign(raw: unknown): CardDesign {
  // Catalog templates are stored as a tiny recipe and expanded here, so previews and print agree.
  if (raw && typeof raw === "object" && "recipe" in raw) {
    const expanded = expandRecipe((raw as { recipe: unknown }).recipe);
    if (expanded) return parseDesign(expanded);
  }
  const result = designSchema.safeParse(raw);
  if (result.success) return result.data;
  const obj = (raw && typeof raw === "object" ? raw : {}) as { background?: unknown; elements?: unknown[] };
  const elements = Array.isArray(obj.elements)
    ? obj.elements.flatMap((e) => {
        const r = elementSchema.safeParse(e);
        return r.success ? [r.data] : [];
      })
    : [];
  const bg = paint.safeParse(obj.background);
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

// ---- color helpers shared by the SVG preview and the PDF renderer -----------------------------

function toRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
/** Blend two #rrggbb colors; t=0 gives a, t=1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Resolve a token or hex to #rrggbb. Dark/light variants are derived from the brand colors. */
export function resolveHex(c: string | undefined, b: Branding): string | undefined {
  switch (c) {
    case "$primary": return b.primary;
    case "$primaryDark": return mixHex(b.primary, "#000000", 0.35);
    case "$primaryLight": return mixHex(b.primary, "#ffffff", 0.82);
    case "$secondary": return b.secondary;
    case "$secondaryDark": return mixHex(b.secondary, "#000000", 0.3);
    case "$secondaryLight": return mixHex(b.secondary, "#ffffff", 0.8);
    case "$ink": return "#0f172a";
    case "$muted": return "#64748b";
    case "$paper": return "#ffffff";
    case "$cream": return "#fbf6e9";
    default: return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : undefined;
  }
}

/** Gradient start/end points (design coordinates, y down) for a box, like CSS linear-gradient. */
export function gradientLine(angleDeg: number, x: number, y: number, w: number, h: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2, cy = y + h / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

/** "gradient" if any gradient is used, "plain" if nothing is filled (white card with lines only), else "solid". */
export function styleOf(design: unknown): "gradient" | "plain" | "solid" {
  const d = parseDesign(design);
  const bgGradient = typeof d.background === "object";
  const shapes = d.elements.filter((e): e is Extract<CardElement, { type: "shape" }> => e.type === "shape");
  if (bgGradient || shapes.some((e) => typeof e.fill === "object")) return "gradient";
  const bgSolid = typeof d.background === "string" && !["$paper", "#ffffff", "$cream"].includes(d.background);
  const filled = shapes.some((e) => e.kind !== "line" && e.fill && e.fill !== "$paper");
  return !bgSolid && !filled ? "plain" : "solid";
}

/** Every `custom:<key>` field a design reads. */
export function customKeysUsed(...designs: unknown[]): string[] {
  const keys = new Set<string>();
  for (const raw of designs) for (const e of parseDesign(raw).elements) if (e.type === "field" && e.binding.startsWith("custom:")) keys.add(e.binding.slice(7));
  return [...keys];
}
