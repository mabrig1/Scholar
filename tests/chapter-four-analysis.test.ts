import assert from "node:assert/strict";
import test from "node:test";
import {
  chiSquareTest,
  cronbachAlpha,
  descriptiveStatistics,
  frequencyTable,
  likertAnalysis,
  parseCsv,
  pearsonCorrelation,
  simpleLinearRegression,
} from "../lib/chapter-four-analysis";

test("parseCsv handles quoted commas, escaped quotes, and duplicate headings", () => {
  const parsed = parseCsv('Name,Comment,Name\nAda,"Clear, useful",A\nBen,"Said ""yes""",B\n');
  assert.deepEqual(parsed.headers, ["Name", "Comment", "Name (2)"]);
  assert.equal(parsed.rows[0].Comment, "Clear, useful");
  assert.equal(parsed.rows[1].Comment, 'Said "yes"');
});

test("descriptive and frequency summaries use valid observations", () => {
  const rows = parseCsv("score,group\n1,A\n2,A\n3,B\n4,B\n, B").rows;
  const stats = descriptiveStatistics(rows, "score");
  assert.equal(stats.n, 4);
  assert.equal(stats.missing, 1);
  assert.equal(stats.mean, 2.5);
  assert.ok(Math.abs(stats.standardDeviation - 1.290994449) < 1e-8);
  assert.deepEqual(frequencyTable(rows, "group").map(({ value, frequency }) => ({ value, frequency })), [
    { value: "A", frequency: 2 },
    { value: "B", frequency: 3 },
  ]);
});

test("Pearson correlation and simple regression recover a perfect line", () => {
  const rows = parseCsv("x,y\n1,3\n2,5\n3,7\n4,9\n5,11").rows;
  const correlation = pearsonCorrelation(rows, "x", "y");
  const regression = simpleLinearRegression(rows, "x", "y");
  assert.ok(Math.abs(correlation.r - 1) < 1e-12);
  assert.equal(correlation.pValue, 0);
  assert.ok(Math.abs(regression.slope - 2) < 1e-12);
  assert.ok(Math.abs(regression.intercept - 1) < 1e-12);
  assert.ok(Math.abs(regression.rSquared - 1) < 1e-12);
});

test("chi-square returns the expected statistic and probability", () => {
  const lines = ["treatment,outcome"];
  for (let index = 0; index < 10; index += 1) lines.push("A,Yes", "B,No");
  for (let index = 0; index < 20; index += 1) lines.push("A,No", "B,Yes");
  const result = chiSquareTest(parseCsv(lines.join("\n")).rows, "treatment", "outcome");
  assert.ok(Math.abs(result.chiSquare - 6.666666667) < 1e-8);
  assert.equal(result.degreesOfFreedom, 1);
  assert.ok(Math.abs(result.pValue - 0.009823275) < 1e-6);
});

test("Likert analysis includes item decisions and reliability", () => {
  const rows = parseCsv("q1,q2,q3\n1,2,3\n2,3,4\n3,4,5\n4,5,6").rows;
  const reliability = cronbachAlpha(rows, ["q1", "q2", "q3"]);
  const likert = likertAnalysis(rows, ["q1", "q2", "q3"], 3);
  assert.ok(Math.abs(reliability.alpha - 1) < 1e-12);
  assert.equal(likert.grandMean, 3.5);
  assert.equal(likert.decision, "Overall agreement");
  assert.equal(likert.reliability?.interpretation, "excellent");
});
