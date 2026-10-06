/**
 * Template catalog. Each catalog template is stored in the database as a tiny "recipe"
 * ({ recipe: { kind, family, cat, variant } }) and expanded here into a full design (a list of
 * positioned elements in millimetres). Colors use brand tokens, so every template follows the
 * organization's own colors; gradients are derived from them.
 */

type El = Record<string, unknown>;
export type Design = { background: unknown; elements: El[] };
export type Recipe = { kind: "front" | "back"; family: string; cat: string; variant?: string };

const W = 85.6, H = 53.98, PW = 53.98, PH = 85.6;
const G = (from: string, to: string, angle = 90) => ({ type: "linear", from, to, angle });

const T = (id: string, x: number, y: number, w: number, h: number, text: string, o: El = {}): El => ({ id, type: "text", x, y, w, h, text, fontPt: 8, weight: 400, color: "$ink", align: "start", ...o });
const F = (id: string, binding: string, x: number, y: number, w: number, h: number, label: string | undefined, o: El = {}): El => ({ id, type: "field", binding, x, y, w, h, label, fontPt: 8, weight: 600, color: "$ink", align: "start", ...o });
const P = (x: number, y: number, w: number, h: number, o: El = {}): El => ({ id: "photo", type: "photo", x, y, w, h, shape: "rect", locked: true, ...o });
const Q = (x: number, y: number, size: number): El => ({ id: "qr", type: "qr", x, y, size, locked: true });
const L = (x: number, y: number, w: number, h: number): El => ({ id: "logo", type: "logo", x, y, w, h });
const S = (id: string, kind: string, x: number, y: number, w: number, h: number, o: El = {}): El => ({ id, type: "shape", kind, x, y, w, h, ...o });

const WORDING = "This card is the property of the issuing organization and must be shown on request. If found, please return it using the contact below.";

type Fld = { b: string; l: string };
type Cat = { name: string; subtitle: string; short: string; f: [Fld, Fld, Fld, Fld] };
const EXP: Fld = { b: "expiry_date", l: "Valid until" };

export const CATEGORIES: Record<string, Cat> = {
  school: { name: "School", subtitle: "STUDENT IDENTIFICATION CARD", short: "STUDENT ID", f: [{ b: "member_number", l: "ID No." }, { b: "class_name", l: "Class" }, { b: "academic_year", l: "Academic year" }, EXP] },
  university: { name: "University", subtitle: "STUDENT ID CARD", short: "STUDENT ID", f: [{ b: "student_number", l: "Matric No." }, { b: "department", l: "Faculty" }, { b: "grade_level", l: "Level" }, EXP] },
  church: { name: "Church", subtitle: "MEMBERSHIP CARD", short: "MEMBER ID", f: [{ b: "member_number", l: "Member No." }, { b: "department", l: "Branch" }, { b: "role_title", l: "Ministry" }, { b: "issue_date", l: "Member since" }] },
  community: { name: "Community", subtitle: "COMMUNITY MEMBER", short: "MEMBER ID", f: [{ b: "member_number", l: "ID No" }, { b: "custom:block", l: "Block" }, { b: "custom:house_no", l: "House No" }, { b: "custom:house_code", l: "House Code" }] },
  business: { name: "Business", subtitle: "EMPLOYEE ID", short: "EMPLOYEE ID", f: [{ b: "employee_number", l: "Employee No." }, { b: "role_title", l: "Position" }, { b: "department", l: "Department" }, EXP] },
  healthcare: { name: "Healthcare", subtitle: "STAFF IDENTIFICATION", short: "STAFF ID", f: [{ b: "employee_number", l: "Staff No." }, { b: "role_title", l: "Role" }, { b: "department", l: "Department" }, EXP] },
  ngo: { name: "NGO / Non-profit", subtitle: "STAFF / VOLUNTEER ID", short: "STAFF / VOLUNTEER", f: [{ b: "member_number", l: "ID No." }, { b: "role_title", l: "Position" }, { b: "department", l: "Programme" }, EXP] },
  government: { name: "Government", subtitle: "OFFICIAL IDENTIFICATION", short: "OFFICIAL ID", f: [{ b: "employee_number", l: "ID No." }, { b: "role_title", l: "Title" }, { b: "department", l: "Agency" }, EXP] },
  sports: { name: "Sports club", subtitle: "CLUB MEMBER", short: "CLUB MEMBER", f: [{ b: "member_number", l: "Member No." }, { b: "role_title", l: "Position" }, { b: "department", l: "Team" }, { b: "academic_year", l: "Season" }] },
  event: { name: "Event / Access pass", subtitle: "ACCESS PASS", short: "ACCESS PASS", f: [{ b: "member_number", l: "Pass ID" }, { b: "role_title", l: "Pass type" }, { b: "department", l: "Access" }, EXP] },
};

const grid = (c: Cat, x1: number, x2: number, y1: number, y2: number, w: number, color = "$ink"): El[] => [
  F("f0", c.f[0].b, x1, y1, w, 7, c.f[0].l, { color }),
  F("f1", c.f[1].b, x2, y1, w, 7, c.f[1].l, { color }),
  F("f2", c.f[2].b, x1, y2, w, 7, c.f[2].l, { color }),
  F("f3", c.f[3].b, x2, y2, w, 7, c.f[3].l, { color }),
];

// ---------------------------------------------------------------------------------------------
// Landscape fronts (85.6 x 53.98)
// ---------------------------------------------------------------------------------------------
function banner(c: Cat, v: string): Design {
  const g = v === "gradient";
  return {
    background: "$paper",
    elements: [
      S("header", "rect", 0, 0, W, 13, { fill: g ? G("$primary", "$primaryDark", 0) : "$primary" }),
      L(3, 2, 9, 9),
      F("org", "org_name", 14, 3.2, 68, 4.5, undefined, { fontPt: 9, weight: 700, color: "$paper" }),
      T("subtitle", 14, 8, 68, 3, c.subtitle, { fontPt: 5.5, weight: 600, color: "$paper", opacity: 0.85, letterSpacing: 0.12 }),
      P(4, 16.5, 22, 28.5, { stroke: "$primary", strokeMm: 0.5 }),
      F("name", "full_name", 30, 17, 52, 7, undefined, { fontPt: 11, weight: 700 }),
      ...grid(c, 30, 58, 26, 35, 24).map((e, i) => (i % 2 === 0 ? { ...e, w: 26 } : e)),
      S("accent", "rect", 0, 51.5, W, 2.48, { fill: g ? G("$secondary", "$secondaryDark", 0) : "$secondary" }),
    ],
  };
}

function plainRight(c: Cat): Design {
  // No background at all: white card, thin rules, photo on the right.
  return {
    background: "$paper",
    elements: [
      L(4, 4, 9, 9),
      F("org", "org_name", 15, 5, 62, 4.5, undefined, { fontPt: 9, weight: 700, color: "$primary" }),
      T("subtitle", 15, 9.6, 62, 3, c.subtitle, { fontPt: 5.5, weight: 600, color: "$muted", letterSpacing: 0.12 }),
      S("rule", "line", 4, 15.5, 77.6, 0, { stroke: "$primary", strokeMm: 0.4 }),
      F("name", "full_name", 4, 18.5, 52, 7, undefined, { fontPt: 11.5, weight: 700 }),
      ...grid(c, 4, 31, 28.5, 38.5, 25),
      P(58, 18, 22, 28.5, { shape: "rounded", stroke: "$primary", strokeMm: 0.4 }),
      S("rule2", "line", 4, 50.4, 77.6, 0, { stroke: "$secondary", strokeMm: 0.6 }),
    ],
  };
}

function plainLeft(c: Cat): Design {
  // No background: round photo, text right, small QR front-right.
  return {
    background: "$paper",
    elements: [
      P(5, 6, 26, 26, { shape: "circle", stroke: "$primary", strokeMm: 0.7 }),
      L(13, 36, 10, 10),
      F("org", "org_name", 36, 4, 46, 4, undefined, { fontPt: 7, weight: 700, color: "$primary" }),
      T("subtitle", 36, 8, 46, 3, c.subtitle, { fontPt: 4.8, weight: 600, color: "$muted", letterSpacing: 0.1 }),
      F("name", "full_name", 36, 12.5, 46, 7, undefined, { fontPt: 11, weight: 700 }),
      S("rule", "line", 36, 21.5, 46, 0, { stroke: "$secondary", strokeMm: 0.5 }),
      F("f0", c.f[0].b, 36, 23.5, 24, 7, c.f[0].l),
      F("f1", c.f[1].b, 36, 32.5, 24, 7, c.f[1].l),
      F("f2", c.f[2].b, 36, 41.5, 24, 7, c.f[2].l),
      Q(63, 29, 18),
      T("qr_caption", 61, 47.5, 22, 3, "Scan to verify", { fontPt: 4.5, align: "middle", color: "$muted", weight: 600 }),
    ],
  };
}

function sidebar(c: Cat, v: string): Design {
  const g = v === "gradient";
  return {
    background: "#fffaf0",
    elements: [
      S("bar", "rect", 0, 0, 7, H, { fill: g ? G("$primary", "$primaryDark", 90) : "$primary" }),
      S("bar_accent", "rect", 7, 0, 1.2, H, { fill: "$secondary" }),
      L(12, 3.5, 9, 9),
      F("org", "org_name", 23, 4.5, 58, 4.5, undefined, { fontPt: 9, weight: 700, color: "$primary" }),
      T("subtitle", 23, 9.2, 58, 3, c.subtitle, { fontPt: 5.5, weight: 600, color: "$muted", letterSpacing: 0.15 }),
      P(12, 17, 22, 28.5, { shape: "rounded", stroke: "$secondary", strokeMm: 0.5 }),
      F("name", "full_name", 38, 17.5, 44, 7, undefined, { fontPt: 11, weight: 700 }),
      F("f0", c.f[0].b, 38, 27, 22, 7, c.f[0].l),
      F("f1", c.f[1].b, 62, 27, 20, 7, c.f[1].l),
      F("f2", c.f[2].b, 38, 36, 22, 7, c.f[2].l),
      F("f3", c.f[3].b, 62, 36, 20, 7, c.f[3].l),
    ],
  };
}

function blobs(c: Cat, v: string): Design {
  const g = v === "gradient";
  return {
    background: "$paper",
    elements: [
      S("blob1", "circle", 58, -22, 55, 55, { fill: g ? G("$primary", "$primaryDark", 135) : "$primary", opacity: 0.95 }),
      S("blob2", "circle", 70, 36, 30, 30, { fill: g ? G("$secondary", "$secondaryDark", 135) : "$secondary", opacity: 0.9 }),
      L(4, 4, 10, 10),
      F("org", "org_name", 16, 6, 44, 4.5, undefined, { fontPt: 9, weight: 700, color: "$primary" }),
      T("subtitle", 16, 10.5, 44, 3, c.subtitle, { fontPt: 5.5, weight: 600, color: "$muted", letterSpacing: 0.15 }),
      P(56, 8, 24, 24, { shape: "circle", stroke: "$paper", strokeMm: 1 }),
      F("name", "full_name", 4, 20, 50, 7, undefined, { fontPt: 12, weight: 700 }),
      F("f1", c.f[1].b, 4, 29.5, 50, 7, c.f[1].l),
      F("f0", c.f[0].b, 4, 39, 28, 7, c.f[0].l),
      F("f3", c.f[3].b, 34, 39, 22, 7, c.f[3].l),
    ],
  };
}

function split(c: Cat): Design {
  return {
    background: "$paper",
    elements: [
      S("panel", "rect", 0, 0, 30, H, { fill: G("$primary", "$primaryDark", 90) }),
      L(10, 4, 10, 10),
      P(4, 17, 22, 28.5, { stroke: "$paper", strokeMm: 0.6 }),
      F("org", "org_name", 34, 5, 48, 4.5, undefined, { fontPt: 9, weight: 700, color: "$primary" }),
      T("subtitle", 34, 9.8, 48, 3, c.subtitle, { fontPt: 5.5, weight: 600, color: "$muted", letterSpacing: 0.12 }),
      F("name", "full_name", 34, 16, 48, 7, undefined, { fontPt: 11, weight: 700 }),
      ...grid(c, 34, 60, 26, 36, 23),
      S("accent", "rect", 30, 51.5, W - 30, 2.48, { fill: "$secondary" }),
    ],
  };
}

function hero(c: Cat): Design {
  return {
    background: G("$primary", "$primaryDark", 135),
    elements: [
      L(4, 3.5, 9, 9),
      F("org", "org_name", 15, 4.8, 66, 4.5, undefined, { fontPt: 9, weight: 700, color: "$paper" }),
      T("subtitle", 15, 9.2, 66, 3, c.subtitle, { fontPt: 5, weight: 600, color: "$secondary", letterSpacing: 0.15 }),
      S("panel", "rect", 3, 15, 79.6, 35.5, { fill: "$paper", radius: 2 }),
      P(6, 18, 22, 28.5, { stroke: "$primary", strokeMm: 0.4 }),
      F("name", "full_name", 31, 18.5, 49, 7, undefined, { fontPt: 11, weight: 700 }),
      F("f1", c.f[1].b, 31, 27.5, 49, 7, c.f[1].l),
      F("f2", c.f[2].b, 31, 36.5, 24, 7, c.f[2].l),
      F("f0", c.f[0].b, 57, 36.5, 24, 7, c.f[0].l),
      S("accent", "rect", 3, 50.5, 79.6, 1.2, { fill: G("$secondary", "$secondaryDark", 0) }),
    ],
  };
}

function diagonal(c: Cat): Design {
  return {
    background: "$paper",
    elements: [
      S("stripe", "poly", 50, 0, 35.6, H, { points: [[50, 0], [W, 0], [W, H], [72, H]], fill: G("$primary", "$secondary", 135) }),
      L(4, 4, 9, 9),
      F("org", "org_name", 15, 5, 40, 4.5, undefined, { fontPt: 9, weight: 700, color: "$primary" }),
      T("subtitle", 15, 9.6, 40, 3, c.subtitle, { fontPt: 5.5, weight: 600, color: "$muted", letterSpacing: 0.12 }),
      P(58, 12, 22, 28.5, { shape: "rounded", stroke: "$paper", strokeMm: 1 }),
      F("name", "full_name", 4, 19, 46, 7, undefined, { fontPt: 11.5, weight: 700 }),
      ...grid(c, 4, 28, 29, 39, 22),
    ],
  };
}

function dark(c: Cat): Design {
  return {
    background: G("$ink", "$primaryDark", 135),
    elements: [
      L(4, 3.5, 9, 9),
      F("org", "org_name", 15, 4.8, 66, 4.5, undefined, { fontPt: 9, weight: 700, color: "$paper" }),
      T("subtitle", 15, 9.2, 66, 3, c.subtitle, { fontPt: 5, weight: 600, color: "$secondary", letterSpacing: 0.18 }),
      P(5, 16, 24, 31, { shape: "rounded", stroke: "$secondary", strokeMm: 0.7 }),
      F("name", "full_name", 33, 16.5, 49, 7, undefined, { fontPt: 11, weight: 700, color: "$paper" }),
      S("rule", "line", 33, 25, 48, 0, { stroke: "$secondary", strokeMm: 0.4 }),
      ...grid(c, 33, 59, 27, 37, 23, "$paper"),
    ],
  };
}

/** Cream background, gold lines, framed photo, inline details and QR on the front. */
function heritage(c: Cat): Design {
  return {
    background: "$cream",
    elements: [
      S("border", "rect", 1.4, 1.4, W - 2.8, H - 2.8, { radius: 2.5, stroke: "$secondary", strokeMm: 0.3 }),
      S("header", "rect", 3, 3, W - 6, 15, { radius: 1.5, fill: G("$primary", "$primaryDark", 90) }),
      S("line1", "line", 3, 18.7, W - 6, 0, { stroke: "$secondary", strokeMm: 0.5 }),
      S("line2", "line", 3, 19.9, W - 6, 0, { stroke: "$secondary", strokeMm: 0.2 }),
      S("seal", "circle", 5, 4.2, 12.6, 12.6, { fill: "$paper", stroke: "$secondary", strokeMm: 0.6 }),
      L(6.3, 5.5, 10, 10),
      F("org", "org_name", 20, 5.2, 61, 6, undefined, { fontPt: 11, weight: 800, color: "$paper", uppercase: true }),
      T("subtitle", 20, 11.4, 60, 5, c.subtitle.split(" ")[0] === "COMMUNITY" ? "COMMUNITY" : c.subtitle, { fontPt: 9, weight: 700, color: "$secondary", letterSpacing: 0.2 }),
      S("frame", "rect", 4.2, 21.7, 24.6, 28.6, { stroke: "$secondary", strokeMm: 0.3 }),
      P(5.5, 22.9, 22, 26.2, { stroke: "$primary", strokeMm: 0.4 }),
      F("name", "full_name", 32, 21.6, 50, 4.5, "Name", { inline: true, fontPt: 8.5, weight: 800 }),
      S("ribbon", "rect", 32, 27.4, 32, 4.8, { radius: 0.8, fill: G("$secondary", "$secondaryDark", 0) }),
      F("role", "role_title", 32, 27.4, 32, 4.8, undefined, { fontPt: 6.5, weight: 800, color: "$primaryDark", align: "middle", uppercase: true }),
      F("f0", c.f[0].b, 32, 34, 32, 3.8, c.f[0].l.toUpperCase(), { inline: true, fontPt: 6.2, weight: 700 }),
      F("f1", c.f[1].b, 32, 38.3, 32, 3.8, c.f[1].l.toUpperCase(), { inline: true, fontPt: 6.2, weight: 700 }),
      F("f2", c.f[2].b, 32, 42.6, 32, 3.8, c.f[2].l.toUpperCase(), { inline: true, fontPt: 6.2, weight: 700 }),
      F("f3", c.f[3].b, 32, 46.9, 32, 3.8, c.f[3].l.toUpperCase(), { inline: true, fontPt: 6.2, weight: 700 }),
      Q(66, 28.5, 16.5),
      T("qr_caption", 62, 45.6, 24.5, 3, "VERIFIED MEMBER", { fontPt: 4.2, align: "middle", color: "$muted", weight: 700, letterSpacing: 0.1 }),
      S("strip", "rect", 3, 50.4, W - 6, 1.1, { fill: G("$secondary", "$secondaryDark", 0) }),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Portrait fronts (53.98 x 85.6)
// ---------------------------------------------------------------------------------------------
function pCircle(c: Cat, v: string): Design {
  const g = v === "gradient";
  return {
    background: "$paper",
    elements: [
      S("header", "rect", 0, 0, PW, 34, { fill: g ? G("$primary", "$primaryDark", 135) : "$primary" }),
      L(4, 3, 8, 8),
      F("org", "org_name", 14, 4, 36, 4, undefined, { fontPt: 7.5, weight: 700, color: "$paper" }),
      T("subtitle", 14, 8.2, 36, 3, c.short, { fontPt: 5, weight: 600, color: "$paper", opacity: 0.85, letterSpacing: 0.15 }),
      P(12.99, 14, 28, 28, { shape: "circle", stroke: "$paper", strokeMm: 1 }),
      F("name", "full_name", 3, 46, 48, 6, undefined, { fontPt: 10, weight: 700, align: "middle" }),
      F("f1", c.f[1].b, 3, 54.5, 23, 7, c.f[1].l, { align: "middle" }),
      F("f2", c.f[2].b, 28, 54.5, 23, 7, c.f[2].l, { align: "middle" }),
      F("f0", c.f[0].b, 3, 64, 48, 7, c.f[0].l, { align: "middle" }),
      S("accent", "rect", 0, 80.5, PW, 5.1, { fill: g ? G("$secondary", "$secondaryDark", 0) : "$secondary" }),
      F("f3", c.f[3].b, 3, 81.6, 48, 3, undefined, { fontPt: 5.5, align: "middle" }),
    ],
  };
}

function pPlain(c: Cat): Design {
  return {
    background: "$paper",
    elements: [
      L(22, 4, 10, 10),
      F("org", "org_name", 3, 15.5, 48, 5, undefined, { fontPt: 8.5, weight: 700, color: "$primary", align: "middle" }),
      T("subtitle", 3, 20.5, 48, 3, c.short, { fontPt: 5, weight: 600, color: "$muted", align: "middle", letterSpacing: 0.15 }),
      S("rule", "line", 12, 25.5, 30, 0, { stroke: "$secondary", strokeMm: 0.5 }),
      P(13.5, 28, 27, 36, { shape: "rounded", stroke: "$primary", strokeMm: 0.4 }),
      F("name", "full_name", 3, 66, 48, 6, undefined, { fontPt: 10, weight: 700, align: "middle" }),
      F("f1", c.f[1].b, 3, 73.5, 23, 7, c.f[1].l, { align: "middle" }),
      F("f0", c.f[0].b, 28, 73.5, 23, 7, c.f[0].l, { align: "middle" }),
      S("rule2", "line", 12, 83.4, 30, 0, { stroke: "$secondary", strokeMm: 0.6 }),
    ],
  };
}

function pBand(c: Cat): Design {
  return {
    background: "$paper",
    elements: [
      S("band", "rect", 0, 0, PW, 24, { fill: G("$primary", "$primaryDark", 135) }),
      L(4, 3.5, 8, 8),
      F("org", "org_name", 14, 4.5, 36, 4, undefined, { fontPt: 7.5, weight: 700, color: "$paper" }),
      T("subtitle", 14, 8.7, 36, 3, c.short, { fontPt: 5, weight: 600, color: "$secondary", letterSpacing: 0.15 }),
      P(12.99, 15, 28, 34, { shape: "rounded", stroke: "$paper", strokeMm: 1 }),
      F("name", "full_name", 3, 52, 48, 6, undefined, { fontPt: 10, weight: 700, align: "middle" }),
      F("f1", c.f[1].b, 3, 60.5, 48, 7, c.f[1].l, { align: "middle" }),
      F("f0", c.f[0].b, 3, 69.5, 48, 7, c.f[0].l, { align: "middle" }),
      S("accent", "rect", 0, 81, PW, 4.6, { fill: G("$secondary", "$secondaryDark", 0) }),
    ],
  };
}

function pDark(c: Cat): Design {
  return {
    background: G("$ink", "$primaryDark", 90),
    elements: [
      L(22, 4, 10, 10),
      F("org", "org_name", 3, 15.5, 48, 5, undefined, { fontPt: 8.5, weight: 700, color: "$paper", align: "middle" }),
      T("subtitle", 3, 20.5, 48, 3, c.short, { fontPt: 5, weight: 600, color: "$secondary", align: "middle", letterSpacing: 0.18 }),
      P(12.99, 27, 28, 28, { shape: "circle", stroke: "$secondary", strokeMm: 0.8 }),
      F("name", "full_name", 3, 59, 48, 6, undefined, { fontPt: 10, weight: 700, color: "$paper", align: "middle" }),
      S("rule", "line", 12, 67, 30, 0, { stroke: "$secondary", strokeMm: 0.4 }),
      F("f1", c.f[1].b, 3, 69, 23, 7, c.f[1].l, { color: "$paper", align: "middle" }),
      F("f0", c.f[0].b, 28, 69, 23, 7, c.f[0].l, { color: "$paper", align: "middle" }),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Backs
// ---------------------------------------------------------------------------------------------

// Campus ID: green-banner style used by many universities (banner with institution name, logo and
// address line, photo left, name / level / program / ID# right, QR bottom right, corner swoosh).
function campus(c: Cat): Design {
  return {
    background: "$paper",
    elements: [
      S("header", "rect", 0, 0, W, 11.5, { fill: G("$primary", "$primaryDark", 0) }),
      F("org", "org_name", 4, 3.4, 77.6, 5, undefined, { fontPt: 8.5, weight: 800, color: "$paper", uppercase: true, letterSpacing: 0.04 }),
      L(31, 13.6, 9, 9),
      F("address", "org_contact", 41.5, 14, 40.5, 8, undefined, { fontPt: 5.4, weight: 400, color: "$muted", lines: 2 }),
      P(4, 15, 24, 31, { shape: "rounded", stroke: "$primary", strokeMm: 0.4 }),
      F("name", "full_name", 31, 24.6, 51, 6, undefined, { fontPt: 10, weight: 700 }),
      F("level", "grade_level", 31, 31, 33, 5.5, undefined, { fontPt: 9, weight: 800, color: "$primary" }),
      F("dept", "department", 31, 37, 33, 5, undefined, { fontPt: 7.5, weight: 600 }),
      F("idno", "student_number", 31, 43.5, 34, 5, "ID#", { fontPt: 8, weight: 800, color: "$primary", inline: true }),
      Q(66, 31.5, 16),
      T("qr_caption", 64, 47.8, 20, 3, "Scan to verify", { fontPt: 4.3, align: "middle", color: "$muted", weight: 600 }),
      S("swoosh", "poly", 0, 46, 24, 8, { points: [[0, 46], [24, 53.98], [0, 53.98]], fill: "$primary" }),
      S("swoosh2", "poly", 0, 49, 40, 5, { points: [[0, 49.5], [40, 53.98], [0, 53.98]], fill: G("$secondary", "$secondaryDark", 0), opacity: 0.9 }),
      S("strip", "rect", 40, 52.2, W - 40, 1.78, { fill: "$primary" }),
    ],
  };
}

function backCampus(c: Cat): Design {
  return {
    background: "$paper",
    elements: [
      T("title", 5, 4.5, 75.6, 7, c.subtitle, { fontPt: 12, weight: 800, color: "$primary", align: "middle", letterSpacing: 0.06 }),
      L(38.3, 12.5, 9, 9),
      T("back_text", 5, 23, 75.6, 13, "The bearer of this ID card is a registered student of this institution. Please accord him/her due courtesies. If found, please deliver to the institution or the nearest police station.", { fontPt: 6.2, lines: 4, align: "middle", color: "$ink" }),
      F("issued", "issue_date", 5, 38.5, 36, 4.5, "Date Issued", { fontPt: 6.5, weight: 800, inline: true }),
      F("expires", "expiry_date", 5, 43.5, 36, 4.5, "Date Expired", { fontPt: 6.5, weight: 800, inline: true }),
      S("sig_line", "line", 47, 44.5, 34, 0, { stroke: "$ink", strokeMm: 0.3 }),
      T("sig_label", 47, 45.6, 34, 3, "Dean of Student Services", { fontPt: 5.5, weight: 600, align: "middle", color: "$ink" }),
      S("strip", "rect", 0, 51.8, W, 2.18, { fill: G("$primary", "$primaryDark", 0) }),
    ],
  };
}

function back(variant: string, portrait: boolean): Design {
  const w = portrait ? PW : W;
  const dark = variant === "dark";
  const plain = variant === "plain";
  const textColor = dark ? "$paper" : "$ink";
  const muted = dark ? "$secondaryLight" : "$muted";
  const els: El[] = [];
  if (variant === "std") els.push(S("band", "rect", 0, 0, w, portrait ? 6 : 5, { fill: "$primary" }));
  if (variant === "gradient") els.push(S("band", "rect", 0, 0, w, portrait ? 6 : 5, { fill: G("$primary", "$primaryDark", 0) }));
  if (plain) els.push(S("rule", "line", 4, portrait ? 6 : 5, w - 8, 0, { stroke: "$secondary", strokeMm: 0.6 }));
  if (variant === "heritage") {
    els.push(S("border", "rect", 1.4, 1.4, w - 2.8, H - 2.8, { radius: 2.5, stroke: "$secondary", strokeMm: 0.3 }));
    els.push(S("band", "rect", 3, 3, w - 6, 5, { radius: 1, fill: G("$primary", "$primaryDark", 0) }));
  }
  if (!portrait) {
    els.push(T("back_text", 5, 10, 76, 13, WORDING, { fontPt: 6.5, lines: 3, color: muted }));
    if (variant !== "heritage") {
      els.push(Q(5, 25, 22), T("qr_caption", 5, 48, 22, 3, "Scan to verify", { fontPt: 5, align: "middle", color: muted, weight: 600 }));
      els.push(F("contact", "org_contact", 31, 26, 50, 10, "If found, contact", { fontPt: 6, weight: 400, color: textColor }));
      els.push(S("sig_line", "line", 50, 44, 31, 0, { stroke: dark ? "$paper" : "$ink", strokeMm: 0.25 }));
      els.push(T("sig_label", 50, 45.2, 31, 3, "Authorized signature", { fontPt: 5, align: "middle", color: muted }));
    } else {
      els.push(F("contact", "org_contact", 5, 27, 76, 10, "If found, contact", { fontPt: 6.5, weight: 400, color: textColor }));
      els.push(S("sig_line", "line", 28, 44, 30, 0, { stroke: "$ink", strokeMm: 0.25 }));
      els.push(T("sig_label", 28, 45.2, 30, 3, "Authorized signature", { fontPt: 5, align: "middle", color: muted }));
    }
  } else {
    els.push(T("back_text", 4, 11, 46, 20, WORDING, { fontPt: 6, lines: 5, color: muted }));
    els.push(Q(15.99, 33, 22), T("qr_caption", 4, 56, 46, 3, "Scan to verify", { fontPt: 5, align: "middle", color: muted, weight: 600 }));
    els.push(F("contact", "org_contact", 4, 62, 46, 9, "If found, contact", { fontPt: 6, weight: 400, align: "middle", color: textColor }));
    els.push(S("sig_line", "line", 10, 78, 34, 0, { stroke: dark ? "$paper" : "$ink", strokeMm: 0.25 }));
    els.push(T("sig_label", 10, 79, 34, 3, "Authorized signature", { fontPt: 5, align: "middle", color: muted }));
  }
  return { background: dark ? G("$ink", "$primaryDark", 135) : variant === "heritage" ? "$cream" : "$paper", elements: els };
}

const FRONT: Record<string, (c: Cat, v: string) => Design> = {
  banner, plainRight: (c) => plainRight(c), plainLeft: (c) => plainLeft(c), sidebar, blobs,
  split: (c) => split(c), hero: (c) => hero(c), diagonal: (c) => diagonal(c), dark: (c) => dark(c), heritage: (c) => heritage(c),
  campus: (c) => campus(c),
  pCircle, pPlain: (c) => pPlain(c), pBand: (c) => pBand(c), pDark: (c) => pDark(c),
};

export function expandRecipe(raw: unknown): Design | null {
  const r = raw as Recipe | null;
  if (!r || typeof r !== "object") return null;
  const cat = CATEGORIES[r.cat];
  if (!cat) return null;
  if (r.kind === "back" && r.variant === "campus") return backCampus(cat);
  if (r.kind === "back") return back(r.variant ?? "std", r.family === "portrait");
  const fn = FRONT[r.family];
  return fn ? fn(cat, r.variant ?? "solid") : null;
}

// ---------------------------------------------------------------------------------------------
// Catalog (what gets seeded). front/back are [family, variant].
// ---------------------------------------------------------------------------------------------
export type CatalogEntry = { slug: string; name: string; category: string; orientation: "landscape" | "portrait"; front: [string, string]; back: string; tag: string };
const PORTRAIT = new Set(["pCircle", "pPlain", "pBand", "pDark"]);
const plan: Record<string, Array<[string, string, string, string, string]>> = {
  // [key, family, variant, back variant, label]
  school: [["campus", "campus", "x", "campus", "Campus ID (banner, logo, QR)"], ["banner", "banner", "solid", "std", "Banner"], ["gradient-hero", "hero", "g", "gradient", "Gradient Hero"], ["plain", "plainRight", "x", "plain", "Plain (no background)"], ["split", "split", "x", "gradient", "Split Panel"], ["portrait-gradient", "pCircle", "gradient", "gradient", "Portrait Gradient"]],
  university: [["campus", "campus", "x", "campus", "Campus ID (banner, logo, QR)"], ["heritage", "heritage", "x", "heritage", "Heritage"], ["gradient-banner", "banner", "gradient", "gradient", "Gradient Banner"], ["plain", "plainLeft", "x", "plain", "Plain (no background)"], ["dark", "dark", "x", "dark", "Dark Gradient"], ["portrait-plain", "pPlain", "x", "plain", "Portrait Plain"]],
  church: [["sidebar", "sidebar", "solid", "std", "Sidebar"], ["heritage", "heritage", "x", "heritage", "Heritage"], ["plain", "plainRight", "x", "plain", "Plain (no background)"], ["gradient-sidebar", "sidebar", "gradient", "gradient", "Gradient Sidebar"], ["portrait-band", "pBand", "x", "gradient", "Portrait Band"]],
  community: [["heritage-gold", "heritage", "x", "heritage", "Heritage Gold & Navy"], ["blobs", "blobs", "solid", "std", "Colour Circles"], ["diagonal", "diagonal", "x", "std", "Diagonal Stripe"], ["plain", "plainLeft", "x", "plain", "Plain (no background)"], ["portrait-circle", "pCircle", "solid", "std", "Portrait Circle"], ["gradient-hero", "hero", "g", "gradient", "Gradient Hero"]],
  business: [["gradient-hero", "hero", "g", "gradient", "Gradient Hero"], ["banner", "banner", "solid", "std", "Banner"], ["plain", "plainRight", "x", "plain", "Plain (no background)"], ["dark", "dark", "x", "dark", "Dark Gradient"], ["portrait-dark", "pDark", "x", "dark", "Portrait Dark"]],
  healthcare: [["split", "split", "x", "gradient", "Split Panel"], ["gradient-banner", "banner", "gradient", "gradient", "Gradient Banner"], ["plain", "plainLeft", "x", "plain", "Plain (no background)"], ["diagonal", "diagonal", "x", "std", "Diagonal Stripe"], ["portrait-band", "pBand", "x", "gradient", "Portrait Band"]],
  ngo: [["blobs", "blobs", "gradient", "gradient", "Gradient Circles"], ["gradient-sidebar", "sidebar", "gradient", "gradient", "Gradient Sidebar"], ["plain", "plainRight", "x", "plain", "Plain (no background)"], ["banner", "banner", "solid", "std", "Banner"], ["portrait-plain", "pPlain", "x", "plain", "Portrait Plain"]],
  government: [["heritage", "heritage", "x", "heritage", "Heritage"], ["banner", "banner", "solid", "std", "Banner"], ["plain", "plainLeft", "x", "plain", "Plain (no background)"], ["dark", "dark", "x", "dark", "Dark Gradient"], ["portrait-circle", "pCircle", "solid", "std", "Portrait Circle"]],
  sports: [["diagonal", "diagonal", "x", "std", "Diagonal Stripe"], ["dark", "dark", "x", "dark", "Dark Gradient"], ["plain", "plainRight", "x", "plain", "Plain (no background)"], ["gradient-hero", "hero", "g", "gradient", "Gradient Hero"], ["portrait-dark", "pDark", "x", "dark", "Portrait Dark"]],
  event: [["dark", "dark", "x", "dark", "Dark Gradient"], ["diagonal", "diagonal", "x", "std", "Diagonal Stripe"], ["plain", "plainLeft", "x", "plain", "Plain (no background)"], ["gradient-banner", "banner", "gradient", "gradient", "Gradient Banner"], ["portrait-band", "pBand", "x", "gradient", "Portrait Band"]],
};

export const CATALOG: CatalogEntry[] = Object.entries(plan).flatMap(([cat, rows]) =>
  rows.map(([key, family, variant, backVariant, label]) => ({
    slug: `${cat}-${key}`,
    name: `${CATEGORIES[cat].name} ${label}`,
    category: cat,
    orientation: (PORTRAIT.has(family) ? "portrait" : "landscape") as "landscape" | "portrait",
    front: [family, variant] as [string, string],
    back: backVariant,
    tag: label.includes("Plain") ? "plain" : variant === "gradient" || variant === "g" || backVariant === "gradient" || backVariant === "dark" ? "gradient" : "solid",
  })),
);
