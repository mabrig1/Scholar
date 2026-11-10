"use client";

import { type FormEvent, useState } from "react";
import type { AtlasEvidence } from "@/lib/evidence-atlas";
import {
  BIAS_NOTES, SAMPLING_METHODS, STUDY_DESIGNS,
  type AtlasMethodAppraisalInput, type BiasNote, type SamplingMethod, type StudyDesign,
} from "@/packages/evidence-atlas-core/src/method-appraisal";
import styles from "./method-appraisal.module.css";

const biasLabels: Record<BiasNote, string> = {
  "not-reviewed": "Not assessed",
  "no-concern-noted": "No concern noted in this review",
  "potential-concern": "Possible concern — inspect source",
  "major-concern-noted": "Major concern noted by reviewer",
};
const studyLabels: Record<StudyDesign, string> = {
  "not-reported": "Not reported / not established",
  "randomized-trial": "Randomized controlled trial",
  "quasi-experimental": "Quasi-experimental",
  "cohort": "Cohort / longitudinal",
  "case-control": "Case–control",
  "cross-sectional": "Cross-sectional / survey",
  "qualitative": "Qualitative study",
  "mixed-methods": "Mixed methods",
  "systematic-review": "Systematic review / meta-analysis",
  "other": "Other (describe in notes)",
};
const samplingLabels: Record<SamplingMethod, string> = {
  "not-reported": "Not reported",
  "probability": "Probability sample",
  "non-probability": "Non-probability sample",
  "census": "Census / whole population",
  "not-applicable": "Not applicable",
};
type Editable = Omit<AtlasMethodAppraisalInput, "sourceReviewed">;
function initial(record: AtlasEvidence): Editable {
  const previous = record.appraisal;
  return {
    studyDesign: previous?.studyDesign || "not-reported",
    setting: previous?.setting || "",
    population: previous?.population || "",
    sampleSize: previous?.sampleSize ?? null,
    samplingMethod: previous?.samplingMethod || "not-reported",
    outcomeMeasure: previous?.outcomeMeasure || "",
    effectEstimate: previous?.effectEstimate || "",
    uncertainty: previous?.uncertainty || "",
    methodsLocator: previous?.methodsLocator || (record.basis === "abstract" ? "Abstract" : record.locator || ""),
    selectionBias: previous?.selectionBias || "not-reviewed",
    confounding: previous?.confounding || "not-reviewed",
    measurementBias: previous?.measurementBias || "not-reviewed",
    missingData: previous?.missingData || "not-reviewed",
    limitations: previous?.limitations || "",
  };
}
export default function EvidenceMethodAppraisalEditor({ record, onSave, onCancel }: {
  record: AtlasEvidence;
  onSave: (input: AtlasMethodAppraisalInput) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<Editable>(() => initial(record));
  const [sampleText, setSampleText] = useState(record.appraisal?.sampleSize?.toString() || "");
  const [checked, setChecked] = useState(false);
  const [clientError, setClientError] = useState("");
  function update<K extends keyof Editable>(name: K, value: Editable[K]) {
    setInput((current) => ({ ...current, [name]: value }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = sampleText.trim() ? Number(sampleText) : null;
    if (parsed !== null && (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 1_000_000_000)) {
      setClientError("Enter a valid positive sample size, or leave it unknown.");
      return;
    }
    if (input.methodsLocator.trim().length < 3) {
      setClientError("Identify where you verified these methods (section, abstract or page).");
      return;
    }
    if (!checked) {
      setClientError("Please confirm that you inspected the cited source before recording the appraisal.");
      return;
    }
    setClientError("");
    onSave({ ...input, sampleSize: parsed, sourceReviewed: checked });
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.heading}>
        <div><strong>Methodological appraisal</strong><span>Researcher-entered context, not a validated quality grade</span></div>
        <button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
      </div>
      <p className={styles.caution}>
        Current review scope: <strong>{record.basis === "abstract" ? "ABSTRACT ONLY" : "FULL TEXT REVIEWED"}</strong>.
        An abstract-only review cannot establish methods validity, risk of bias or precise results. Do not infer unavailable values.
      </p>
      <div className={styles.row}>
        <label>Study design
          <select value={input.studyDesign} onChange={(e) => update("studyDesign", e.target.value as StudyDesign)}>
            {STUDY_DESIGNS.map((option) => <option value={option} key={option}>{studyLabels[option]}</option>)}
          </select>
        </label>
        <label>Sampling approach
          <select value={input.samplingMethod} onChange={(e) => update("samplingMethod", e.target.value as SamplingMethod)}>
            {SAMPLING_METHODS.map((option) => <option value={option} key={option}>{samplingLabels[option]}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.row}>
        <label>Country / setting
          <input maxLength={250} value={input.setting} onChange={(e) => update("setting", e.target.value)} placeholder="As described by the authors" />
        </label>
        <label>Sample size (if verified)
          <input type="number" min="1" max="1000000000" step="1" value={sampleText} onChange={(e) => setSampleText(e.target.value)} placeholder="Not reported" />
        </label>
      </div>
      <label>Population studied
        <input maxLength={250} value={input.population} onChange={(e) => update("population", e.target.value)} placeholder="e.g., public-sector employees; only if reported" />
      </label>
      <label>Outcome variable and operational measure
        <input maxLength={250} value={input.outcomeMeasure} onChange={(e) => update("outcomeMeasure", e.target.value)} placeholder="What exactly was measured?" />
      </label>
      <div className={styles.row}>
        <label>Effect estimate / statistic
          <input maxLength={250} value={input.effectEstimate} onChange={(e) => update("effectEstimate", e.target.value)} placeholder="e.g., β, OR, mean difference; quote exactly" />
        </label>
        <label>Uncertainty / precision
          <input maxLength={250} value={input.uncertainty} onChange={(e) => update("uncertainty", e.target.value)} placeholder="e.g., 95% CI or uncertainty not reported" />
        </label>
      </div>
      <label>Where in the source did you check?
        <input maxLength={150} required minLength={3} value={input.methodsLocator}
          onChange={(e) => update("methodsLocator", e.target.value)} placeholder="Methods §2, Table 4, p. 9, or Abstract" />
      </label>
      <fieldset className={styles.biasSet}>
        <legend>Reviewer notes on possible bias concerns</legend>
        <p>These are descriptive observations only. They are not a formal ROB 2, ROBINS-I or GRADE assessment.</p>
        <div className={styles.row}>
          {([
            ["selectionBias", "Selection / sampling"],
            ["confounding", "Confounding"],
            ["measurementBias", "Measurement"],
            ["missingData", "Missing data"],
          ] as const).map(([key, label]) => <label key={key}>{label}
            <select value={input[key]} onChange={(e) => update(key, e.target.value as BiasNote)}>
              {BIAS_NOTES.map((choice) => <option key={choice} value={choice}>{biasLabels[choice]}</option>)}
            </select>
          </label>)}
        </div>
      </fieldset>
      <label>Limitations and contextual interpretation
        <textarea rows={3} maxLength={1200} value={input.limitations}
          onChange={(e) => update("limitations", e.target.value)} placeholder="Author-stated limitations or clearly labeled reviewer concerns. Do not invent results." />
      </label>
      <label className={styles.confirm}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>I checked this source and entered only information available in its abstract or full text.</span>
      </label>
      {clientError && <p className={styles.error} role="alert">{clientError}</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.submit}>Save methodological appraisal</button>
        <button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
