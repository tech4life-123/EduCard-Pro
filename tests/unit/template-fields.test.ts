import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogCustomKeys, labelFromKey } from "../../src/lib/templates/template-fields";

test("catalog custom keys are found and labelled", () => {
  const keys = catalogCustomKeys();
  for (const k of ["block", "house_no", "house_code"]) assert.ok(keys.includes(k), k);
  assert.equal(labelFromKey("house_no"), "House No");
});
