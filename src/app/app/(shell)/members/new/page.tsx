import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CustomFieldDef } from "@/lib/member-fields";
import { MemberForm } from "../member-form";

export const metadata = { title: "Add member · EduCard Pro" };

export default async function NewMemberPage() {
  const { org } = await requireOrg();
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_custom_field_defs")
    .select("id, key, label, field_type, options, required, sort_order")
    .eq("organization_id", org.id)
    .order("sort_order");
  return (
    <div className="space-y-5">
      <div>
        <Link href="/app/members" className="text-sm text-slate-600 underline">
          ← Members
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Add a member</h1>
      </div>
      <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
        Photo: after you tap <strong>Add member</strong>, you will land on the member&apos;s page, where <strong>Take photo</strong> and{" "}
        <strong>Choose from gallery</strong> appear.
      </p>
      <MemberForm defs={(data ?? []) as CustomFieldDef[]} />
    </div>
  );
}
