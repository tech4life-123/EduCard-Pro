import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../../src/lib/safe-redirect";
import { extractToken } from "../../src/lib/token-input";
import { csvSafe, parseCsv } from "../../src/lib/csv";
import { generateCredentialToken, hashCredential, isWellFormedToken, hashIp } from "../../src/lib/credentials";
import { CATALOG } from "../../src/lib/templates/families";
import { parseDesign } from "../../src/lib/templates/schema";

test("safeNext blocks open redirects", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/login", "app", "/application", undefined, 5]) {
    assert.equal(safeNext(bad), "/app", String(bad));
  }
  assert.equal(safeNext("/app/cards?status=active"), "/app/cards?status=active");
});

test("credential tokens are random, well formed and hashed", () => {
  const a = generateCredentialToken(), b = generateCredentialToken();
  assert.notEqual(a, b);
  assert.ok(isWellFormedToken(a));
  assert.match(hashCredential(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashCredential(a), a);
  for (const bad of ["", "short", a + "x", a.slice(1) + "!", "../../etc/passwd", "a".repeat(43) + "\n"]) assert.equal(isWellFormedToken(bad), false, bad);
});

test("IP hashes never contain the IP and differ per IP", () => {
  assert.ok(!hashIp("1.2.3.4").includes("1.2.3.4"));
  assert.notEqual(hashIp("1.2.3.4"), hashIp("1.2.3.5"));
});

test("extractToken accepts a link or bare code only", () => {
  const t = generateCredentialToken();
  assert.equal(extractToken(t), t);
  assert.equal(extractToken(`https://educard-pro.vercel.app/verify/${t}`), t);
  assert.equal(extractToken("hello world"), null);
  assert.equal(extractToken(""), null);
});

test("CSV formula injection is neutralised", () => {
  for (const v of ["=1+1", "+cmd", "-2", "@SUM(A1)"]) assert.ok(!/^[=+\-@]/.test(csvSafe(v)), v);
  assert.equal(csvSafe("Mary"), "Mary");
  assert.deepEqual(parseCsv('a,b\n"x,1",y'), [["a", "b"], ["x,1", "y"]]);
});

test("every catalog template expands to a valid design with a QR on one side", () => {
  assert.ok(CATALOG.length >= 51);
  for (const t of CATALOG) {
    const front = parseDesign({ recipe: { kind: "front", family: t.front[0], cat: t.category, variant: t.front[1] } });
    const back = parseDesign({ recipe: { kind: "back", family: t.orientation === "portrait" ? "portrait" : "landscape", cat: t.category, variant: t.back } });
    assert.ok(front.elements.some((e) => e.type === "photo"), t.slug + " front needs a photo");
    assert.ok([...front.elements, ...back.elements].some((e) => e.type === "qr"), t.slug + " needs a QR on one side");
  }
});
