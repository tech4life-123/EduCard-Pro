import type { CustomFieldDef } from "@/lib/member-fields";

export const MAX_ROWS = 500;
export const MAX_BYTES = 1_000_000;

export type Issue = { field: string; message: string; severity: "error" | "warning" };
export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  member: Record<string, string | null> & { custom_fields: Record<string, string | number | boolean> };
  issues: Issue[];
};

const BASE_COLUMNS = [
  "first_name", "middle_name", "last_name", "date_of_birth", "gender", "role_title", "department", "class_name",
  "section", "grade_level", "academic_year", "student_number", "employee_number", "phone", "address",
] as const;

const ALIASES: Record<string, string> = {
  firstname: "first_name", given_name: "first_name", first: "first_name",
  lastname: "last_name", surname: "last_name", family_name: "last_name", last: "last_name",
  middlename: "middle_name", middle: "middle_name",
  dob: "date_of_birth", birthdate: "date_of_birth", birth_date: "date_of_birth", date_of_birth: "date_of_birth",
  sex: "gender", title: "role_title", role: "role_title", position: "role_title",
  class: "class_name", classname: "class_name", grade: "grade_level", level: "grade_level", year: "academic_year",
  student_id: "student_number", studentid: "student_number", student_no: "student_number", id_number: "student_number",
  employee_id: "employee_number", employeeid: "employee_number", staff_number: "employee_number", staff_id: "employee_number",
  telephone: "phone", mobile: "phone", phone_number: "phone",
};

export function normalizeHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return ALIASES[k] ?? k;
}

export const TEMPLATE_HEADERS = ["first_name", "middle_name", "last_name", "date_of_birth", "gender", "class_name", "section", "grade_level", "academic_year", "student_number", "phone"];

const MAX: Record<string, number> = {
  first_name: 80, middle_name: 80, last_name: 80, role_title: 120, department: 120, class_name: 80, section: 80,
  grade_level: 80, academic_year: 40, student_number: 60, employee_number: 60, phone: 40, address: 300,
};

function parseDate(v: string): string | null {
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) iso = v;
  else {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v); // day first
    if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso || d > new Date()) return null;
  return iso;
}

export function validateRows(
  table: string[][],
  defs: CustomFieldDef[],
  existing: { student: Set<string>; employee: Set<string> },
): { rows: ParsedRow[]; headerIssues: string[] } {
  const headerIssues: string[] = [];
  if (table.length < 2) return { rows: [], headerIssues: ["The file has no data rows."] };
  const headers = table[0].map(normalizeHeader);
  const customByKey = new Map(defs.map((d) => [d.key, d]));
  const customByLabel = new Map(defs.map((d) => [normalizeHeader(d.label), d]));
  for (const need of ["first_name", "last_name"]) if (!headers.includes(need)) headerIssues.push(`Missing required column: ${need}.`);
  if (table.length - 1 > MAX_ROWS) headerIssues.push(`Too many rows (max ${MAX_ROWS} per batch). Split the file.`);
  if (headerIssues.length) return { rows: [], headerIssues };

  const seenStudent = new Set<string>();
  const seenEmployee = new Set<string>();
  const rows: ParsedRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const raw: Record<string, string> = {};
    headers.forEach((h, c) => {
      if (h) raw[h] = (table[i][c] ?? "").trim();
    });
    const issues: Issue[] = [];
    const member: ParsedRow["member"] = { custom_fields: {} } as ParsedRow["member"];
    const err = (field: string, message: string) => issues.push({ field, message, severity: "error" });
    const warn = (field: string, message: string) => issues.push({ field, message, severity: "warning" });

    for (const col of BASE_COLUMNS) {
      const v = raw[col] ?? "";
      if (col === "date_of_birth") {
        if (!v) member[col] = null;
        else {
          const d = parseDate(v);
          if (!d) err(col, "Use a past date like 2012-03-25 or 25/03/2012.");
          member[col] = d;
        }
      } else if (col === "gender") {
        const g = v.toLowerCase();
        if (!g) member[col] = null;
        else if (["f", "female"].includes(g)) member[col] = "female";
        else if (["m", "male"].includes(g)) member[col] = "male";
        else if (g === "other") member[col] = "other";
        else {
          warn(col, "Gender not recognized; left blank.");
          member[col] = null;
        }
      } else {
        if (v.length > (MAX[col] ?? 120)) err(col, `Too long (max ${MAX[col] ?? 120}).`);
        member[col] = v || null;
      }
    }
    if (!member.first_name) err("first_name", "First name is required.");
    if (!member.last_name) err("last_name", "Last name is required.");

    for (const [col, seen, ex, label] of [
      ["student_number", seenStudent, existing.student, "Student number"],
      ["employee_number", seenEmployee, existing.employee, "Employee number"],
    ] as const) {
      const v = member[col];
      if (!v) continue;
      if (seen.has(v)) err(col, `${label} appears more than once in this file.`);
      else if (ex.has(v)) err(col, `${label} already belongs to an existing member.`);
      seen.add(v);
    }

    for (const h of Object.keys(raw)) {
      const def = customByKey.get(h) ?? customByLabel.get(h);
      if (!def) continue;
      const v = raw[h];
      const key = `cf_${def.key}`;
      if (v === "") {
        if (def.required) err(key, `${def.label} is required.`);
        continue;
      }
      if (def.field_type === "number") {
        const n = Number(v);
        if (Number.isFinite(n)) member.custom_fields[def.key] = n;
        else err(key, `${def.label} must be a number.`);
      } else if (def.field_type === "date") {
        const d = parseDate(v);
        if (d) member.custom_fields[def.key] = d;
        else err(key, `${def.label} must be a date.`);
      } else if (def.field_type === "boolean") {
        member.custom_fields[def.key] = ["yes", "true", "1", "y"].includes(v.toLowerCase());
      } else if (def.field_type === "select") {
        if (def.options?.includes(v)) member.custom_fields[def.key] = v;
        else err(key, `${def.label} must be one of: ${(def.options ?? []).join(", ")}.`);
      } else if (v.length > 300) err(key, `${def.label} is too long.`);
      else member.custom_fields[def.key] = v;
    }
    for (const def of defs) {
      if (def.required && def.field_type !== "boolean" && !(def.key in member.custom_fields) && !issues.some((x) => x.field === `cf_${def.key}`)) {
        err(`cf_${def.key}`, `${def.label} is required (add a "${def.key}" column).`);
      }
    }
    rows.push({ rowNumber: i, raw, member, issues });
  }
  return { rows, headerIssues };
}

export function severityOf(issues: Issue[]): "ok" | "warning" | "error" {
  return issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warning" : "ok";
}
