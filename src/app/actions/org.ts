"use server";

import { randomBytes } from "node:crypto";
import * as z from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE, getMemberships, requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

const ORG_TYPES = ["school", "church", "community", "association", "business", "ngo", "club", "other"] as const;

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "org";
}

async function rememberOrg(orgId: string) {
  (await cookies()).set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter the organization name.").max(120),
      org_type: z.enum(ORG_TYPES, "Choose a type."),
      card_prefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{2,8}$/, "Use 2 to 8 letters or numbers, e.g. WVSTU."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const base = slugify(parsed.data.name);
  let orgId: string | null = null;

  // Slugs are globally unique; on a clash, retry with a short random suffix.
  for (let attempt = 0; attempt < 3 && !orgId; attempt++) {
    const slug = attempt === 0 ? base : `${base.slice(0, 52)}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: parsed.data.name,
      p_slug: slug,
      p_type: parsed.data.org_type,
      p_card_prefix: parsed.data.card_prefix,
    });
    if (!error) {
      orgId = data as string;
    } else if (error.code !== "23505") {
      return { error: "Could not create the organization. Please try again." };
    }
  }
  if (!orgId) return { error: "That name is already taken. Try a slightly different name." };

  await rememberOrg(orgId);
  redirect("/app");
}

/** Switch the active organization. The choice is verified against real memberships. */
export async function switchOrganization(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("org"));
  if (!id.success) return;
  const memberships = await getMemberships();
  if (memberships.some((m) => m.org.id === id.data)) {
    await rememberOrg(id.data);
  }
  redirect("/app");
}
