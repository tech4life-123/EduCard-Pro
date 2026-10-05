"use client";

import { useActionState, useRef, useState } from "react";
import { addCustomField } from "@/app/actions/fields";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";

export function FieldForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(
    async (prev: Parameters<typeof addCustomField>[0], fd: FormData) => {
      const result = await addCustomField(prev, fd);
      if (result?.message) formRef.current?.reset();
      return result;
    },
    null,
  );
  const [type, setType] = useState("text");
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Field name" name="label" error={state?.fieldErrors?.label} hint="e.g. Blood group, Church branch, Emergency contact">
        <input id="label" name="label" required className={inputClass} />
      </Field>
      <Field label="Type" name="field_type" error={state?.fieldErrors?.field_type}>
        <select id="field_type" name="field_type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="boolean">Yes / No</option>
          <option value="select">Choose from a list</option>
        </select>
      </Field>
      {type === "select" ? (
        <Field label="Choices" name="options" error={state?.fieldErrors?.options} hint="Separate with commas, e.g. A+, A-, B+, B-, O+, O-">
          <input id="options" name="options" className={inputClass} />
        </Field>
      ) : null}
      {type !== "boolean" ? (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="required" className="size-5" />
          Required for every member
        </label>
      ) : null}
      <FormMessage state={state} />
      <div className="max-w-xs">
        <SubmitButton pendingText="Adding…">Add field</SubmitButton>
      </div>
    </form>
  );
}
