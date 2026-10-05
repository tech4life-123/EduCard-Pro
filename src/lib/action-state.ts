/** Shared result shape for form Server Actions (safe to import from client components). */
export type ActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;
