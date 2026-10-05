"use client";

import { useActionState } from "react";
import { createOrganization } from "@/app/actions/org";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";

const TYPES: Array<[string, string]> = [
  ["school", "School / university"],
  ["church", "Church"],
  ["community", "Community group"],
  ["association", "Association"],
  ["business", "Business"],
  ["ngo", "NGO"],
  ["club", "Club"],
  ["other", "Other"],
];

export function OrgForm() {
  const [state, action] = useActionState(createOrganization, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Organization name" name="name" error={state?.fieldErrors?.name}>
        <input id="name" name="name" required className={inputClass} placeholder="e.g. Tubman University" />
      </Field>
      <Field label="Type" name="org_type" error={state?.fieldErrors?.org_type}>
        <select id="org_type" name="org_type" defaultValue="school" className={inputClass}>
          {TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Card number prefix"
        name="card_prefix"
        error={state?.fieldErrors?.card_prefix}
        hint="Printed before every number, e.g. TU-000001. Letters and numbers only."
      >
        <input id="card_prefix" name="card_prefix" required maxLength={8} className={inputClass + " uppercase"} placeholder="TU" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating…">Create organization</SubmitButton>
    </form>
  );
}
