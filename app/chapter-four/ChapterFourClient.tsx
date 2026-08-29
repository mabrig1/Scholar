"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  chiSquareTest,
  descriptiveStatistics,
  formatPValue,
  frequencyTable,
  hypothesisDecision,
  likertAnalysis,
  numericValues,
  parseCsv,
  pearsonCorrelation,
  simpleLinearRegression,
  type ParsedDataset,
} from "@/lib/chapter-four-analysis";
import styles from "./chapter-four.module.css";

type AnalysisMode = "descriptive" | "likert" | "correlation" | "chi-square" | "regression";

type AnalysisOutput = {
  title: string;
  metrics: Array<{ label: string; value: string }>;
  headers: string[];
  rows: string[][];
  narrative: string;
  notes: string[];
};

const SAMPLE_CSV = `respondent,gender,department,study_hours,final_score,q1,q2,q3,q4
1,Female,Social Sciences,4,62,3,4,3,4
2,Male,Sciences,6,71,4,4,4,5
3,Female,Arts,3,58,3,3,4,3
4,Male,Sciences,8,82,5,5,4,5
5,Female,Social Sciences,7,78,4,5,4,4
6,Male,Arts,2,51,2,3,2,3
7,Female,Sciences,9,88,5,5,5,4
8,Male,Social Sciences,5,67,3,4,3,4
9,Female,Arts,6,73,4,4,4,4
10,Male,Sciences,10,91,5,5,5,5
11,Female,Social Sciences,4,64,3,4,3,3
12,Male,Arts,3,56,2,3,3,2
13,Female,Sciences,8,84,4,5,5,5
14,Male,Social Sciences,7,76,4,4,4,4
15,Female,Arts,5,69,3,4,4,3
16,Male,Sciences,9,86,5,4,5,5
17,Female,Social Sciences,6,74,4,4,3,4
18,Male,Arts,4,61,3,3,3,3
19,Female,Sciences,7,80,4,5,4,5
20,Male,Social Sciences,5,66,3,4,3,4`;

const modes: Array<{ id: AnalysisMode; label: string; detail: string }> = [
  { id: "descriptive", label: "Descriptive", detail: "Frequencies, percentages, mean and spread" },
  { id: "likert", label: "Likert & reliability", detail: "Item means, grand mean and Cronbach’s alpha" },
  { id: "correlation", label: "Correlation", detail: "Pearson r and two-tailed significance" },
  { id: "chi-square", label: "Chi-square", detail: "Association between categorical variables" },
  { id: "regression", label: "Regression", detail: "Simple linear prediction and R²" },
];

function fixed(value: number, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function resultFor(options: {
  dataset: ParsedDataset;
  mode: AnalysisMode;
  primary: string;
  secondary: string;
  likertItems: string[];
  threshold: number;
  alpha: number;
  researchQuestion: string;
}): AnalysisOutput {
  const { dataset, mode, primary, secondary, likertItems, threshold, alpha, researchQuestion } = options;
  const questionLead = researchQuestion.trim() ? `In relation to “${researchQuestion.trim()}”, ` : "";

  if (mode === "descriptive") {
    if (!primary) throw new Error("Select a variable to summarize.");
    const frequencies = frequencyTable(dataset.rows, primary);
    const numeric = numericValues(dataset.rows, primary);
    const statistics = numeric.values.length ? descriptiveStatistics(dataset.rows, primary) : null;
    const narrative = statistics
      ? `${questionLead}${statistics.n} valid responses were analyzed for ${primary}. The mean was ${fixed(statistics.mean, 2)} (SD = ${fixed(statistics.standardDeviation, 2)}), with a median of ${fixed(statistics.median, 2)} and values ranging from ${fixed(statistics.minimum, 2)} to ${fixed(statistics.maximum, 2)}. ${statistics.missing ? `${statistics.missing} missing or non-numeric response(s) were excluded.` : "No responses were excluded as missing."}`
      : `${questionLead}${frequencies.reduce((sum, row) => sum + row.frequency, 0)} valid responses were summarized for ${primary}. The most frequent category was ${frequencies.toSorted((a, b) => b.frequency - a.frequency)[0]?.value || "not available"}.`;
    return {
      title: `Descriptive analysis of ${primary}`,
      metrics: statistics ? [
        { label: "Valid N", value: String(statistics.n) },
        { label: "Mean", value: fixed(statistics.mean, 2) },
        { label: "Std. deviation", value: fixed(statistics.standardDeviation, 2) },
        { label: "Missing", value: String(statistics.missing) },
      ] : [{ label: "Valid N", value: String(frequencies.reduce((sum, row) => sum + row.frequency, 0)) }, { label: "Categories", value: String(frequencies.length) }],
      headers: [primary, "Frequency", "Percent", "Cumulative %"],
      rows: frequencies.map((row) => [row.value, String(row.frequency), fixed(row.percent, 1), fixed(row.cumulativePercent, 1)]),
      narrative,
      notes: numeric.invalid ? [`${numeric.invalid} non-numeric value(s) were omitted from numeric statistics.`] : [],
    };
  }

  if (mode === "likert") {
    const result = likertAnalysis(dataset.rows, likertItems, threshold);
    const reliabilityText = result.reliability
      ? ` Internal consistency was ${result.reliability.interpretation} (Cronbach’s α = ${fixed(result.reliability.alpha)}, complete N = ${result.reliability.n}).`
      : " Cronbach’s alpha requires at least two selected items.";
    return {
      title: "Likert-scale item analysis",
      metrics: [
        { label: "Grand mean", value: fixed(result.grandMean, 2) },
        { label: "Decision rule", value: `≥ ${fixed(threshold, 2)}` },
        { label: "Overall decision", value: result.decision },
        { label: "Cronbach’s alpha", value: result.reliability ? fixed(result.reliability.alpha) : "—" },
      ],
      headers: ["Item", "N", "Mean", "SD", "Decision"],
      rows: result.items.map((item) => [item.variable, String(item.n), fixed(item.mean, 2), fixed(item.standardDeviation, 2), item.decision]),
      narrative: `${questionLead}the ${result.items.length} selected items produced a grand mean of ${fixed(result.grandMean, 2)}, compared with the decision threshold of ${fixed(threshold, 2)}. This indicates ${result.decision.toLowerCase()} among the analyzed responses.${reliabilityText}`,
      notes: ["A high alpha supports internal consistency; it does not by itself establish validity or unidimensionality."],
    };
  }

  if (!primary || !secondary || primary === secondary) throw new Error("Select two different variables.");

  if (mode === "correlation") {
    const result = pearsonCorrelation(dataset.rows, primary, secondary);
    const decision = hypothesisDecision(result.pValue, alpha);
    return {
      title: `Pearson correlation: ${primary} and ${secondary}`,
      metrics: [
        { label: "Valid pairs", value: String(result.n) },
        { label: "Pearson r", value: fixed(result.r) },
        { label: "p (two-tailed)", value: formatPValue(result.pValue) },
        { label: "Decision", value: result.pValue < alpha ? "Reject H₀" : "Fail to reject H₀" },
      ],
      headers: ["Variables", "N", "r", "p", "Strength"],
      rows: [[`${primary} × ${secondary}`, String(result.n), fixed(result.r), formatPValue(result.pValue), `${result.strength}, ${result.direction}`]],
      narrative: `${questionLead}Pearson’s correlation showed a ${result.strength} ${result.direction} relationship between ${primary} and ${secondary}, r(${result.n - 2}) = ${fixed(result.r)}, p ${formatPValue(result.pValue)}. At α = ${fixed(alpha, 2)}, ${decision.toLowerCase()}`,
      notes: ["Correlation describes association, not causation. Check linearity, outliers and approximate normality before reporting."],
    };
  }

  if (mode === "chi-square") {
    const result = chiSquareTest(dataset.rows, primary, secondary);
    const decision = hypothesisDecision(result.pValue, alpha);
    return {
      title: `Chi-square test: ${primary} by ${secondary}`,
      metrics: [
        { label: "Valid N", value: String(result.n) },
        { label: "χ²", value: fixed(result.chiSquare) },
        { label: "df", value: String(result.degreesOfFreedom) },
        { label: "p", value: formatPValue(result.pValue) },
      ],
      headers: [primary, ...result.columnLevels, "Row total"],
      rows: result.rowLevels.map((level, rowIndex) => [
        level,
        ...result.observed[rowIndex].map(String),
        String(result.observed[rowIndex].reduce((sum, value) => sum + value, 0)),
      ]),
      narrative: `${questionLead}a chi-square test of independence ${result.pValue < alpha ? "identified a statistically significant association" : "did not identify a statistically significant association"} between ${primary} and ${secondary}, χ²(${result.degreesOfFreedom}, N = ${result.n}) = ${fixed(result.chiSquare)}, p ${formatPValue(result.pValue)}. At α = ${fixed(alpha, 2)}, ${decision.toLowerCase()}`,
      notes: result.lowExpectedCells ? [`Caution: ${result.lowExpectedCells} expected cell count(s) are below 5. Consider combining defensible categories or using an exact test.`] : ["All expected cell counts are at least 5."],
    };
  }

  const result = simpleLinearRegression(dataset.rows, primary, secondary);
  const decision = hypothesisDecision(result.pValue, alpha);
  return {
    title: `Simple regression: ${primary} predicting ${secondary}`,
    metrics: [
      { label: "Valid N", value: String(result.n) },
      { label: "R²", value: fixed(result.rSquared) },
      { label: "Slope (B)", value: fixed(result.slope) },
      { label: "p", value: formatPValue(result.pValue) },
    ],
    headers: ["Model term", "B", "Model R²", "p"],
    rows: [["Constant", fixed(result.intercept), "—", "—"], [primary, fixed(result.slope), fixed(result.rSquared), formatPValue(result.pValue)]],
    narrative: `${questionLead}simple linear regression indicated that ${primary} explained ${(result.rSquared * 100).toFixed(1)}% of the variance in ${secondary} (R² = ${fixed(result.rSquared)}). A one-unit increase in ${primary} was associated with a ${fixed(result.slope)}-unit change in ${secondary}; the fitted equation was ${secondary} = ${fixed(result.intercept)} + ${fixed(result.slope)}(${primary}), p ${formatPValue(result.pValue)}. At α = ${fixed(alpha, 2)}, ${decision.toLowerCase()}`,
    notes: ["This bivariate model does not establish causation. Inspect residuals, influential cases, linearity and homoscedasticity before final reporting."],
  };
}

export default function ChapterFourClient() {
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const deferredCsv = useDeferredValue(csvText);
  const [fileName, setFileName] = useState("sample-thesis-data.csv");
  const [mode, setMode] = useState<AnalysisMode>("descriptive");
  const [primary, setPrimary] = useState("final_score");
  const [secondary, setSecondary] = useState("study_hours");
  const [likertItems, setLikertItems] = useState(["q1", "q2", "q3", "q4"]);
  const [threshold, setThreshold] = useState(3);
  const [alpha, setAlpha] = useState(0.05);
  const [studyTitle, setStudyTitle] = useState("My Thesis");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const parsed = useMemo(() => {
    try {
      return { dataset: parseCsv(deferredCsv), error: "" };
    } catch (error) {
      return { dataset: null, error: error instanceof Error ? error.message : "Unable to read the CSV." };
    }
  }, [deferredCsv]);

  const output = useMemo(() => {
    if (!parsed.dataset) return { value: null, error: parsed.error };
    try {
      return {
        value: resultFor({ dataset: parsed.dataset, mode, primary, secondary, likertItems, threshold, alpha, researchQuestion }),
        error: "",
      };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : "The selected analysis could not be calculated." };
    }
  }, [parsed, mode, primary, secondary, likertItems, threshold, alpha, researchQuestion]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvText("");
      setFileName("Please select a CSV file");
      return;
    }
    setCsvText(await file.text());
    setFileName(file.name);
  }

  function useSample() {
    setCsvText(SAMPLE_CSV);
    setFileName("sample-thesis-data.csv");
    setPrimary("final_score");
    setSecondary("study_hours");
    setLikertItems(["q1", "q2", "q3", "q4"]);
  }

  function toggleLikert(item: string) {
    setLikertItems((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  async function copyNarrative() {
    if (!output.value) return;
    await navigator.clipboard.writeText(output.value.narrative);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function exportWord() {
    if (!output.value) return;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/analysis/chapter-four/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyTitle,
          analysisTitle: output.value.title,
          narrative: output.value.narrative,
          headers: output.value.headers,
          rows: output.value.rows,
          metrics: output.value.metrics,
          notes: output.value.notes,
          alpha,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Unable to export the report." }));
        throw new Error(body.error || "Unable to export the report.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${studyTitle || "chapter-four"}-analysis.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to export the report.");
    } finally {
      setExporting(false);
    }
  }

  const headers = parsed.dataset?.headers || [];

  return (
    <main className={styles.shell}>
      <header className="container nav">
        <a className="brand researcher-brand" href="/"><span>MRP</span><strong>Mabrig Researcher Pro</strong></a>
        <div className="actions"><a className="btn secondary" href="/workspace">Workspace</a><a className="btn secondary" href="/formatter">Format report</a></div>
      </header>

      <section className={styles.hero}>
        <div className="container">
          <span className="badge">CHAPTER FOUR • LOCAL DATA ANALYSIS</span>
          <h1>Turn your dataset into defensible thesis results.</h1>
          <p className="lead">Upload or paste CSV data, run common undergraduate and postgraduate analyses, review assumptions, and export editable tables and interpretation to Word.</p>
          <div className={styles.privacy}>Your raw dataset stays in this browser. Only the displayed summary is sent when you request a Word export.</div>
        </div>
      </section>

      <section className={`container ${styles.layout}`}>
        <aside className={styles.controls}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><span>1</span><div><h2>Load data</h2><p>CSV with headings in the first row</p></div></div>
            <label className={styles.upload}>
              <strong>{fileName}</strong><small>Choose a .csv file</small>
              <input type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} />
            </label>
            <button className={styles.textButton} type="button" onClick={useSample}>Restore sample dataset</button>
            <label className={styles.field}><span>Or paste CSV data</span><textarea rows={8} value={csvText} onChange={(event) => setCsvText(event.target.value)} spellCheck={false} /></label>
            {parsed.error ? <p className={styles.error} role="alert">{parsed.error}</p> : null}
            {parsed.dataset ? <div className={styles.datasetFacts}><strong>{parsed.dataset.rows.length}</strong><span>rows</span><strong>{parsed.dataset.headers.length}</strong><span>variables</span></div> : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><span>2</span><div><h2>Set context</h2><p>Used in the report narrative</p></div></div>
            <label className={styles.field}><span>Study title</span><input value={studyTitle} onChange={(event) => setStudyTitle(event.target.value)} maxLength={180} /></label>
            <label className={styles.field}><span>Research question or hypothesis (optional)</span><textarea rows={3} value={researchQuestion} onChange={(event) => setResearchQuestion(event.target.value)} maxLength={500} placeholder="What relationship exists between…?" /></label>
          </section>
        </aside>

        <div className={styles.main}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><span>3</span><div><h2>Choose analysis</h2><p>Select a method that matches your variables and research question</p></div></div>
            <div className={styles.modeGrid} role="tablist" aria-label="Analysis methods">
              {modes.map((item) => <button key={item.id} className={mode === item.id ? styles.activeMode : ""} type="button" role="tab" aria-selected={mode === item.id} onClick={() => setMode(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}
            </div>

            {mode === "likert" ? (
              <fieldset className={styles.itemPicker}>
                <legend>Select Likert item columns</legend>
                {headers.map((header) => <label key={header}><input type="checkbox" checked={likertItems.includes(header)} onChange={() => toggleLikert(header)} /> {header}</label>)}
              </fieldset>
            ) : (
              <div className={styles.selectGrid}>
                <label className={styles.field}><span>{mode === "regression" ? "Predictor (X)" : mode === "chi-square" ? "Row variable" : "Primary variable"}</span><select value={primary} onChange={(event) => setPrimary(event.target.value)}>{headers.map((header) => <option key={header}>{header}</option>)}</select></label>
                {mode !== "descriptive" ? <label className={styles.field}><span>{mode === "regression" ? "Outcome (Y)" : mode === "chi-square" ? "Column variable" : "Second variable"}</span><select value={secondary} onChange={(event) => setSecondary(event.target.value)}>{headers.map((header) => <option key={header}>{header}</option>)}</select></label> : null}
              </div>
            )}

            <div className={styles.optionsRow}>
              {mode === "likert" ? <label className={styles.field}><span>Likert decision threshold</span><input type="number" step="0.1" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label> : null}
              {mode === "correlation" || mode === "chi-square" || mode === "regression" ? <label className={styles.field}><span>Significance level (α)</span><select value={alpha} onChange={(event) => setAlpha(Number(event.target.value))}><option value={0.01}>0.01</option><option value={0.05}>0.05</option><option value={0.1}>0.10</option></select></label> : null}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.results}`} aria-live="polite">
            <div className={styles.resultHeading}><div><span className="badge">ANALYSIS OUTPUT</span><h2>{output.value?.title || "Results will appear here"}</h2></div>{output.value ? <div className={styles.resultActions}><button type="button" onClick={() => void copyNarrative()}>{copied ? "Copied ✓" : "Copy interpretation"}</button><button className={styles.exportButton} type="button" disabled={exporting} onClick={() => void exportWord()}>{exporting ? "Building Word…" : "Export Word report"}</button></div> : null}</div>
            {output.error ? <div className={styles.emptyState}><strong>Check the analysis setup</strong><p>{output.error}</p></div> : null}
            {output.value ? <>
              <div className={styles.metricGrid}>{output.value.metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</div>
              <div className={styles.tableWrap}><table><thead><tr>{output.value.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{output.value.rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{cell}</td>)}</tr>)}</tbody></table></div>
              <article className={styles.interpretation}><span>CHAPTER FOUR INTERPRETATION</span><p>{output.value.narrative}</p></article>
              {output.value.notes.map((note) => <p className={styles.caution} key={note}><strong>Reporting note:</strong> {note}</p>)}
              {parsed.dataset?.warnings.map((warning) => <p className={styles.caution} key={warning}><strong>Data note:</strong> {warning}</p>)}
              {exportError ? <p className={styles.error} role="alert">{exportError}</p> : null}
            </> : null}
          </section>

          {parsed.dataset ? <section className={styles.panel}><div className={styles.panelHead}><span>4</span><div><h2>Data preview</h2><p>First five records after CSV parsing</p></div></div><div className={styles.tableWrap}><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{parsed.dataset.rows.slice(0, 5).map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{row[header] || "—"}</td>)}</tr>)}</tbody></table></div></section> : null}
        </div>
      </section>

      <section className={`container ${styles.boundary}`}>
        <h2>Use results responsibly</h2>
        <p>This lab calculates from the supplied data; it does not fabricate respondents or repair a flawed study design. Confirm coding, missing-data rules, assumptions and interpretation with your supervisor or statistician before examination or publication.</p>
      </section>
    </main>
  );
}
