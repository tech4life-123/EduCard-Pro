"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrg } from "@/lib/auth";
import { ORIGINAL_BUCKET, PROCESSED_BUCKET, photoPathPattern } from "@/lib/photos";
import type { ActionState } from "@/lib/action-state";

/** Best-effort cleanup of replaced files so old personal photos do not linger in storage. */
async function deleteObjects(originalPath: string | null, processedPath: string | null) {
  try {
    const admin = createAdminClient();
    if (originalPath) await admin.storage.from(ORIGINAL_BUCKET).remove([originalPath]);
    if (processedPath) await admin.storage.from(PROCESSED_BUCKET).remove([processedPath]);
  } catch {
    // Service key not configured or storage hiccup: the member record is already correct.
  }
}

/** Called after the browser has uploaded both files. Verifies, then links them to the member. */
export async function recordPhoto(memberId: string, originalPath: string, processedPath: string): Promise<ActionState> {
  const { org } = await requireOrg();
  if (!z.uuid().safeParse(memberId).success) return { error: "That member could not be found." };

  const pattern = photoPathPattern(org.id, memberId);
  if (!pattern.test(originalPath) || !pattern.test(processedPath)) return { error: "Invalid photo upload." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("photo_original_path, photo_processed_path")
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!member) return { error: "That member could not be found." };

  // Confirm both objects really exist in this member's folder before trusting the paths.
  const folder = `${org.id}/${memberId}`;
  for (const [bucket, path] of [
    [ORIGINAL_BUCKET, originalPath],
    [PROCESSED_BUCKET, processedPath],
  ] as const) {
    const name = path.split("/").pop()!;
    const { data } = await supabase.storage.from(bucket).list(folder, { search: name, limit: 5 });
    if (!data?.some((o) => o.name === name)) return { error: "The upload did not complete. Please try again." };
  }

  const { error } = await supabase
    .from("members")
    .update({ photo_original_path: originalPath, photo_processed_path: processedPath })
    .eq("id", memberId)
    .eq("organization_id", org.id);
  if (error) return { error: "Could not save the photo. Please try again." };

  await deleteObjects(
    member.photo_original_path && member.photo_original_path !== originalPath ? member.photo_original_path : null,
    member.photo_processed_path && member.photo_processed_path !== processedPath ? member.photo_processed_path : null,
  );
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app/members");
  return { message: "Photo saved." };
}

export async function removePhoto(memberId: string): Promise<ActionState> {
  const { org } = await requireOrg();
  if (!z.uuid().safeParse(memberId).success) return { error: "That member could not be found." };
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("photo_original_path, photo_processed_path")
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!member) return { error: "That member could not be found." };

  const { error } = await supabase
    .from("members")
    .update({ photo_original_path: null, photo_processed_path: null })
    .eq("id", memberId)
    .eq("organization_id", org.id);
  if (error) return { error: "Could not remove the photo." };

  await deleteObjects(member.photo_original_path, member.photo_processed_path);
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app/members");
  return { message: "Photo removed." };
}
