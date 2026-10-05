/** Built-in member fields (columns on `members`). Shared by the form, validation and list. */
export const STANDARD_FIELDS = [
  { key: "role_title", label: "Role / title" },
  { key: "department", label: "Department" },
  { key: "class_name", label: "Class" },
  { key: "section", label: "Section" },
  { key: "grade_level", label: "Grade / level" },
  { key: "academic_year", label: "Academic year" },
  { key: "student_number", label: "Student number" },
  { key: "employee_number", label: "Employee number" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
] as const;

export type StandardKey = (typeof STANDARD_FIELDS)[number]["key"];

export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
  required: boolean;
  sort_order: number;
};

export const MEMBER_STATUSES = ["active", "inactive", "archived"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** Turn a human label into a safe field key ("Blood group" -> "blood_group"). */
export function keyFromLabel(label: string): string {
  let key = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!/^[a-z]/.test(key)) key = `f_${key}`.slice(0, 41);
  return key;
}
