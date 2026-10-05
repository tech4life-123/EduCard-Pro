import { TEMPLATE_HEADERS } from "@/lib/batch-import";
import { getUser } from "@/lib/auth";

export async function GET() {
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const body = TEMPLATE_HEADERS.join(",") + "\nAmara,,Johnson,2012-03-25,female,Grade 5,A,Grade 5,2026/2027,S-001,+231770000000\n";
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="educard-members-template.csv"', "cache-control": "no-store" } });
}
