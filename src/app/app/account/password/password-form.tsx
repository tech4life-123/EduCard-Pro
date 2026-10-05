"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";

export function PasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" name="password" error={state?.fieldErrors?.password} hint="At least 8 characters, with a letter and a number.">
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <Field label="Confirm new password" name="confirm" error={state?.fieldErrors?.confirm}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
