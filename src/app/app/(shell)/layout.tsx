import Link from "next/link";
import { requireOrg, getMemberships, hasRole } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { OrgSwitcher } from "@/components/org-switcher";

export default async function ShellLayout({ children }: LayoutProps<"/app">) {
  const { user, role, org } = await requireOrg();
  const memberships = await getMemberships();

  const links = [
    { href: "/app", label: "Dashboard" },
    { href: "/app/members", label: "Members" },
    { href: "/app/cards", label: "Cards" },
    { href: "/app/batches", label: "Batches" },
    { href: "/app/templates", label: "Templates" },
    ...(hasRole(role, "org_admin")
      ? [
          { href: "/app/settings/fields", label: "Fields" },
          { href: "/app/settings/branding", label: "Branding" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{org.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <OrgSwitcher orgs={memberships.map((m) => ({ id: m.org.id, name: m.org.name }))} activeId={org.id} />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {l.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <button type="submit" className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 md:pb-10">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex overflow-x-auto border-t border-slate-200 bg-white md:hidden"
        aria-label="Main"
      >
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="min-w-20 flex-1 shrink-0 px-3 py-3.5 text-center text-xs font-medium text-slate-700 active:bg-slate-100">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
