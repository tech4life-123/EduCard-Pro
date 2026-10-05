"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";

export function SignupForm() {
  const [state, action] = useActionState(signUp, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Full name" name="full_name" error={state?.fieldErrors?.full_name}>
        <input id="full_name" name="full_name" autoComplete="name" required className={inputClass} />
      </Field>
      <Field label="Email" name="email" error={state?.fieldErrors?.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field
        label="Password"
        name="password"
        error={state?.fieldErrors?.password}
        hint="At least 8 characters, with a letter and a number."
      >
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <Field label="Confirm password" name="confirm" error={state?.fieldErrors?.confirm}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
