"use client";

import { useActionState } from "react";
import { saveMember } from "@/app/actions/members";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/form";
import { MEMBER_STATUSES, STANDARD_FIELDS, type CustomFieldDef } from "@/lib/member-fields";

type Values = Record<string, string | null | undefined>;

export function MemberForm({
  defs,
  values = {},
  customValues = {},
  id,
}: {
  defs: CustomFieldDef[];
  values?: Values;
  customValues?: Record<string, unknown>;
  id?: string;
}) {
  const [state, action] = useActionState(saveMember, null);
  const fe = state?.fieldErrors;
  const v = (k: string) => values[k] ?? "";

  return (
    <form action={action} className="space-y-6">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <section className="space-y-4">
        <h2 className="font-semibold">Identity</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" name="first_name" error={fe?.first_name}>
            <input id="first_name" name="first_name" required defaultValue={v("first_name")} className={inputClass} />
          </Field>
          <Field label="Middle name" name="middle_name" error={fe?.middle_name}>
            <input id="middle_name" name="middle_name" defaultValue={v("middle_name")} className={inputClass} />
          </Field>
          <Field label="Last name" name="last_name" error={fe?.last_name}>
            <input id="last_name" name="last_name" required defaultValue={v("last_name")} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date of birth" name="date_of_birth" error={fe?.date_of_birth}>
            <input id="date_of_birth" name="date_of_birth" type="date" defaultValue={v("date_of_birth")} className={inputClass} />
          </Field>
          <Field label="Gender" name="gender" error={fe?.gender}>
            <select id="gender" name="gender" defaultValue={v("gender")} className={inputClass}>
              <option value="">Not stated</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Status" name="status" error={fe?.status}>
            <select id="status" name="status" defaultValue={v("status") || "active"} className={inputClass}>
              {MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Details</h2>
        <p className="-mt-2 text-sm text-slate-600">Fill in only what applies to this person.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {STANDARD_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} name={f.key} error={fe?.[f.key]}>
              <input id={f.key} name={f.key} defaultValue={v(f.key)} className={inputClass} />
            </Field>
          ))}
        </div>
      </section>

      {defs.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-semibold">Your custom fields</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {defs.map((d) => {
              const name = `cf_${d.key}`;
              const current = customValues[d.key];
              const label = d.required ? `${d.label} *` : d.label;
              if (d.field_type === "boolean") {
                return (
                  <label key={d.id} className="flex min-h-11 items-center gap-3 text-base">
                    <input type="checkbox" name={name} defaultChecked={current === true} className="size-5" />
                    {d.label}
                  </label>
                );
              }
              return (
                <Field key={d.id} label={label} name={name} error={fe?.[name]}>
                  {d.field_type === "select" ? (
                    <select id={name} name={name} defaultValue={typeof current === "string" ? current : ""} className={inputClass}>
                      <option value="">—</option>
                      {(d.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={name}
                      name={name}
                      type={d.field_type === "number" ? "number" : d.field_type === "date" ? "date" : "text"}
                      step={d.field_type === "number" ? "any" : undefined}
                      defaultValue={current == null ? "" : String(current)}
                      className={inputClass}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </section>
      ) : null}

      <FormMessage state={state?.error ? { error: state.error } : state} />
      <div className="max-w-xs">
        <SubmitButton pendingText="Saving…">{id ? "Save changes" : "Add member"}</SubmitButton>
      </div>
    </form>
  );
}
