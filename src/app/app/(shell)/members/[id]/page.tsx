import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setMemberStatus } from "@/app/actions/members";
import { secondaryButtonClass } from "@/components/form";
import type { CustomFieldDef } from "@/lib/member-fields";
import { MemberForm } from "../member-form";
import { PhotoCapture } from "@/components/photo-capture";
import { signedPhotoUrls } from "@/lib/photos";

export const metadata = { title: "Edit member · EduCard Pro" };

export default async function EditMemberPage({ params, searchParams }: PageProps<"/app/members/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const { org } = await requireOrg();
  const supabase = await createClient();
  const [{ data: member }, { data: defs }] = await Promise.all([
    supabase.from("members").select("*").eq("id", id).eq("organization_id", org.id).maybeSingle(),
    supabase
      .from("member_custom_field_defs")
      .select("id, key, label, field_type, options, required, sort_order")
      .eq("organization_id", org.id)
      .order("sort_order"),
  ]);
  if (!member) notFound();

  const photoUrl = member.photo_processed_path ? ((await signedPhotoUrls([member.photo_processed_path])).get(member.photo_processed_path) ?? null) : null;
  const archive = setMemberStatus.bind(null, member.id, "archived");
  const restore = setMemberStatus.bind(null, member.id, "active");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/app/members" className="text-sm text-slate-600 underline">
          ← Members
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{member.full_name}</h1>
        <p className="font-mono text-sm text-slate-600">{member.member_number}</p>
      </div>
      {sp.added ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          Member added. You can add a photo below.
        </p>
      ) : null}
      <PhotoCapture orgId={org.id} memberId={member.id} currentUrl={photoUrl} name={member.full_name} />
      <MemberForm
        id={member.id}
        defs={(defs ?? []) as CustomFieldDef[]}
        values={member as Record<string, string | null>}
        customValues={(member.custom_fields ?? {}) as Record<string, unknown>}
      />
      <form action={member.status === "archived" ? restore : archive} className="max-w-xs border-t border-slate-200 pt-5">
        <button type="submit" className={secondaryButtonClass + " w-full"}>
          {member.status === "archived" ? "Restore member" : "Archive member"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Archiving hides the member from active lists. Cards already issued keep their history.
        </p>
      </form>
    </div>
  );
}
