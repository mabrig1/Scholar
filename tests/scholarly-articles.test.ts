import assert from "node:assert/strict";
import test from "node:test";
import {
  apa7Reference,
  authorYearLabel,
  buildChapterTwoOutline,
  crossrefItemToArticle,
  deduplicateArticlesByTitle,
  normalizeDoi,
  reconstructOpenAlexAbstract,
} from "../lib/scholarly-articles";

const article = crossrefItemToArticle({
  DOI: "https://doi.org/10.1234/Example.1",
  title: ["A useful <i>research</i> article"],
  author: [{ given: "Ada N.", family: "Okeke" }, { given: "John", family: "Doe" }],
  published: { "date-parts": [[2024, 5, 1]] },
  "container-title": ["Journal of Useful Studies"],
  volume: "12",
  issue: "2",
  page: "10-20",
  "is-referenced-by-count": 7,
});

test("normalizes DOI URLs and Crossref records", () => {
  assert.equal(normalizeDoi("DOI: https://doi.org/10.1234/ABC.2."), "10.1234/abc.2");
  assert.ok(article);
  assert.equal(article.title, "A useful research article");
  assert.equal(article.year, 2024);
  assert.equal(article.citationCount, 7);
});

test("formats author labels and APA 7 references", () => {
  assert.ok(article);
  assert.equal(authorYearLabel(article), "Okeke and Doe (2024)");
  assert.equal(
    apa7Reference(article),
    "Okeke, A. N., & Doe, J. (2024). A useful research article. Journal of Useful Studies, 12(2), 10-20. https://doi.org/10.1234/example.1",
  );
});

test("reconstructs OpenAlex inverted abstracts in word order", () => {
  assert.equal(reconstructOpenAlexAbstract({ Results: [2], The: [0], study: [1], matter: [3] }), "The study Results matter");
});

test("deduplicates repeated article titles even when DOI records differ", () => {
  assert.ok(article);
  const duplicate = { ...article, doi: "10.1234/duplicate", year: 2025 };
  assert.equal(deduplicateArticlesByTitle([article, duplicate]).length, 1);
});

test("builds an evidence-bound chapter outline with real DOI references", () => {
  assert.ok(article);
  const outline = buildChapterTwoOutline({ topic: "digital governance", concepts: "e-governance, service delivery", theories: "Technology Acceptance Model", objectives: "Assess service delivery" }, [article]);
  assert.match(outline, /2\.2\.1 e-governance/);
  assert.match(outline, /Technology Acceptance Model/);
  assert.match(outline, /Extract and verify from the full article/);
  assert.match(outline, /https:\/\/doi\.org\/10\.1234\/example\.1/);
});
