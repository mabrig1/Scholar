import assert from "node:assert/strict";
import test from "node:test";
import { analyzeThesisStyle, auditRewriteIntegrity, doiTokens, headingFragments } from "../lib/thesis-style-audit";

const source = `# CHAPTER TWO

## 2.1 Conceptual Framework
The implementation of the policy was completed by the ministry, and this sentence is intentionally extended with many additional words to demonstrate that the diagnostic can identify a sentence whose length makes its central scholarly claim unnecessarily difficult for a reader to follow without pausing.

Okeke (2024) reported 62.5% agreement (Okeke, 2024). The source stated, “This verified quotation must remain unchanged.” See https://doi.org/10.1234/Example.1.`;

test("reports thesis readability and academic-style signals", () => {
  const report = analyzeThesisStyle(source);
  assert.ok(report.wordCount > 50);
  assert.ok(report.longSentenceCount >= 1);
  assert.ok(report.passiveVoiceSignals >= 1);
  assert.equal(report.citationCount, 2);
  assert.equal(report.doiCount, 1);
});

test("extracts DOI and heading protections", () => {
  assert.deepEqual(doiTokens(source), ["10.1234/example.1"]);
  assert.deepEqual(headingFragments(source), ["# CHAPTER TWO", "## 2.1 Conceptual Framework"]);
});

test("passes a rewrite that preserves protected evidence", () => {
  const rewritten = source.replace("was completed by the ministry", "the ministry completed");
  const audit = auditRewriteIntegrity(source, rewritten);
  assert.equal(audit.passed, true);
  assert.equal(audit.numbersPreserved, true);
  assert.equal(audit.quotationsPreserved, true);
});

test("rejects changed evidence, structure and quotations", () => {
  const rewritten = source
    .replace("62.5%", "65%")
    .replace("(Okeke, 2024)", "")
    .replace("## 2.1 Conceptual Framework", "## New section")
    .replace("“This verified quotation must remain unchanged.”", "The quotation changed.")
    .replace("10.1234/Example.1", "10.9999/invented");
  const audit = auditRewriteIntegrity(source, rewritten);
  assert.equal(audit.passed, false);
  assert.equal(audit.citationsPreserved, false);
  assert.equal(audit.numbersPreserved, false);
  assert.equal(audit.headingsPreserved, false);
  assert.equal(audit.quotationsPreserved, false);
  assert.equal(audit.doisPreserved, false);
});
