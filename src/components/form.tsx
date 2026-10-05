"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 " +
  "placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15";

export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-base font-medium " +
  "text-white hover:bg-slate-800 disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 " +
  "text-base font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60";

export function SubmitButton({ children, pendingText = "Please wait…" }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass + " w-full"}>
      {pending ? pendingText : children}
    </button>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error?.length ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error?.length ? (
        <p className="text-sm text-red-700" role="alert">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
        {state.message}
      </p>
    );
  }
  return null;
}
