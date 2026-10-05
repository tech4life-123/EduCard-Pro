// Starter card templates (global, platform-managed). Positions are in millimetres.
// Run `node scripts/gen-templates-sql.mjs` to regenerate the seed migration.

const T = (id, x, y, w, h, text, o = {}) => ({ id, type: "text", x, y, w, h, text, fontPt: 8, weight: 400, color: "$ink", align: "start", ...o });
const F = (id, binding, x, y, w, h, label, o = {}) => ({ id, type: "field", binding, x, y, w, h, label, fontPt: 8, weight: 600, color: "$ink", align: "start", ...o });
const P = (id, x, y, w, h, o = {}) => ({ id, type: "photo", x, y, w, h, shape: "rect", locked: true, ...o });
const Q = (id, x, y, size) => ({ id, type: "qr", x, y, size, locked: true });
const L = (id, x, y, w, h) => ({ id, type: "logo", x, y, w, h });
const S = (id, kind, x, y, w, h, o = {}) => ({ id, type: "shape", kind, x, y, w, h, ...o });

const WORDING = "This card is the property of the issuing organization and must be shown on request. If found, please return it using the contact below.";

function backLandscape(extra = []) {
  return {
    background: "$paper",
    elements: [
      S("band", "rect", 0, 0, 85.6, 5, { fill: "$primary" }),
      T("back_text", 5, 8, 76, 13, WORDING, { fontPt: 6.5, lines: 3, color: "$muted" }),
      Q("qr", 5, 25, 22),
      T("qr_caption", 5, 48, 22, 3, "Scan to verify", { fontPt: 5, align: "middle", color: "$muted", weight: 600 }),
      F("contact", "org_contact", 31, 26, 50, 10, "If found, contact", { fontPt: 6, weight: 400 }),
      S("sig_line", "line", 50, 44, 31, 0, { stroke: "$ink", strokeMm: 0.25 }),
      T("sig_label", 50, 45.2, 31, 3, "Authorized signature", { fontPt: 5, align: "middle", color: "$muted" }),
      ...extra,
    ],
  };
}

function backPortrait() {
  return {
    background: "$paper",
    elements: [
      S("band", "rect", 0, 0, 53.98, 6, { fill: "$primary" }),
      T("back_text", 4, 10, 46, 20, WORDING, { fontPt: 6, lines: 5, color: "$muted" }),
      Q("qr", 15.99, 33, 22),
      T("qr_caption", 4, 56, 46, 3, "Scan to verify", { fontPt: 5, align: "middle", color: "$muted", weight: 600 }),
      F("contact", "org_contact", 4, 62, 46, 9, "If found, contact", { fontPt: 6, weight: 400, align: "middle" }),
      S("sig_line", "line", 10, 78, 34, 0, { stroke: "$ink", strokeMm: 0.25 }),
      T("sig_label", 10, 79, 34, 3, "Authorized signature", { fontPt: 5, align: "middle", color: "$muted" }),
    ],
  };
}

export const STARTERS = [
  {
    slug: "school-classic",
    name: "School Classic",
    category: "school",
    orientation: "landscape",
    width_mm: 85.6,
    height_mm: 53.98,
    photo_width_mm: 22,
    photo_height_mm: 28.5,
    sort_order: 10,
    front: {
      background: "$paper",
      elements: [
        S("header", "rect", 0, 0, 85.6, 13, { fill: "$primary" }),
        L("logo", 3, 2, 9, 9),
        F("org", "org_name", 14, 3.2, 68, 4.5, undefined, { fontPt: 9, weight: 700, color: "$paper" }),
        T("subtitle", 14, 8, 68, 3, "STUDENT IDENTIFICATION CARD", { fontPt: 5.5, weight: 600, color: "$paper", opacity: 0.85, letterSpacing: 0.12 }),
        P("photo", 4, 16.5, 22, 28.5, { stroke: "$primary", strokeMm: 0.5 }),
        F("name", "full_name", 30, 17, 52, 7, undefined, { fontPt: 11, weight: 700 }),
        F("id", "member_number", 30, 26, 26, 7, "ID No."),
        F("class", "class_name", 58, 26, 24, 7, "Class"),
        F("year", "academic_year", 30, 35, 26, 7, "Academic year"),
        F("expiry", "expiry_date", 58, 35, 24, 7, "Valid until"),
        S("accent", "rect", 0, 51.5, 85.6, 2.48, { fill: "$secondary" }),
      ],
    },
    back: backLandscape(),
  },
  {
    slug: "school-modern-portrait",
    name: "School Modern (Portrait)",
    category: "school",
    orientation: "portrait",
    width_mm: 53.98,
    height_mm: 85.6,
    photo_width_mm: 28,
    photo_height_mm: 28,
    sort_order: 20,
    front: {
      background: "$paper",
      elements: [
        S("header", "rect", 0, 0, 53.98, 34, { fill: "$primary" }),
        L("logo", 4, 3, 8, 8),
        F("org", "org_name", 14, 4, 36, 4, undefined, { fontPt: 7.5, weight: 700, color: "$paper" }),
        T("subtitle", 14, 8.2, 36, 3, "STUDENT ID", { fontPt: 5, weight: 600, color: "$paper", opacity: 0.85, letterSpacing: 0.15 }),
        P("photo", 12.99, 14, 28, 28, { shape: "circle", stroke: "$paper", strokeMm: 1 }),
        F("name", "full_name", 3, 46, 48, 6, undefined, { fontPt: 10, weight: 700, align: "middle" }),
        F("class", "class_name", 3, 54.5, 23, 7, "Class", { align: "middle" }),
        F("year", "academic_year", 28, 54.5, 23, 7, "Year", { align: "middle" }),
        F("id", "member_number", 3, 64, 48, 7, "ID No.", { align: "middle" }),
        S("accent", "rect", 0, 80.5, 53.98, 5.1, { fill: "$secondary" }),
        F("expiry", "expiry_date", 3, 81.6, 48, 3, undefined, { fontPt: 5.5, weight: 600, align: "middle", color: "$ink" }),
      ],
    },
    back: backPortrait(),
  },
  {
    slug: "church-membership",
    name: "Church Membership",
    category: "church",
    orientation: "landscape",
    width_mm: 85.6,
    height_mm: 53.98,
    photo_width_mm: 22,
    photo_height_mm: 28.5,
    sort_order: 30,
    front: {
      background: "#fffaf0",
      elements: [
        S("bar", "rect", 0, 0, 7, 53.98, { fill: "$primary" }),
        S("bar_accent", "rect", 7, 0, 1.2, 53.98, { fill: "$secondary" }),
        L("logo", 12, 3.5, 9, 9),
        F("org", "org_name", 23, 4.5, 58, 4.5, undefined, { fontPt: 9, weight: 700, color: "$primary" }),
        T("subtitle", 23, 9.2, 58, 3, "MEMBERSHIP CARD", { fontPt: 5.5, weight: 600, color: "$muted", letterSpacing: 0.15 }),
        P("photo", 12, 17, 22, 28.5, { shape: "rounded", stroke: "$secondary", strokeMm: 0.5 }),
        F("name", "full_name", 38, 17.5, 44, 7, undefined, { fontPt: 11, weight: 700 }),
        F("id", "member_number", 38, 27, 22, 7, "Member No."),
        F("branch", "department", 62, 27, 20, 7, "Branch"),
        F("since", "issue_date", 38, 36, 22, 7, "Member since"),
        F("role", "role_title", 62, 36, 20, 7, "Ministry"),
      ],
    },
    back: backLandscape(),
  },
  {
    slug: "community-association",
    name: "Community / Association",
    category: "association",
    orientation: "landscape",
    width_mm: 85.6,
    height_mm: 53.98,
    photo_width_mm: 24,
    photo_height_mm: 24,
    sort_order: 40,
    front: {
      background: "$paper",
      elements: [
        S("blob1", "circle", 58, -22, 55, 55, { fill: "$primary", opacity: 0.95 }),
        S("blob2", "circle", 70, 36, 30, 30, { fill: "$secondary", opacity: 0.9 }),
        L("logo", 4, 4, 10, 10),
        F("org", "org_name", 16, 6, 44, 4.5, undefined, { fontPt: 9, weight: 700, color: "$primary" }),
        T("subtitle", 16, 10.5, 44, 3, "MEMBER ID", { fontPt: 5.5, weight: 600, color: "$muted", letterSpacing: 0.15 }),
        P("photo", 56, 8, 24, 24, { shape: "circle", stroke: "$paper", strokeMm: 1 }),
        F("name", "full_name", 4, 20, 50, 7, undefined, { fontPt: 12, weight: 700 }),
        F("role", "role_title", 4, 29.5, 50, 7, "Role"),
        F("id", "member_number", 4, 39, 28, 7, "Member No."),
        F("expiry", "expiry_date", 34, 39, 22, 7, "Valid until"),
      ],
    },
    back: backLandscape(),
  },
  {
    slug: "staff-id",
    name: "Staff / Employee",
    category: "business",
    orientation: "landscape",
    width_mm: 85.6,
    height_mm: 53.98,
    photo_width_mm: 22,
    photo_height_mm: 28.5,
    sort_order: 50,
    front: {
      background: "$primary",
      elements: [
        L("logo", 4, 3.5, 9, 9),
        F("org", "org_name", 15, 5.5, 66, 4.5, undefined, { fontPt: 9, weight: 700, color: "$paper" }),
        S("panel", "rect", 3, 15, 79.6, 35.5, { fill: "$paper", radius: 2 }),
        P("photo", 6, 18, 22, 28.5, { stroke: "$primary", strokeMm: 0.4 }),
        F("name", "full_name", 31, 18.5, 49, 7, undefined, { fontPt: 11, weight: 700 }),
        F("role", "role_title", 31, 27.5, 49, 7, "Position"),
        F("dept", "department", 31, 36.5, 24, 7, "Department"),
        F("empno", "employee_number", 57, 36.5, 24, 7, "Employee No."),
        S("accent", "rect", 3, 50.5, 79.6, 1.2, { fill: "$secondary" }),
      ],
    },
    back: backLandscape(),
  },
];
