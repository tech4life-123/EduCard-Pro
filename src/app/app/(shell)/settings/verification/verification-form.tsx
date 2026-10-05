"use client";

import { useActionState } from "react";
import { saveVerificationSettings } from "@/app/actions/verification";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";
import { PUBLIC_FIELD_CHOICES } from "@/lib/verify-settings";

export function VerificationForm({ selected, wording }: { selected: string[]; wording: string }) {
  const [state, action] = useActionState(saveVerificationSettings, null);
  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Also show on a valid scan</legend>
        {PUBLIC_FIELD_CHOICES.map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="fields" value={key} defaultChecked={selected.includes(key)} className="size-5" /> {label}
          </label>
        ))}
        <p className="text-xs text-slate-500">Anyone holding the card can scan it, so share only what you are comfortable showing. Dates of birth, phone numbers and addresses can never be shown.</p>
      </fieldset>
      <Field label="Message on the result page (optional)" name="wording" error={state?.fieldErrors?.wording} hint="For example: Report lost cards to the registrar's office.">
        <textarea id="wording" name="wording" rows={3} maxLength={300} defaultValue={wording} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
