"use client";

import { useActionState } from "react";
import { saveBranding } from "@/app/actions/branding";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";

type V = { primary_color: string; secondary_color: string; contact_email: string; contact_phone: string; address: string };

export function BrandingForm({ values }: { values: V }) {
  const [state, action] = useActionState(saveBranding, null);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Main color" name="primary_color" error={e?.primary_color}>
          <input id="primary_color" name="primary_color" type="color" defaultValue={values.primary_color} className="h-12 w-full rounded-lg border border-slate-300 bg-white p-1" />
        </Field>
        <Field label="Accent color" name="secondary_color" error={e?.secondary_color}>
          <input id="secondary_color" name="secondary_color" type="color" defaultValue={values.secondary_color} className="h-12 w-full rounded-lg border border-slate-300 bg-white p-1" />
        </Field>
      </div>
      <Field label="Contact email" name="contact_email" error={e?.contact_email}>
        <input id="contact_email" name="contact_email" type="email" defaultValue={values.contact_email} maxLength={120} className={inputClass} />
      </Field>
      <Field label="Contact phone" name="contact_phone" error={e?.contact_phone}>
        <input id="contact_phone" name="contact_phone" type="tel" defaultValue={values.contact_phone} maxLength={40} className={inputClass} />
      </Field>
      <Field label="Address" name="address" error={e?.address}>
        <input id="address" name="address" defaultValue={values.address} maxLength={200} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save branding</SubmitButton>
    </form>
  );
}
