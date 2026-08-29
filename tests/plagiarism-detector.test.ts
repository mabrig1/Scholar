import test from "node:test";
import assert from "node:assert/strict";
import { compareAgainstCorpus } from "../lib/plagiarism-detector";

test("detects copied academic passage with source attribution", () => {
  const copied = "Public administration depends on transparent institutions and accountable public officials who can be evaluated by citizens.";
  const report = compareAgainstCorpus(`Introduction. ${copied} This study examines governance outcomes in local institutions.`, [{ id:"a", title:"Governance Study", text:`Background material. ${copied} Further discussion follows.` }]);
  assert.ok(report.overallSimilarity > 0);
  assert.ok(report.matches.some(m => m.sourceTitle === "Governance Study" && m.kind === "verbatim"));
});

test("excludes bibliography from assessed similarity", () => {
  const report = compareAgainstCorpus("This original discussion contains enough words to form an academic sentence about governance and development.\nReferences\nSmith, J. (2024). Governance and development in public institutions.", [{id:"r",title:"Reference",text:"Smith, J. (2024). Governance and development in public institutions."}]);
  assert.ok(report.excludedBibliographyWords > 0);
  assert.equal(report.matches.length, 0);
});

test("does not invent matches when corpus is unrelated", () => {
  const report = compareAgainstCorpus("Agricultural extension services can improve adoption when farmers receive timely locally relevant information and practical demonstrations.", [{id:"x",title:"Physics",text:"Quantum fields describe particles through excitations and mathematical operators in relativistic physical systems."}]);
  assert.equal(report.overallSimilarity, 0);
  assert.equal(report.matches.length, 0);
});
