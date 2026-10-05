/** Must match the hard-coded allowlist inside verify_credential. Anything else is never public. */
export const PUBLIC_FIELD_CHOICES = [
  ["full_name", "Full name"],
  ["role_title", "Role / title"],
  ["department", "Department"],
  ["class_name", "Class"],
  ["grade_level", "Grade / level"],
  ["academic_year", "Academic year"],
] as const;
export const PUBLIC_FIELD_KEYS: readonly string[] = PUBLIC_FIELD_CHOICES.map(([k]) => k);
