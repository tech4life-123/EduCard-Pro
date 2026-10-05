"use client";

import { switchOrganization } from "@/app/actions/org";

export function OrgSwitcher({
  orgs,
  activeId,
}: {
  orgs: Array<{ id: string; name: string }>;
  activeId: string;
}) {
  if (orgs.length < 2) return null;
  return (
    <form action={switchOrganization}>
      <select
        name="org"
        defaultValue={activeId}
        aria-label="Switch organization"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
