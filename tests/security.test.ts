import assert from "node:assert/strict";
import test from "node:test";
import { safeFileName, safeJsonLd, validEmail } from "../lib/security";

test("safeJsonLd escapes HTML-significant characters", () => {
  const output = safeJsonLd({ text: "</script><script>alert(1)</script>&" });
  assert.ok(!output.includes("</script>"));
  assert.ok(output.includes("\\u003c/script\\u003e"));
  assert.ok(output.includes("\\u0026"));
});

test("safeFileName strips path separators and control characters", () => {
  assert.equal(safeFileName("../../secret\u0000.pdf"), "_.._secret_.pdf");
  assert.equal(safeFileName(""), "upload");
});

test("validEmail accepts bounded conventional addresses", () => {
  assert.equal(validEmail("researcher@example.edu"), true);
  assert.equal(validEmail("not-an-email"), false);
  assert.equal(validEmail("a".repeat(250) + "@x.com"), false);
});
