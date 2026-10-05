import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/form";
import { signedPhotoUrls } from "@/lib/photos";

export const metadata = { title: "Members · EduCard Pro" };

const PAGE_SIZE = 25;
const STATUS_FILTERS = ["active", "inactive", "archived", "all"] as const;

/** Keep only characters that are safe inside a PostgREST filter string. */
function cleanQuery(q: string) {
  return q.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 60);
}

export default async function MembersPage({ searchParams }: PageProps<"/app/members">) {
  const sp = await searchParams;
  const q = cleanQuery(typeof sp.q === "string" ? sp.q : "");
  const status = STATUS_FILTERS.find((s) => s === sp.status) ?? "active";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const { org } = await requireOrg();
  const supabase = await createClient();
  let query = supabase
    .from("members")
    .select("id, member_number, full_name, role_title, department, class_name, status, photo_processed_path", { count: "exact" })
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`full_name.ilike.%${q}%,member_number.ilike.%${q}%`);
  const { data, count } = await query;

  const photos = await signedPhotoUrls((data ?? []).map((m) => m.photo_processed_path));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/app/members?${new URLSearchParams({ ...(q ? { q } : {}), status, page: String(p) })}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <Link href="/app/members/new" className={buttonClass}>
          Add member
        </Link>
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <input name="q" defaultValue={q} placeholder="Search name or number" aria-label="Search members" className={inputClass} />
        <select name="status" defaultValue={status} aria-label="Status" className={inputClass + " sm:max-w-40"}>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className={secondaryButtonClass}>
          Search
        </button>
      </form>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
          {q || status !== "active" ? "No members match your search." : "No members yet. Add your first member to get started."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(data ?? []).map((m) => (
            <li key={m.id}>
              <Link href={`/app/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                {m.photo_processed_path && photos.get(m.photo_processed_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos.get(m.photo_processed_path)} alt="" width={40} height={53} className="h-13 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-13 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-sm font-semibold text-slate-500" aria-hidden>
                    {m.full_name.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("")}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.full_name}</p>
                  <p className="truncate text-sm text-slate-600">
                    <span className="font-mono">{m.member_number}</span>
                    {[m.role_title, m.department, m.class_name].filter(Boolean).map((x) => ` · ${x}`)}
                  </p>
                </div>
                {m.status !== "active" ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{m.status}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={link(page - 1)} className="underline">← Previous</Link> : <span />}
          <span className="text-slate-600">
            Page {page} of {pages} · {total} members
          </span>
          {page < pages ? <Link href={link(page + 1)} className="underline">Next →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
