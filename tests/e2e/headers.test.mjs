// Black-box checks against a running server: BASE=http://localhost:3111 node tests/e2e/headers.test.mjs
const BASE = process.env.BASE ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  -> " + x)); };
const get = (p, init = {}) => fetch(BASE + p, { redirect: "manual", ...init });

for (const path of ["/login", "/verify", "/verify/" + "A".repeat(43)]) {
  const r = await get(path);
  const h = r.headers;
  ok(`${path}: CSP present, no framing`, /frame-ancestors 'none'/.test(h.get("content-security-policy") ?? ""));
  ok(`${path}: nosniff + frame deny`, h.get("x-content-type-options") === "nosniff" && h.get("x-frame-options") === "DENY");
  ok(`${path}: HSTS`, /max-age=\d{7,}/.test(h.get("strict-transport-security") ?? ""));
  ok(`${path}: camera limited to this site`, /camera=\(self\)/.test(h.get("permissions-policy") ?? ""));
  ok(`${path}: no X-Powered-By`, !h.get("x-powered-by"));
}
{
  const r = await get("/verify/" + "A".repeat(43));
  ok("verify pages: no-referrer and no-store", r.headers.get("referrer-policy") === "no-referrer" && /no-store/.test(r.headers.get("cache-control") ?? ""));
  const t = await r.text();
  ok("unknown code is never VERIFIED (not recognized, or unavailable if the database is unreachable)", /NOT RECOGNIZED|UNAVAILABLE/.test(t) && !/ID VERIFIED/.test(t));
  const junk = await (await get("/verify/not-a-token")).text();
  ok("malformed code shows NOT RECOGNIZED", /NOT RECOGNIZED/.test(junk));
}
for (const p of ["/app", "/app/members", "/app/cards", "/app/batches", "/app/templates", "/app/settings/branding", "/app/verifications"]) {
  const r = await get(p);
  ok(`${p} redirects signed-out visitors to /login`, [302, 303, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").includes("/login"), r.status);
}
{
  const r = await get("/app/print/pdf", { method: "POST", headers: { origin: "https://evil.example" }, body: new FormData() });
  ok("print: cross-origin POST rejected", [307, 308, 401, 403].includes(r.status) || r.status === 302, r.status);
  const bad = await get("/app/print/pdf", { method: "POST", headers: { origin: "null" }, body: new FormData() });
  ok("print: malformed Origin does not crash", bad.status < 500, bad.status);
}
{
  const r = await get("/login?next=//evil.com");
  ok("login page loads with hostile next param", r.status === 200);
}
{
  const h = await get("/api/health");
  ok("health endpoint answers without leaking details", [200, 503].includes(h.status) && /^\{"status":"(ok|degraded)"\}$/.test(await h.text()));
  const nf = await get("/definitely-not-a-page");
  ok("unknown page gives a friendly 404", nf.status === 404 && /Page not found/.test(await nf.text()));
  const rb = await (await get("/robots.txt")).text();
  ok("robots.txt hides /app and /verify/", /Disallow: \/app/.test(rb) && /Disallow: \/verify\//.test(rb));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
