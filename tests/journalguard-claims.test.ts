import test from "node:test";
import assert from "node:assert/strict";
import { buildJournalClaimVector, CLAIM_SCHEMA_VERSION } from "../src/lib/journalguard-claims";
import { parseBoundedJson } from "../src/lib/journalguard-request";

const claim = (rows: ReturnType<typeof buildJournalClaimVector>, name: string) => {
  const match = rows.find(row => row.claim === name);
  assert.ok(match, "missing claim " + name);
  return match;
};

test("versioned claim vector never confuses ISSN checksum with identity", () => {
  assert.equal(CLAIM_SCHEMA_VERSION, "journalguard.claims.v1");
  const rows = buildJournalClaimVector({ issn: "0009-7039" }, undefined, { evidence: [] });
  assert.equal(claim(rows, "issn_checksum").status, "supported");
  assert.equal(claim(rows, "publisher_domain_authorization").status, "not_applicable");
  assert.equal(claim(rows, "scopus_journal_coverage").status, "unknown");
});
test("invalid checksum and non-HTTPS website produce narrow contradictions", () => {
  const rows = buildJournalClaimVector(
    { issn: "0009-7038", website: "http://journal.example.org" }, undefined, { evidence: [] });
  assert.equal(claim(rows, "issn_checksum").status, "contradicted");
  assert.equal(claim(rows, "website_https_scheme").status, "contradicted");
  assert.equal(claim(rows, "publisher_domain_authorization").status, "unknown");
});
test("Crossref registration supports DOI claim without a Scopus claim", () => {
  const rows = buildJournalClaimVector({ title: "Sample" }, { doi: "10.1234/test", title: "Sample" },
    { evidence: [{ source: "Crossref", url: "https://doi.org/10.1234/test", detail: "metadata returned", checkedAt: "2026-10-25T00:00:00Z" }] });
  assert.equal(claim(rows, "doi_syntax").status, "supported");
  assert.equal(claim(rows, "doi_registration").status, "supported");
  assert.deepEqual(claim(rows, "doi_registration").evidenceSources, ["Crossref"]);
  assert.equal(claim(rows, "scopus_article_indexing").status, "unknown");
});
test("agency absence does not falsely establish a nonregistered DOI", () => {
  const rows = buildJournalClaimVector({}, { doi: "10.1234/unconfirmed" },
    { evidence: [], doiAgency: { registered: false, agency: "Unknown" } });
  assert.equal(claim(rows, "doi_registration").status, "unknown");
});
test("DataCite title discrepancy asks for review instead of alleging fraud", () => {
  const rows = buildJournalClaimVector({}, { doi: "10.1234/item", title: "Submitted title" },
    { evidence: [], doiAgency: { registered: true, agency: "DataCite", title: "Another valid version" } });
  assert.equal(claim(rows, "doi_registration").status, "supported");
  assert.equal(claim(rows, "doi_title_consistency").status, "unknown");
});
test("oversized JSON is rejected with or without a Content-Length header", async () => {
  const massive = JSON.stringify({ journal: { title: "A".repeat(9000) } });
  await assert.rejects(() => parseBoundedJson(new Request("https://example.org", {
    method: "POST", body: massive
  })), { code: 413 });
  await assert.rejects(() => parseBoundedJson(new Request("https://example.org", {
    method: "POST", body: massive, headers: { "content-length": String(massive.length) }
  })), { code: 413 });
});
test("bounded parser accepts valid JSON and rejects malformed JSON", async () => {
  const result = await parseBoundedJson(new Request("https://example.org", {
    method: "POST", body: JSON.stringify({ journal: { title: "example" } })
  }));
  assert.deepEqual(result, { journal: { title: "example" } });
  await assert.rejects(() => parseBoundedJson(new Request("https://example.org", {
    method: "POST", body: "{broken"
  })), { code: 400 });
});
