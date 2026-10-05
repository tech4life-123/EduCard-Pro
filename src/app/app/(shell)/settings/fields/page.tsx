import { redirect } from "next/navigation";
import { hasRole, requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteCustomField } from "@/app/actions/fields";
import { secondaryButtonClass } from "@/components/form";
import type { CustomFieldDef } from "@/lib/member-fields";
import { FieldForm } from "./field-form";

export const metadata = { title: "Custom fields · EduCard Pro" };

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Yes / No",
  select: "List",
};

export default async function FieldsPage() {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) redirect("/app");

  const supabase = await createClient();
  const { data } = await supabase
    .from("member_custom_field_defs")
    .select("id, key, label, field_type, options, required, sort_order")
    .eq("organization_id", org.id)
    .order("sort_order");
  const defs = (data ?? []) as CustomFieldDef[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Custom fields</h1>
        <p className="text-sm text-slate-600">
          Extra details your members need on their records and cards. They appear on the member form.
        </p>
      </div>

      {defs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">No custom fields yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {defs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {d.label}
                  {d.required ? <span className="ml-2 text-xs text-slate-500">required</span> : null}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {TYPE_LABEL[d.field_type]}
                  {d.options?.length ? ` · ${d.options.join(", ")}` : ""}
                </p>
              </div>
              <form action={deleteCustomField.bind(null, d.id)}>
                <button type="submit" className={secondaryButtonClass}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Removing a field hides it from forms. Values already saved on members are kept in their records.
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">Add a field</h2>
        <FieldForm />
      </section>
    </div>
  );
}
