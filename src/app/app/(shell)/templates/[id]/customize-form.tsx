"use client";

import { useActionState } from "react";
import { customizeTemplate } from "@/app/actions/templates";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";

export function CustomizeForm({ baseId, defaultName }: { baseId: string; defaultName: string }) {
  const [state, action] = useActionState(customizeTemplate.bind(null, baseId), null);
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Customize a copy</h2>
        <p className="text-sm text-slate-600">Makes your own version. The photo and QR code positions stay fixed so cards always scan and print correctly.</p>
      </div>
      <Field label="Template name" name="name" error={state?.fieldErrors?.name}>
        <input id="name" name="name" defaultValue={defaultName} required maxLength={80} className={inputClass} />
      </Field>
      <Field label="Card subtitle (optional)" name="subtitle" error={state?.fieldErrors?.subtitle} hint="Small line under the organization name, e.g. STUDENT ID.">
        <input id="subtitle" name="subtitle" maxLength={60} className={inputClass} />
      </Field>
      <Field label="Back-of-card wording (optional)" name="back_text" error={state?.fieldErrors?.back_text} hint="Leave empty to keep the original wording.">
        <textarea id="back_text" name="back_text" maxLength={300} rows={3} className={inputClass} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="show_logo" defaultChecked className="size-5" /> Show logo
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save as new template</SubmitButton>
    </form>
  );
}
