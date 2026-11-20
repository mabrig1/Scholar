import test from "node:test";
import assert from "node:assert/strict";
import { parseAiFindings, reviewMarkdown, screenManuscript, validateReviewInput, type ReviewInput } from "../lib/manuscript-review";
import { readReviewBody, reviewWithAi } from "../lib/manuscript-review-server";
import { POST as reviewPost } from "../app/api/manuscript-review/route";
import { POST as extractPost } from "../app/api/manuscript-review/extract/route";
import { POST as wordPost } from "../app/api/manuscript-review/word/route";

const input: ReviewInput = {
  title: "Public services manuscript", kind: "empirical", scope: "excerpt",
  text: "Methods\nA cross-sectional survey used a convenience sample of 40 participants to explore digital services and citizen satisfaction. Selection was based on availability.\nResults\nThe reported p = 0.000 proves that digital services cause better satisfaction in every community. The analysis needs inspection against the original output.\nDiscussion\nThe contribution is a description of access barriers. Further comparison with prior work is needed.",
};
const goodFinding = { reviewer: "logic", priority: "major", title: "Inspect causal language", explanation: "The design may not establish causation.", action: "Check the design and qualify the conclusion.", paragraph: 4, quote: "The reported p = 0.000 proves that digital services cause better satisfaction in every community." };

test("screening covers all reviewer areas without treating an excerpt as complete", () => {
  const report = screenManuscript(input);
  assert.equal(report.mode, "screening");
  assert.equal(report.scope, "excerpt");
  assert.ok(report.findings.some(f => f.reviewer === "statistics" && f.priority === "major"));
  assert.ok(report.notices.some(n => /Only the supplied excerpt/.test(n)));
  assert.equal("score" in report, false);
  for (const f of report.findings) if (f.evidence) assert.ok(input.text.includes(f.evidence.quote));
});
test("valid p-value is not flagged as a zero probability", () => {
  const report = screenManuscript({ ...input, text: input.text.replace("0.000", "0.005") });
  assert.equal(report.findings.some(f => /zero-valued/.test(f.title)), false);
});
test("theoretical and qualitative work is not required to use quantitative statistics", () => {
  assert.equal(screenManuscript({ ...input, kind: "theoretical", text: input.text.replace(/p = 0.000/, "a conceptual argument") }).findings.some(f => f.reviewer === "statistics"), false);
  assert.equal(screenManuscript({ ...input, text: input.text + "\nThis is a qualitative thematic study." }).findings.some(f => /uncertainty/.test(f.title)), false);
});
test("rejects empty, invalid and oversized input instead of truncating", () => {
  for (const value of [null, {}, { ...input, text: "short" }, { ...input, text: "a".repeat(60_001) }, { ...input, scope: "invented" }, { ...input, kind: "invented" }]) assert.throws(() => validateReviewInput(value));
});
test("AI validator rejects fabricated quotations, wrong paragraph IDs, invalid reviewers and duplicates", () => {
  const parsed = parseAiFindings(JSON.stringify({ findings: [goodFinding, goodFinding, { ...goodFinding, paragraph: 1 }, { ...goodFinding, quote: "This passage was never in the manuscript." }, { ...goodFinding, reviewer: "certifier" }] }), input.text);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.rejected, 4);
  assert.equal(parsed.findings[0].evidence?.paragraph, 4);
  assert.throws(() => parseAiFindings('{"score":100}', input.text));
  assert.equal(parseAiFindings(JSON.stringify({ findings: [null, { ...goodFinding, title: "a".repeat(181) }] }), input.text).rejected, 2);
});
test("no provider never calls AI or labels screening as AI", async () => {
  const report = await reviewWithAi(input, { configured: () => [], generate: async () => { throw new Error("must not run"); } });
  assert.equal(report.mode, "screening");
  assert.match(report.notices[0], /no provider/);
});
test("AI response keeps attribution and safely falls back on malformed or unanchored output", async () => {
  const dependency = (text: string) => ({ configured: () => ["openrouter" as const], generate: async () => ({ text, provider: "openrouter" as const, model: "test-fixture" }) });
  const valid = await reviewWithAi(input, dependency(JSON.stringify({ findings: [goodFinding] })));
  assert.equal(valid.mode, "ai-assisted");
  assert.equal(valid.provider, "openrouter");
  assert.equal(valid.findings.filter(f => f.origin === "ai").length, 1);
  for (const response of ["not JSON", '{"findings":[]}', JSON.stringify({ findings: [{ ...goodFinding, quote: "Made up passage with no source." }] })]) assert.equal((await reviewWithAi(input, dependency(response))).mode, "screening");
  assert.equal((await reviewWithAi(input, { configured: () => ["openrouter"], generate: async () => null })).mode, "screening");
});
test("exports preserve scope, evidence, notices and author-only checklist status", () => {
  const report = screenManuscript(input);
  const text = reviewMarkdown(report, [report.findings[0].id]);
  assert.match(text, /Scope: excerpt/);
  assert.match(text, /addressed \(not independently verified\)/);
  assert.match(text, /Paragraph 4/);
  assert.match(text, /not journal peer review/);
});
test("streamed request size is checked without content-length", async () => {
  await assert.rejects(readReviewBody(new Request("http://localhost", { method: "POST", body: "a".repeat(100) }), 20), /too large/);
  assert.equal(new TextDecoder().decode(await readReviewBody(new Request("http://localhost", { method: "POST", body: "valid" }), 20)), "valid");
});
test("API requires explicit consent and handles malformed input", async () => {
  const noConsent = await reviewPost(new Request("http://localhost/api/manuscript-review", { method: "POST", body: JSON.stringify(input), headers: { "x-forwarded-for": "review-test-consent" } }));
  assert.equal(noConsent.status, 400);
  assert.match((await noConsent.json()).error, /share/);
  assert.match(noConsent.headers.get("cache-control") || "", /no-store/);
  const malformed = await reviewPost(new Request("http://localhost/api/manuscript-review", { method: "POST", body: "{", headers: { "x-forwarded-for": "review-test-json" } }));
  assert.equal(malformed.status, 400);
});
test("document upload extracts text, rejects unsupported files and rejects empty/scanned content", async () => {
  for (const [name, content, expected] of [["manuscript.txt", input.text, 200], ["manuscript.exe", input.text, 400], ["empty.txt", "", 422]] as const) {
    const form = new FormData(); form.set("file", new File([content], name, { type: "text/plain" }));
    const result = await extractPost(new Request("http://localhost/api/manuscript-review/extract", { method: "POST", body: form, headers: { "x-forwarded-for": "review-extract-test" } }));
    assert.equal(result.status, expected);
    if (expected === 200) assert.equal((await result.json()).text, input.text);
  }
});
test("Word export produces a real DOCX and document import reads it back", async () => {
  const text = reviewMarkdown(screenManuscript(input));
  const response = await wordPost(new Request("http://localhost/api/manuscript-review/word", { method: "POST", body: JSON.stringify({ text }), headers: { "x-forwarded-for": "review-word-test" } }));
  assert.equal(response.status, 200);
  const buffer = new Uint8Array(await response.arrayBuffer());
  assert.equal(String.fromCharCode(buffer[0], buffer[1]), "PK");
  const form = new FormData(); form.set("file", new File([buffer], "review.docx"));
  const extracted = await extractPost(new Request("http://localhost/api/manuscript-review/extract", { method: "POST", body: form, headers: { "x-forwarded-for": "review-docx-test" } }));
  assert.equal(extracted.status, 200);
  assert.match((await extracted.json()).text, /Manuscript review/);
});

test("text-based PDF import extracts the actual manuscript text", async () => {
  const line = "The manuscript describes the methods and evidence for a study of digital public services. ";
  const stream = `BT /F1 11 Tf 30 700 Td (${line.repeat(3)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 2500 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const form = new FormData(); form.set("file", new File([pdf], "manuscript.pdf", { type: "application/pdf" }));
  const response = await extractPost(new Request("http://localhost/api/manuscript-review/extract", { method: "POST", body: form, headers: { "x-forwarded-for": "review-pdf-test" } }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.match(result.text, /methods and evidence/);
});

test("oversized extracted text is rejected without truncation", async () => {
  const form = new FormData(); form.set("file", new File(["a".repeat(60_001)], "long.txt"));
  const response = await extractPost(new Request("http://localhost/api/manuscript-review/extract", { method: "POST", body: form, headers: { "x-forwarded-for": "review-long-test" } }));
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /no text was silently truncated/);
});
