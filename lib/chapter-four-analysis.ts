export type DataRow = Record<string, string>;

export type ParsedDataset = {
  headers: string[];
  rows: DataRow[];
  warnings: string[];
};

export type FrequencyRow = {
  value: string;
  frequency: number;
  percent: number;
  cumulativePercent: number;
};

export type DescriptiveResult = {
  variable: string;
  n: number;
  missing: number;
  mean: number;
  median: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
};

export type CorrelationResult = {
  x: string;
  y: string;
  n: number;
  r: number;
  pValue: number;
  strength: string;
  direction: "positive" | "negative" | "none";
};

export type RegressionResult = CorrelationResult & {
  slope: number;
  intercept: number;
  rSquared: number;
};

export type ChiSquareResult = {
  rowVariable: string;
  columnVariable: string;
  rowLevels: string[];
  columnLevels: string[];
  observed: number[][];
  expected: number[][];
  chiSquare: number;
  degreesOfFreedom: number;
  pValue: number;
  n: number;
  lowExpectedCells: number;
};

export type ReliabilityResult = {
  items: string[];
  n: number;
  alpha: number;
  interpretation: string;
};

export type LikertItemResult = DescriptiveResult & {
  decision: string;
};

export type LikertResult = {
  items: LikertItemResult[];
  grandMean: number;
  threshold: number;
  decision: string;
  reliability: ReliabilityResult | null;
};

const MISSING_VALUES = new Set(["", "na", "n/a", "null", "nil", "-", "."]);

function clampProbability(value: number) {
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.max(0, Math.min(1, value));
}

function uniqueHeaders(values: string[]) {
  const counts = new Map<string, number>();
  return values.map((raw, index) => {
    const base = raw.trim() || `Column ${index + 1}`;
    const next = (counts.get(base) || 0) + 1;
    counts.set(base, next);
    return next === 1 ? base : `${base} (${next})`;
  });
}

export function parseCsv(source: string): ParsedDataset {
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) matrix.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some((value) => value.length > 0)) matrix.push(row);
  if (matrix.length < 2) throw new Error("Add a header row and at least one data row.");

  const headers = uniqueHeaders(matrix[0]);
  const warnings: string[] = [];
  const rows = matrix.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      warnings.push(`Row ${rowIndex + 2} has ${values.length} values; ${headers.length} were expected.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""]));
  });

  return { headers, rows, warnings };
}

export function isMissing(value: unknown) {
  return value == null || MISSING_VALUES.has(String(value).trim().toLowerCase());
}

export function numericValues(rows: DataRow[], variable: string) {
  const values: number[] = [];
  let missing = 0;
  let invalid = 0;
  for (const row of rows) {
    const raw = row[variable];
    if (isMissing(raw)) {
      missing += 1;
      continue;
    }
    const value = Number(String(raw).replace(/,/g, ""));
    if (Number.isFinite(value)) values.push(value);
    else invalid += 1;
  }
  return { values, missing, invalid };
}

export function mean(values: number[]) {
  if (!values.length) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sampleVariance(values: number[]) {
  if (values.length < 2) return Number.NaN;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

export function descriptiveStatistics(rows: DataRow[], variable: string): DescriptiveResult {
  const { values, missing, invalid } = numericValues(rows, variable);
  if (!values.length) throw new Error(`${variable} has no usable numeric values.`);
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const variance = sampleVariance(values);
  return {
    variable,
    n: values.length,
    missing: missing + invalid,
    mean: mean(values),
    median,
    standardDeviation: Number.isNaN(variance) ? 0 : Math.sqrt(variance),
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
  };
}

export function frequencyTable(rows: DataRow[], variable: string): FrequencyRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[variable]?.trim();
    if (!isMissing(value)) counts.set(value, (counts.get(value) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  let cumulative = 0;
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([value, frequency]) => {
      const percent = total ? (frequency / total) * 100 : 0;
      cumulative += percent;
      return { value, frequency, percent, cumulativePercent: cumulative };
    });
}

function pairedValues(rows: DataRow[], x: string, y: string) {
  const pairs: Array<[number, number]> = [];
  for (const row of rows) {
    if (isMissing(row[x]) || isMissing(row[y])) continue;
    const left = Number(String(row[x]).replace(/,/g, ""));
    const right = Number(String(row[y]).replace(/,/g, ""));
    if (Number.isFinite(left) && Number.isFinite(right)) pairs.push([left, right]);
  }
  return pairs;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.9999999999998099;
  const shifted = value - 1;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (shifted + index + 1);
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a: number, b: number, x: number) {
  const maxIterations = 200;
  const epsilon = 3e-14;
  const floor = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    h *= d * c;
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

function twoTailedStudentP(tStatistic: number, degreesOfFreedom: number) {
  if (!Number.isFinite(tStatistic)) return 0;
  const x = degreesOfFreedom / (degreesOfFreedom + tStatistic * tStatistic);
  return clampProbability(regularizedBeta(x, degreesOfFreedom / 2, 0.5));
}

function regularizedGammaQ(shape: number, x: number) {
  if (x < 0 || shape <= 0) return Number.NaN;
  if (x === 0) return 1;
  const epsilon = 1e-14;
  const floor = 1e-300;
  if (x < shape + 1) {
    let term = 1 / shape;
    let sum = term;
    let currentShape = shape;
    for (let index = 1; index <= 200; index += 1) {
      currentShape += 1;
      term *= x / currentShape;
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * epsilon) break;
    }
    const p = sum * Math.exp(-x + shape * Math.log(x) - logGamma(shape));
    return clampProbability(1 - p);
  }
  let b = x + 1 - shape;
  let c = 1 / floor;
  let d = 1 / b;
  let h = d;
  for (let index = 1; index <= 200; index += 1) {
    const an = -index * (index - shape);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < floor) d = floor;
    c = b + an / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return clampProbability(Math.exp(-x + shape * Math.log(x) - logGamma(shape)) * h);
}

export function correlationStrength(r: number) {
  const absolute = Math.abs(r);
  if (absolute < 0.1) return "negligible";
  if (absolute < 0.3) return "weak";
  if (absolute < 0.5) return "moderate";
  if (absolute < 0.7) return "strong";
  return "very strong";
}

export function pearsonCorrelation(rows: DataRow[], x: string, y: string): CorrelationResult {
  const pairs = pairedValues(rows, x, y);
  if (pairs.length < 3) throw new Error("Pearson correlation requires at least three complete numeric pairs.");
  const xValues = pairs.map(([value]) => value);
  const yValues = pairs.map(([, value]) => value);
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  let numerator = 0;
  let xSquares = 0;
  let ySquares = 0;
  for (const [left, right] of pairs) {
    const xDifference = left - xMean;
    const yDifference = right - yMean;
    numerator += xDifference * yDifference;
    xSquares += xDifference ** 2;
    ySquares += yDifference ** 2;
  }
  if (xSquares === 0 || ySquares === 0) throw new Error("Correlation is undefined when either selected variable has no variation.");
  const r = Math.max(-1, Math.min(1, numerator / Math.sqrt(xSquares * ySquares)));
  const tStatistic = Math.abs(r) === 1 ? Number.POSITIVE_INFINITY : Math.abs(r) * Math.sqrt((pairs.length - 2) / (1 - r * r));
  return {
    x,
    y,
    n: pairs.length,
    r,
    pValue: twoTailedStudentP(tStatistic, pairs.length - 2),
    strength: correlationStrength(r),
    direction: r > 0 ? "positive" : r < 0 ? "negative" : "none",
  };
}

export function simpleLinearRegression(rows: DataRow[], predictor: string, outcome: string): RegressionResult {
  const pairs = pairedValues(rows, predictor, outcome);
  const correlation = pearsonCorrelation(rows, predictor, outcome);
  const xValues = pairs.map(([value]) => value);
  const yValues = pairs.map(([, value]) => value);
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  let crossProducts = 0;
  let xSquares = 0;
  for (const [x, y] of pairs) {
    crossProducts += (x - xMean) * (y - yMean);
    xSquares += (x - xMean) ** 2;
  }
  const slope = crossProducts / xSquares;
  return {
    ...correlation,
    slope,
    intercept: yMean - slope * xMean,
    rSquared: correlation.r ** 2,
  };
}

export function chiSquareTest(rows: DataRow[], rowVariable: string, columnVariable: string): ChiSquareResult {
  const complete = rows.filter((row) => !isMissing(row[rowVariable]) && !isMissing(row[columnVariable]));
  const rowLevels = [...new Set(complete.map((row) => row[rowVariable].trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const columnLevels = [...new Set(complete.map((row) => row[columnVariable].trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (rowLevels.length < 2 || columnLevels.length < 2) throw new Error("Chi-square requires at least two categories in each variable.");
  const rowIndex = new Map(rowLevels.map((value, index) => [value, index]));
  const columnIndex = new Map(columnLevels.map((value, index) => [value, index]));
  const observed = rowLevels.map(() => columnLevels.map(() => 0));
  for (const row of complete) observed[rowIndex.get(row[rowVariable].trim())!][columnIndex.get(row[columnVariable].trim())!] += 1;
  const rowTotals = observed.map((values) => values.reduce((sum, value) => sum + value, 0));
  const columnTotals = columnLevels.map((_, column) => observed.reduce((sum, values) => sum + values[column], 0));
  const n = complete.length;
  const expected = observed.map((values, row) => values.map((_, column) => (rowTotals[row] * columnTotals[column]) / n));
  let chiSquare = 0;
  let lowExpectedCells = 0;
  for (let row = 0; row < rowLevels.length; row += 1) {
    for (let column = 0; column < columnLevels.length; column += 1) {
      if (expected[row][column] < 5) lowExpectedCells += 1;
      chiSquare += (observed[row][column] - expected[row][column]) ** 2 / expected[row][column];
    }
  }
  const degreesOfFreedom = (rowLevels.length - 1) * (columnLevels.length - 1);
  return {
    rowVariable,
    columnVariable,
    rowLevels,
    columnLevels,
    observed,
    expected,
    chiSquare,
    degreesOfFreedom,
    pValue: regularizedGammaQ(degreesOfFreedom / 2, chiSquare / 2),
    n,
    lowExpectedCells,
  };
}

export function cronbachAlpha(rows: DataRow[], items: string[]): ReliabilityResult {
  if (items.length < 2) throw new Error("Cronbach’s alpha requires at least two item columns.");
  const complete = rows.flatMap((row) => {
    const values = items.map((item) => Number(String(row[item]).replace(/,/g, "")));
    return values.every(Number.isFinite) && items.every((item) => !isMissing(row[item])) ? [values] : [];
  });
  if (complete.length < 2) throw new Error("Cronbach’s alpha requires at least two complete responses.");
  const itemVarianceSum = items.reduce((sum, _, index) => sum + sampleVariance(complete.map((values) => values[index])), 0);
  const totalVariance = sampleVariance(complete.map((values) => values.reduce((sum, value) => sum + value, 0)));
  if (!Number.isFinite(totalVariance) || totalVariance === 0) throw new Error("Cronbach’s alpha is undefined because total scores have no variation.");
  const alpha = (items.length / (items.length - 1)) * (1 - itemVarianceSum / totalVariance);
  const interpretation = alpha >= 0.9 ? "excellent" : alpha >= 0.8 ? "good" : alpha >= 0.7 ? "acceptable" : alpha >= 0.6 ? "questionable" : alpha >= 0.5 ? "poor" : "unacceptable";
  return { items, n: complete.length, alpha, interpretation };
}

export function likertAnalysis(rows: DataRow[], items: string[], threshold = 2.5): LikertResult {
  if (!items.length) throw new Error("Select at least one Likert item.");
  const results = items.map((item) => {
    const statistics = descriptiveStatistics(rows, item);
    return { ...statistics, decision: statistics.mean >= threshold ? "Agree / accepted" : "Disagree / rejected" };
  });
  const grandMean = mean(results.map((item) => item.mean));
  let reliability: ReliabilityResult | null = null;
  if (items.length > 1) reliability = cronbachAlpha(rows, items);
  return {
    items: results,
    grandMean,
    threshold,
    decision: grandMean >= threshold ? "Overall agreement" : "Overall disagreement",
    reliability,
  };
}

export function hypothesisDecision(pValue: number, alpha = 0.05) {
  return pValue < alpha
    ? `Reject the null hypothesis (p < ${alpha}).`
    : `Fail to reject the null hypothesis (p ≥ ${alpha}).`;
}

export function formatPValue(value: number) {
  if (value < 0.001) return "< .001";
  return `= ${value.toFixed(3).replace(/^0/, "")}`;
}
