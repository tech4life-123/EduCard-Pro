"use client";

import { useActionState } from "react";
import { createBatch } from "@/app/actions/batches";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";

export function NewBatchForm() {
  const [state, action] = useActionState(createBatch, null);
  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <Field label="Batch name" name="name" error={state?.fieldErrors?.name} hint="For example: Grade 5 – 2026/2027">
        <input id="name" name="name" required maxLength={80} className={inputClass} />
      </Field>
      <Field label="CSV file" name="file" error={state?.fieldErrors?.file}>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Checking rows…">Upload and check</SubmitButton>
    </form>
  );
}
