import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "org_staff" | "org_admin" | "org_owner";
const RANK: Record<OrgRole, number> = { org_staff: 1, org_admin: 2, org_owner: 3 };

export function hasRole(role: OrgRole, min: OrgRole): boolean {
  return RANK[role] >= RANK[min];
}

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  card_prefix: string;
  status: string;
};

export type Membership = { role: OrgRole; org: OrgSummary };

export const ORG_COOKIE = "ec_org";

/** The signed-in user, verified with the Auth server (not just read from the cookie). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Every organization the user belongs to. RLS already limits this to the user's own memberships. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_users")
    .select("role, organizations(id, name, slug, org_type, card_prefix, status)")
    .eq("user_id", user.id);
  if (error || !data) return [];
  const rows = data as unknown as Array<{ role: OrgRole; organizations: OrgSummary | OrgSummary[] | null }>;
  return rows
    .map((r) => ({ role: r.role, org: Array.isArray(r.organizations) ? r.organizations[0] : r.organizations }))
    .filter((r): r is Membership => !!r.org)
    .sort((a, b) => a.org.name.localeCompare(b.org.name));
});

/**
 * The organization the user is currently working in. The cookie only remembers a *preference*;
 * it is always checked against the user's real memberships, so it can never grant access.
 */
export async function getActiveMembership(): Promise<Membership | null> {
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;
  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  return memberships.find((m) => m.org.id === preferred) ?? memberships[0];
}

/** For pages and actions inside the app shell: user + active org, or redirect. */
export async function requireOrg() {
  const user = await requireUser();
  const membership = await getActiveMembership();
  if (!membership) redirect("/app/onboarding");
  return { user, ...membership };
}
