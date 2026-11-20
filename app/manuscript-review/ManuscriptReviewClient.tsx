"use client";

import { useState } from "react";
import { manuscriptParagraphs, REVIEWERS, REVIEW_LIMIT, REVIEW_NOTICE, reviewMarkdown, screenManuscript, type ReviewInput, type ReviewReport, type ReviewerId } from "@/lib/manuscript-review";
import { normalizeResearchWorkspace, RESEARCH_WORKSPACE_STORAGE_KEY } from "@/lib/research-workspace";
import styles from "./review.module.css";

const demo = `Illustrative teaching example: Digital service access and citizen satisfaction

Abstract
This fictional excerpt demonstrates manuscript screening. It is not a report of collected research data and must not be cited as empirical evidence. The paper explores how digital public services relate to citizen satisfaction.

Methods
A cross-sectional convenience sample of 40 hypothetical respondents was used to illustrate a survey design. Participants were recruited through one online forum. A questionnaire asked about access and satisfaction, but the selection criteria and missing-data procedure are not described here.

Results and discussion
The illustrative analysis reports p = 0.000. This proves that digital services cause better satisfaction in every community. This statement deliberately overstates what a cross-sectional convenience sample can establish. A reviewer should ask for the original output and inspect the claim without inventing replacement results.

Contribution
The proposed contribution is a discussion of access barriers in digital public administration. Comparison with the existing literature is still required.`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ManuscriptReviewClient() {
  const [input, setInput] = useState<ReviewInput>({ title: "", text: "", kind: "empirical", scope: "full" });
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [selected, setSelected] = useState<ReviewerId | "overview">("overview");
  const [resolved, setResolved] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function update(next: ReviewInput) {
    setInput(next); setReport(null); setResolved([]); setError(""); setNotice(""); setConsent(false); setSelected("overview");
  }
  function workspace() {
    try {
      const stored = localStorage.getItem(RESEARCH_WORKSPACE_STORAGE_KEY);
      if (!stored) { setError("No saved manuscript profile was found. Add a title and paste your text below."); return; }
      const profile = normalizeResearchWorkspace(JSON.parse(stored));
      update({ ...input, title: profile.title, text: profile.abstract, scope: "excerpt" });
      setNotice("Loaded the saved title and abstract as an excerpt. Paste the full manuscript for a complete review.");
    } catch { setError("The saved workspace could not be read. Paste the text instead."); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError(""); setNotice("");
    if (file.size > 5_000_000) { setError("Choose a file no larger than 5 MB."); return; }
    setBusy("Extracting document text on Scholar’s server…");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/manuscript-review/extract", { method: "POST", body: form, signal: AbortSignal.timeout(65_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Document extraction failed.");
      update({ ...input, text: data.text });
      setNotice(`${file.name} loaded. Check the extracted text before review. ${data.warning || ""}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to read the file."); }
    finally { setBusy(""); }
  }
  async function run(ai: boolean) {
    setError(""); setNotice(""); setReport(null); setResolved([]); setSelected("overview");
    try {
      const baseline = screenManuscript(input);
      if (!ai) { setReport(baseline); return; }
      if (!consent) throw new Error("Choose to share the manuscript before running AI review.");
      setBusy("Reviewing eight areas with AI. This may take a few minutes…");
      const response = await fetch("/api/manuscript-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, consent }), signal: AbortSignal.timeout(305_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI review failed.");
      setReport(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Review failed. Try basic screening."); }
    finally { setBusy(""); }
  }
  async function exportWord() {
    if (!report) return;
    setBusy("Preparing Word report…"); setError("");
    try {
      const response = await fetch("/api/manuscript-review/word", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: reviewMarkdown(report, resolved) }), signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error((await response.json()).error || "Word export failed.");
      download(await response.blob(), "Scholar-Manuscript-Review.docx");
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed."); }
    finally { setBusy(""); }
  }
  const findings = report?.findings.filter(f => selected === "overview" || f.reviewer === selected) || [];
  const priority = report?.findings.filter(f => f.priority === "major") || [];

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/">MABRIG <strong>Scholar</strong></a><nav aria-label="Review navigation"><a href="/workspace">Workspace</a><a href="/evidence-atlas">Evidence Atlas</a><a href="/publishing-agent">Publishing</a></nav></header>
    <section className={styles.hero}><div><span className={styles.eyebrow}>MANUSCRIPT REVIEW STUDIO</span><h1>A clearer path<br />from draft to revision.</h1><p>Eight specialist perspectives. Traceable comments. One practical revision plan.</p></div><aside><strong>Review the evidence behind the words.</strong><p>Start with private browser screening, then choose an AI-assisted review when you need a deeper critique.</p></aside></section>
    <section className={styles.intake} aria-labelledby="prepare-heading">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>PREPARE YOUR REVIEW</span><h2 id="prepare-heading">Bring your manuscript</h2></div><div className={styles.actions}><button disabled={!!busy} onClick={workspace}>Load saved abstract</button><button disabled={!!busy} onClick={() => { update({ title: "Teaching example — digital service access", text: demo, kind: "empirical", scope: "excerpt" }); setNotice("Fictional demonstration text. It contains deliberate reporting issues for practice."); }}>Try an example</button></div></div>
      <div className={styles.fields}><label className={styles.titleField}>Manuscript title<input disabled={!!busy} value={input.title} maxLength={300} onChange={e => update({ ...input, title: e.target.value })} placeholder="Your research title" /></label><label>Manuscript type<select disabled={!!busy} value={input.kind} onChange={e => update({ ...input, kind: e.target.value as ReviewInput["kind"] })}><option value="empirical">Empirical research</option><option value="review">Literature / systematic review</option><option value="theoretical">Theoretical / conceptual work</option></select></label><label>Review scope<select disabled={!!busy} value={input.scope} onChange={e => update({ ...input, scope: e.target.value as ReviewInput["scope"] })}><option value="full">Full manuscript</option><option value="excerpt">Selected excerpt</option></select></label></div>
      <label className={styles.upload}>Import PDF, DOCX, TXT or Markdown · up to 5 MB<input aria-label="Upload manuscript" type="file" accept=".pdf,.docx,.txt,.md" disabled={!!busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /><small>Uploading sends the file to Scholar for text extraction. This feature does not save it or send it to AI. Scanned PDFs require OCR first.</small></label>
      <label className={styles.textLabel}>Manuscript text<textarea disabled={!!busy} value={input.text} rows={10} onChange={e => update({ ...input, text: e.target.value })} placeholder="Paste readable manuscript text, including references where available. Paragraphs are numbered for traceable comments." /></label>
      <div className={styles.meta}><span>{input.text.length.toLocaleString()} / {REVIEW_LIMIT.toLocaleString()} characters</span><span>Text and checklist remain in this tab until cleared or refreshed. Download your report to keep it.</span></div>
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={!!busy} onChange={e => setConsent(e.target.checked)} /><span>I am authorized to share this text and choose to send it to Scholar’s configured AI provider(s) for review. A fallback provider may be tried if the first fails. <a href="/privacy">Privacy notice</a></span></label>
      <div className={styles.actions}><button className={styles.primary} disabled={!!busy} onClick={() => void run(false)}>Run basic screening</button><button disabled={!!busy || !consent} onClick={() => void run(true)}>Run AI-assisted review</button><button disabled={!!busy} onClick={() => update({ title: "", text: "", kind: "empirical", scope: "full" })}>Clear manuscript</button></div>
      <p className={styles.note}>Basic screening runs in your browser using fixed reporting rules. AI review uses one model pass across eight areas; it is not eight independent human reviewers. Word export sends the report to Scholar for document generation.</p>
      {busy && <p role="status" className={styles.notice}>{busy}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
    <section className={styles.reviewLayout} aria-label="Review results">
      <aside className={styles.sidebar}><span className={styles.eyebrow}>REVIEW PANEL</span><button aria-pressed={selected === "overview"} onClick={() => setSelected("overview")}><strong>Editor overview</strong><small>{report ? `${report.findings.length} review items` : "Your revision plan"}</small></button>{REVIEWERS.map(r => <button key={r.id} aria-pressed={selected === r.id} onClick={() => setSelected(r.id)}><strong>{r.name}</strong><small>{report ? `${report.findings.filter(f => f.reviewer === r.id).length} items` : r.focus}</small></button>)}</aside>
      <div className={styles.results}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{report ? report.mode === "ai-assisted" ? "AI-ASSISTED REVIEW" : "BASIC SCREENING" : "READY WHEN YOU ARE"}</span><h2>{selected === "overview" ? "Editor overview" : REVIEWERS.find(r => r.id === selected)?.name}</h2></div>{report && <span className={styles.chip}>{resolved.length} / {report.findings.length} addressed</span>}</div>
        {!report ? <div className={styles.empty}><h3>Start with your draft.</h3><p>Paste your text or try the teaching example. Each review comment will include a passage reference or be labelled as a reporting check.</p><p>{REVIEW_NOTICE}</p></div> : <>
          <p className={styles.overview}>{report.overview}</p>
          {selected === "overview" && <><div className={styles.metrics}><div><strong>{report.wordCount.toLocaleString()}</strong><span>words reviewed</span></div><div><strong>{priority.length}</strong><span>priority items</span></div><div><strong>{report.scope === "full" ? "Full text" : "Excerpt"}</strong><span>declared scope</span></div></div><div className={styles.notice}>{report.notices.map((n, i) => <p key={i}>{n}</p>)}{report.provider && <p>Provider: {report.provider} · Model: {report.model}</p>}</div><div className={styles.actions}><button disabled={!!busy} onClick={() => void exportWord()}>Download Word report</button><button disabled={!!busy} onClick={() => download(new Blob([reviewMarkdown(report, resolved)], { type: "text/markdown;charset=utf-8" }), "Scholar-Manuscript-Review.md")}>Download text report</button><button disabled={!!busy} onClick={() => download(new Blob([JSON.stringify({ report, addressedByAuthor: resolved }, null, 2)], { type: "application/json" }), "Scholar-Manuscript-Review.json")}>Download JSON</button></div></>}
          <div className={styles.findings}>{findings.length ? [...findings].sort((a, b) => ({ major: 0, question: 1, minor: 2 }[a.priority] - { major: 0, question: 1, minor: 2 }[b.priority])).map(f => <article key={f.id} className={styles.finding}><div className={styles.findingMeta}><span>{REVIEWERS.find(r => r.id === f.reviewer)?.name}</span><span>{f.priority} · {f.origin === "ai" ? "AI suggestion" : "rule-based check"}</span></div><h3>{f.title}</h3><p>{f.explanation}</p>{f.evidence ? <blockquote><small>Paragraph {f.evidence.paragraph} · verbatim passage</small>{f.evidence.quote}</blockquote> : <p className={styles.note}>Reporting check only. No quoted passage; absence is not established.</p>}<p><strong>Next action:</strong> {f.action}</p><label className={styles.consent}><input type="checkbox" checked={resolved.includes(f.id)} onChange={e => setResolved(current => e.target.checked ? [...current, f.id] : current.filter(id => id !== f.id))} /><span>Addressed by me <small>(not independently verified)</small></span></label></article>) : <p className={styles.notice}>No finding from this pass in this area. This does not certify its quality or completeness.</p>}</div>
          <details className={styles.source}><summary>Inspect numbered source paragraphs</summary>{manuscriptParagraphs(input.text).map(p => <p key={p.number}><strong>Paragraph {p.number}.</strong> {p.text}</p>)}</details>
          <div className={styles.handoffs}><h3>Continue the checks</h3><p><a href="/evidence-atlas">Compare sources in Evidence Atlas</a> · <a href="/chapter-four">Check data in Chapter Four Lab</a> · <a href="/humanizer">Improve writing</a> · <a href="/publishing-agent">Plan journal submission</a></p></div>
        </>}
      </div>
    </section><footer className={styles.footer}>MABRIG Technologies · Researcher judgment remains essential. <a href="/trust">Research integrity</a></footer>
  </main>;
}
