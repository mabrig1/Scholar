"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ATLAS_STORAGE_KEY,
  addAtlasClaim,
  addAtlasPaper,
  createAtlasProject,
  logAtlasSearch,
  parseAtlasProject,
  recordAtlasEvidence,
  summarizeAtlasClaim,
  type AtlasProject,
  type AtlasPaper,
  type EvidenceBasis,
  type EvidenceStance,
  type SearchArticle,
} from "@/lib/evidence-atlas";
import { analyzeAtlasGaps, renderAtlasGapReport } from "@/packages/evidence-atlas-core/src/gap-intelligence";
import { approveGroundedProposal, proposeAbstractClaims, type ClaimProposal } from "@/packages/evidence-atlas-core/src/claim-proposals";
import {
  assessAppraisalReadiness, compareOpposingAtlasEvidence, recordMethodAppraisal,
  type AtlasMethodAppraisalInput, renderMethodAppraisalReport,
} from "@/packages/evidence-atlas-core/src/method-appraisal";
import EvidenceMethodAppraisalEditor from "./EvidenceMethodAppraisalEditor";
import styles from "./evidence-atlas.module.css";

type SearchResponse = { articles?: SearchArticle[]; count?: number; error?: string; verifiedAt?: string };
const stanceOptions: Array<{ value: EvidenceStance; label: string }> = [
  { value: "supports", label: "Supports the claim" },
  { value: "contradicts", label: "Contradicts the claim" },
  { value: "mixed", label: "Mixed or qualified findings" },
  { value: "unclear", label: "Insufficient to classify" },
];
const graphColors: Record<EvidenceStance, string> = {
  supports: "#1aab86",
  contradicts: "#f47a82",
  mixed: "#eeb65c",
  unclear: "#71859f",
};

function EvidenceGraph({ project, selectedClaimId, onClaim, onPaper }: {
  project: AtlasProject;
  selectedClaimId: string;
  onClaim: (id: string) => void;
  onPaper: (id: string) => void;
}) {
  const height = Math.max(420, Math.max(project.papers.length, project.claims.length) * 76 + 120);
  const paperPositions = new Map(project.papers.map((paper, index) => [paper.id, 95 + index * 76]));
  const claimPositions = new Map(project.claims.map((claim, index) => [claim.id, 95 + index * 76]));
  if (!project.papers.length && !project.claims.length) {
    return <p className={styles.empty}>Your map will appear here. Search for papers and add a precise research claim to begin.</p>;
  }
  return (
    <div className={styles.graphScroll} tabIndex={0} aria-label="Scroll to inspect the evidence map">
      <svg className={styles.graph} viewBox={"0 0 1080 " + height} aria-label="Bipartite graph showing papers linked to researcher-reviewed claims" role="img">
        <text x="55" y="40" className={styles.graphHeading}>SOURCE PAPERS</text>
        <text x="655" y="40" className={styles.graphHeading}>RESEARCH CLAIMS</text>
        {project.evidence.map((assessment) => {
          const paperY = paperPositions.get(assessment.paperId);
          const claimY = claimPositions.get(assessment.claimId);
          if (paperY === undefined || claimY === undefined) return null;
          return (
            <g key={assessment.id}>
              <path d={"M 409 " + paperY + " C 530 " + paperY + ", 530 " + claimY + ", 655 " + claimY}
                fill="none" stroke={graphColors[assessment.stance]} strokeWidth="2.7" opacity={selectedClaimId === assessment.claimId ? 0.95 : 0.46} />
              <title>{assessment.stance + " • " + assessment.basis + " • reviewer classification"}</title>
            </g>
          );
        })}
        {project.papers.map((paper) => {
          const y = paperPositions.get(paper.id) || 95;
          return (
            <g key={paper.id} onClick={() => onPaper(paper.id)} className={styles.graphNode} role="button"
              tabIndex={0} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onPaper(paper.id); } }}
              aria-label={"Select paper " + paper.title}>
              <rect x="48" y={y - 25} width="361" height="50" rx="13" fill="#162944" stroke={paper.retracted ? "#f47a82" : "#39587a"} />
              <circle cx="70" cy={y} r="7" fill={paper.retracted ? "#f47a82" : "#76b8ee"} />
              <text x="89" y={y - 3} className={styles.nodeLabel}>{paper.title.slice(0, 42)}{paper.title.length > 42 ? "…" : ""}</text>
              <text x="89" y={y + 15} className={styles.nodeMeta}>{paper.year || "Year unavailable"} · DOI {paper.doi.slice(0, 31)}</text>
              <title>{paper.title + " • DOI " + paper.doi}</title>
            </g>
          );
        })}
        {project.claims.map((claim) => {
          const y = claimPositions.get(claim.id) || 95;
          const summary = summarizeAtlasClaim(project, claim.id);
          const selected = selectedClaimId === claim.id;
          return (
            <g key={claim.id} onClick={() => onClaim(claim.id)} className={styles.graphNode} role="button"
              tabIndex={0} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onClaim(claim.id); } }}
              aria-label={"Inspect claim " + claim.text}>
              <rect x="655" y={y - 29} width="380" height="58" rx="14" fill={selected ? "#21435d" : "#152842"}
                stroke={selected ? "#4ed9ba" : "#496083"} strokeWidth={selected ? "2.2" : "1"} />
              <text x="676" y={y - 5} className={styles.nodeLabel}>{claim.text.slice(0, 44)}{claim.text.length > 44 ? "…" : ""}</text>
              <text x="676" y={y + 15} className={styles.nodeMeta}>{summary.total} classified records · {summary.supports} support · {summary.contradicts} contradict</text>
              <title>{claim.text}</title>
            </g>
          );
        })}
        {project.evidence.length === 0 && <text x="450" y="180" className={styles.graphHint}>Add source-grounded assessments to connect the nodes →</text>}
      </svg>
    </div>
  );
}
function safeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown date" : date.toLocaleString();
}
function doiUrl(doi: string) {
  return "https://doi.org/" + encodeURIComponent(doi).replace("%2F", "/");
}
function exportProject(project: AtlasProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "evidence-atlas-" + project.id.slice(0, 8) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function downloadMethodReport(project: AtlasProject) {
  const content = renderMethodAppraisalReport(project);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "evidence-atlas-methods-review-" + project.id.slice(0, 8) + ".md";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function downloadGapAudit(project: AtlasProject) {
  const audit = analyzeAtlasGaps(project);
  const content = renderAtlasGapReport(project, audit);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "evidence-atlas-gap-audit-" + project.id.slice(0, 8) + ".md";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function EvidenceAtlasClient() {
  const currentYear = new Date().getFullYear();
  const upload = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [project, setProject] = useState<AtlasProject | null>(null);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [fromYear, setFromYear] = useState(String(currentYear - 7));
  const [toYear, setToYear] = useState(String(currentYear));
  const [results, setResults] = useState<SearchArticle[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedAt, setSearchedAt] = useState("");
  const [claimText, setClaimText] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [paperId, setPaperId] = useState("");
  const [stance, setStance] = useState<EvidenceStance>("unclear");
  const [basis, setBasis] = useState<EvidenceBasis>("abstract");
  const [excerpt, setExcerpt] = useState("");
  const [locator, setLocator] = useState("");
  const [notes, setNotes] = useState("");
  const [editingEvidenceId, setEditingEvidenceId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ATLAS_STORAGE_KEY);
      if (raw) {
        const loaded = parseAtlasProject(JSON.parse(raw));
        setProject(loaded);
        setSelectedClaimId(loaded.claims[0]?.id || "");
        setPaperId(loaded.papers[0]?.id || "");
        setQuery(loaded.question);
      }
    } catch {
      setError("Saved browser data could not be loaded. Import a valid backup, or start a new project.");
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (project) window.localStorage.setItem(ATLAS_STORAGE_KEY, JSON.stringify(project));
      else window.localStorage.removeItem(ATLAS_STORAGE_KEY);
    } catch {
      setError("Browser storage is unavailable or full. Export a JSON backup to preserve your work.");
    }
  }, [project, hydrated]);

  function commit(change: (value: AtlasProject) => AtlasProject, success: string) {
    if (!project) return;
    try {
      setProject(change(project));
      setError("");
      setNotice(success);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to update this project.");
    }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    try {
      const created = createAtlasProject(title, question);
      setProject(created);
      setQuery(created.question);
      setSelectedClaimId("");
      setResults([]);
      setError("");
      setNotice("Research map created. Add DOI-backed papers and researcher-defined claims.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to create project.");
    }
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!project || query.trim().length < 4) {
      setError("Enter a search phrase of at least four characters.");
      return;
    }
    setSearching(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        from: fromYear,
        to: toYear,
        rows: "12",
      });
      const response = await fetch("/api/research/articles?" + params, { cache: "no-store" });
      const payload: SearchResponse = await response.json();
      if (!response.ok) throw new Error(payload.error || "Scholarly search is unavailable.");
      const articles = Array.isArray(payload.articles) ? payload.articles : [];
      setResults(articles);
      setSearchedAt(payload.verifiedAt || new Date().toISOString());
      setProject(logAtlasSearch(project, query, articles.length));
      setNotice("Search completed. DOI registration checks bibliographic identity, not research findings.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to retrieve papers.");
    } finally {
      setSearching(false);
    }
  }
  function addClaim(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    try {
      const updated = addAtlasClaim(project, claimText);
      setProject(updated);
      if (updated.claims.length > project.claims.length) setSelectedClaimId(updated.claims[updated.claims.length - 1].id);
      setClaimText("");
      setNotice("Claim added as a research proposition; its evidence status is not yet established.");
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to add claim.");
    }
  }
  function approveProposal(proposal: ClaimProposal) {
    if (!project) return;
    try {
      const updated = approveGroundedProposal(project, proposal);
      const matching = updated.claims.find((claim) => claim.text.toLowerCase() === proposal.claimText.toLowerCase());
      setProject(updated);
      setSelectedClaimId(matching?.id || "");
      setPaperId(proposal.paperId);
      setBasis("abstract");
      setStance("unclear");
      setExcerpt(proposal.excerpt);
      setLocator("Abstract");
      setNotes("Extracted abstract sentence; source finding and methodological relevance not yet independently reviewed.");
      setError("");
      setNotice("Abstract excerpt approved as a research proposition only. Review the original source and classify evidence separately.");
      document.getElementById("atlas-claim-review")?.scrollIntoView({ behavior: "smooth" });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to approve this source-anchored proposition.");
    }
  }
  function addEvidence(event: FormEvent) {
    event.preventDefault();
    commit((value) => recordAtlasEvidence(value, {
      claimId: selectedClaimId, paperId, stance, basis, excerpt, locator, notes,
    }), "Assessment saved with source excerpt, review scope and research history.");
    if (project?.claims.some((c) => c.id === selectedClaimId) && project.papers.some((p) => p.id === paperId) && excerpt.trim().length >= 12) {
      setExcerpt("");
      setNotes("");
      setLocator("");
    }
  }
  function saveMethodAppraisal(evidenceId: string, input: AtlasMethodAppraisalInput) {
    if (!project) return;
    try {
      const updated = recordMethodAppraisal(project, evidenceId, input);
      setProject(updated);
      setEditingEvidenceId("");
      setError("");
      setNotice("Study context saved. No automatic study-quality rating or consensus claim was made.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to save the methodological appraisal.");
    }
  }
  function choosePaper(id: string) {
    setPaperId(id);
    setNotice("Selected source paper for your next evidence assessment.");
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 512_000) throw new Error("Backup exceeds the 500 KB import limit.");
      const imported = parseAtlasProject(JSON.parse(await file.text()));
      setProject(imported);
      setSelectedClaimId(imported.claims[0]?.id || "");
      setPaperId(imported.papers[0]?.id || "");
      setResults([]);
      setQuery(imported.question);
      setNotice("Validated research project imported. Existing browser project was replaced.");
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not import this backup.");
    } finally {
      event.target.value = "";
    }
  }
  const selectedClaim = project?.claims.find((claim) => claim.id === selectedClaimId);
  const selectedPaper = project?.papers.find((paper) => paper.id === paperId);
  const summary = useMemo(
    () => project ? summarizeAtlasClaim(project, selectedClaimId) : null,
    [project, selectedClaimId],
  );
  const assessments = useMemo(
    () => project?.evidence.filter((entry) => entry.claimId === selectedClaimId) || [],
    [project, selectedClaimId],
  );
  const gapAudit = useMemo(() => project ? analyzeAtlasGaps(project) : null, [project]);
  const comparabilityFlags = useMemo(() =>
    project ? compareOpposingAtlasEvidence(project, selectedClaimId) : [],
    [project, selectedClaimId]);
  const editingEntry = assessments.find((entry) => entry.id === editingEvidenceId);
  const proposals = useMemo(() => selectedPaper ? proposeAbstractClaims(selectedPaper, 8) : [], [selectedPaper]);
  if (!hydrated) return <main className={styles.shell}><p className={styles.loading}>Opening Evidence Atlas…</p></main>;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/"><span>MA</span> MABRIG SCHOLAR</a>
        <nav aria-label="Research navigation">
          <a href="/research-agent">Research Agent</a>
          <a href="/chapter-two">Literature Review</a>
          <a href="/chapter-four">Statistics</a>
        </nav>
      </header>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>MABRIG EVIDENCE ATLAS · EARLY-ACCESS MVP</span>
          <h1>Turn papers into a traceable landscape of evidence.</h1>
          <p>Discover DOI-backed literature, formulate precise claims, connect source excerpts and examine disagreement. No automated finding or consensus is presented as verified.</p>
        </div>
        <div className={styles.heroCard}>
          <strong>One project. One evidence map.</strong>
          <span>01 Discover academic papers</span>
          <span>02 Add research propositions</span>
          <span>03 Review source passages</span>
          <span>04 Map agreement and tension</span>
          <small>Local-first · Human-reviewed · Exportable</small>
        </div>
      </section>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      {notice && <div role="status" className={styles.notice}>{notice}</div>}
      {!project ? (
        <section className={styles.start}>
          <div>
            <span className={styles.eyebrow}>START A RESEARCH PROJECT</span>
            <h2>What question are you investigating?</h2>
            <p>The map remains on this browser until you export it. There is no cloud synchronization or shared-account access in this initial version.</p>
          </div>
          <form onSubmit={create} className={styles.form}>
            <label>Project title<input value={title} maxLength={180} onChange={(e) => setTitle(e.target.value)} required placeholder="Digital transformation and public service performance" /></label>
            <label>Research question<textarea rows={3} maxLength={600} value={question} onChange={(e) => setQuestion(e.target.value)} required placeholder="How does digital transformation relate to employee performance in Nigerian public institutions?" /></label>
            <button type="submit" className={styles.primary}>Create evidence map</button>
          </form>
          <div className={styles.importAction}>
            <button type="button" className={styles.secondary} onClick={() => upload.current?.click()}>Import an existing project</button>
            <input ref={upload} className={styles.hidden} type="file" accept=".json,application/json" onChange={importBackup} aria-label="Import Evidence Atlas JSON backup" />
          </div>
        </section>
      ) : (
        <>
          <section className={styles.projectBar}>
            <div><span className={styles.eyebrow}>ACTIVE RESEARCH PROJECT</span><h2>{project.title}</h2><p>{project.question}</p></div>
            <div className={styles.projectActions}>
              <button type="button" className={styles.secondary} onClick={() => exportProject(project)}>Export JSON backup</button>
              <button type="button" className={styles.secondary} onClick={() => downloadMethodReport(project)}>Export methods review (.md)</button>
              <button type="button" className={styles.secondary} onClick={() => upload.current?.click()}>Import project</button>
              <input ref={upload} className={styles.hidden} type="file" accept=".json,application/json" onChange={importBackup} aria-label="Import Evidence Atlas JSON backup" />
              <button type="button" className={styles.danger} onClick={() => {
                if (window.confirm("Start a new map? Export your current work first. This will replace the locally saved map.")) {
                  setProject(null); setResults([]); setTitle(""); setQuestion(""); setSelectedClaimId("");
                }
              }}>New project</button>
            </div>
          </section>
          <section className={styles.stats} aria-label="Project totals">
            <div><strong>{project.papers.length}</strong><span>Saved papers</span></div>
            <div><strong>{project.claims.length}</strong><span>Research claims</span></div>
            <div><strong>{project.evidence.length}</strong><span>Reviewed links</span></div>
            <div><strong>{project.events.length}</strong><span>Research log events</span></div>
          </section>
          <section className={styles.columns}>
            <article className={styles.panel}>
              <span className={styles.eyebrow}>01 · DISCOVER</span>
              <h2>Find academic literature</h2>
              <p className={styles.muted}>Crossref registry search, optionally enriched with OpenAlex. Metadata verification is not full-text verification.</p>
              <form className={styles.form} onSubmit={search}>
                <label>Keywords or research topic<input maxLength={300} value={query} onChange={(e) => setQuery(e.target.value)} required /></label>
                <div className={styles.two}>
                  <label>From year<input type="number" min="1900" max={currentYear} value={fromYear} onChange={(e) => setFromYear(e.target.value)} /></label>
                  <label>To year<input type="number" min="1900" max={currentYear} value={toYear} onChange={(e) => setToYear(e.target.value)} /></label>
                </div>
                <button className={styles.primary} type="submit" disabled={searching}>{searching ? "Searching registries…" : "Find papers"}</button>
              </form>
              {searchedAt && <p className={styles.subtle}>Last search: {safeDate(searchedAt)} · {results.length} retrieved</p>}
              <div className={styles.paperList}>
                {results.map((article) => {
                  const saved = project.papers.some((paper) => paper.doi === article.doi.toLowerCase());
                  return <div className={styles.paper} key={article.doi}>
                    <strong>{article.title}</strong>
                    <small>{article.year} · {article.journal} · {article.verification} {article.retracted ? " · RETRACTION FLAG" : ""}</small>
                    <div className={styles.paperActions}>
                      <a href={doiUrl(article.doi)} target="_blank" rel="noopener noreferrer">DOI ↗</a>
                      <button type="button" disabled={saved} onClick={() => commit((value) => addAtlasPaper(value, article), "Paper saved to map.")}>{saved ? "Saved ✓" : "Save paper +"}</button>
                    </div>
                  </div>;
                })}
              </div>
            </article>
            <article className={styles.panel}>
              <span className={styles.eyebrow}>02 · DEFINE</span>
              <h2>Research claims</h2>
              <p className={styles.muted}>These are propositions, not verified conclusions. A researcher must review source material before recording support or contradiction.</p>
              <form className={styles.form} onSubmit={addClaim}>
                <label>New precise claim<textarea rows={3} maxLength={500} value={claimText} onChange={(e) => setClaimText(e.target.value)} required placeholder="Financial incentives are associated with improved employee performance in public organizations." /></label>
                <button className={styles.primary} type="submit">Add claim to map</button>
              </form>
              <div className={styles.claimList}>
                {project.claims.map((claim) => {
                  const counts = summarizeAtlasClaim(project, claim.id);
                  return <button type="button" key={claim.id} onClick={() => setSelectedClaimId(claim.id)}
                    className={selectedClaimId === claim.id ? styles.activeClaim : styles.claim}>
                    <strong>{claim.text}</strong>
                    <small>{counts.total} assessments · {counts.supports} support · {counts.contradicts} contradict</small>
                    {claim.origin && <small>Abstract-grounded proposition · DOI {claim.origin.doi} · Not yet verified evidence</small>}
                  </button>;
                })}
                {!project.claims.length && <p className={styles.muted}>No claims yet. Add a proposition to start the evidence graph.</p>}
              </div>
            </article>
          </section>
          <section className={styles.panel}>
            <span className={styles.eyebrow}>02B · SOURCE-GROUNDED CANDIDATES</span>
            <h2>Propose claims from a saved paper</h2>
            <p className={styles.muted}>
              Preview extractive candidate sentences from an existing source abstract. No AI call or external
              sharing occurs. These are direct quotations, not verified study findings. Approving one creates
              a proposition and prepares the review form without automatically classifying evidence.
            </p>
            {project.papers.length ? <>
              <div className={styles.proposalPicker}>
                <label htmlFor="atlas-proposal-paper">Source paper to inspect</label>
                <select id="atlas-proposal-paper" value={paperId} onChange={(e) => setPaperId(e.target.value)}>
                  <option value="">Choose a saved paper</option>
                  {project.papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title.slice(0, 100)}</option>)}
                </select>
                {selectedPaper && <a href={doiUrl(selectedPaper.doi)} target="_blank" rel="noopener noreferrer">Verify DOI record ↗</a>}
              </div>
              {selectedPaper && !selectedPaper.abstract &&
                <p className={styles.empty}>This registry record has no abstract to extract from. Read the original paper and enter a researcher-authored claim instead.</p>}
              {selectedPaper && proposals.length === 0 && selectedPaper.abstract &&
                <p className={styles.empty}>No suitable sentence candidates found. You can still formulate a claim manually after reading the source.</p>}
              <div className={styles.proposalGrid}>
                {proposals.map((proposal) => {
                  const already = project.claims.some((claim) => claim.text.toLowerCase() === proposal.claimText.toLowerCase());
                  return <article key={proposal.id} className={styles.proposalCard}>
                    <div className={styles.proposalCardHead}>
                      <strong>{proposal.signal === "possible-result-statement" ? "Possible reported-result sentence" : "Context or hypothesis sentence"}</strong>
                      <span>Abstract characters {proposal.start}–{proposal.end}</span>
                    </div>
                    <blockquote>“{proposal.excerpt}”</blockquote>
                    <p>{proposal.caution}</p>
                    <button type="button" className={styles.secondary} disabled={already}
                      onClick={() => approveProposal(proposal)}>{already ? "Already added to map" : "Approve as research proposition"}</button>
                  </article>;
                })}
              </div>
            </> : <p className={styles.empty}>Save a DOI-backed paper from literature search before proposing source-anchored claims.</p>}
            <p className={styles.caution}>An extracted sentence may describe background literature, a hypothesis or preliminary interpretation. Its wording is never proof of support, and no consensus score is generated.</p>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.eyebrow}>03 · EXPLORE</span><h2>Interactive evidence landscape</h2></div>
              <div className={styles.legend}>
                {stanceOptions.map((option) => <span key={option.value}><i style={{ backgroundColor: graphColors[option.value] }} /> {option.value}</span>)}
              </div>
            </div>
            <p className={styles.muted}>Each colored line is a human-entered assessment of a specific paper against a specific claim. Select a claim or paper node to inspect it. Unconnected nodes have not been classified.</p>
            <EvidenceGraph project={project} selectedClaimId={selectedClaimId} onClaim={setSelectedClaimId} onPaper={choosePaper} />
          </section>
          <section className={styles.columns}>
            <article className={styles.panel} id="atlas-claim-review">
              <span className={styles.eyebrow}>04 · REVIEW</span><h2>Classify source evidence</h2>
              <p className={styles.muted}>Review the original source. Record its exact passage and whether your assessment is based on an abstract or the full text.</p>
              {selectedClaim && project.papers.length ? (
                <form className={styles.form} onSubmit={addEvidence}>
                  <div className={styles.focusClaim}><span>SELECTED CLAIM</span><strong>{selectedClaim.text}</strong></div>
                  <label>Source paper<select value={paperId} onChange={(e) => setPaperId(e.target.value)} required>
                    <option value="">Choose a saved paper</option>{project.papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title.slice(0, 70)}</option>)}
                  </select></label>
                  {selectedPaper && <p className={styles.subtle}><a href={doiUrl(selectedPaper.doi)} target="_blank" rel="noopener noreferrer">Read source DOI ↗</a>{selectedPaper.retracted ? " · Retraction signal—exercise caution." : ""}
                    {basis === "abstract" && selectedPaper.abstract ? <button type="button" className={styles.inlineButton} onClick={() => { setExcerpt(selectedPaper.abstract.slice(0, 1000)); setLocator("Crossref/OpenAlex abstract"); }}>Use retrieved abstract text</button> : null}
                  </p>}
                  <div className={styles.two}>
                    <label>Classification<select value={stance} onChange={(e) => setStance(e.target.value as EvidenceStance)}>
                      {stanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select></label>
                    <label>Reviewed material<select value={basis} onChange={(e) => setBasis(e.target.value as EvidenceBasis)}>
                      <option value="abstract">Abstract only</option><option value="full-text">Full text examined</option>
                    </select></label>
                  </div>
                  <label>Verbatim source passage or identifiable excerpt<textarea rows={4} maxLength={1500} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} required placeholder="Paste the relevant result from the actual paper. Do not invent a quotation." /></label>
                  <label>Page / section / table locator<input maxLength={120} value={locator} onChange={(e) => setLocator(e.target.value)} placeholder="Results, Table 3, p. 12, or Abstract" /></label>
                  <label>Methodological differences and limitations<textarea rows={3} maxLength={1200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Population, sample, design, statistical result or an important caveat…" /></label>
                  <button className={styles.primary} type="submit">Save reviewed assessment</button>
                  <p className={styles.subtle}>Reassessing the same paper and claim replaces that classification and records the revision.</p>
                </form>
              ) : <p className={styles.empty}>Add at least one saved paper and one claim, then select a claim to review evidence.</p>}
            </article>
            <article className={styles.panel}>
              <span className={styles.eyebrow}>05 · EVALUATE</span><h2>Evidence dossier</h2>
              {selectedClaim && summary ? <>
                <div className={styles.focusClaim}><span>SELECTED CLAIM</span><strong>{selectedClaim.text}</strong></div>
                <div className={styles.countGrid}>
                  <div><strong>{summary.supports}</strong><span>Supports</span></div>
                  <div><strong>{summary.contradicts}</strong><span>Contradicts</span></div>
                  <div><strong>{summary.mixed}</strong><span>Mixed</span></div>
                  <div><strong>{summary.unclear}</strong><span>Unclear</span></div>
                </div>
                <p className={styles.caution}>This is a count of manually classified sources, not a statistical consensus measure or a study-quality score. {summary.abstractOnly} of {summary.total} assessments are abstract-only.</p>
                {assessments.map((entry) => {
                  const paper = project.papers.find((item) => item.id === entry.paperId);
                  return <div className={styles.assessment} key={entry.id}>
                    <span className={styles.stance} style={{ borderColor: graphColors[entry.stance], color: graphColors[entry.stance] }}>{entry.stance} · {entry.basis}</span>
                    <h3>{paper?.title || "Missing source"}</h3>
                    <p>“{entry.excerpt}”</p>
                    <small>{entry.locator || "Locator not recorded"} · Reviewed {safeDate(entry.reviewedAt)}</small>
                    {entry.notes && <p className={styles.muted}>Reviewer notes: {entry.notes}</p>}
                    {paper && <a href={doiUrl(paper.doi)} target="_blank" rel="noopener noreferrer">Check source ↗</a>}
                    <div className={styles.methodsSummary}>
                      <strong>{assessAppraisalReadiness(entry).label}</strong>
                      {entry.appraisal ? <>
                        <p>Study design: {entry.appraisal.studyDesign} · Population: {entry.appraisal.population || "Not entered"}</p>
                        <p>Setting: {entry.appraisal.setting || "Not entered"} · Sample size: {entry.appraisal.sampleSize ?? "Not entered"}</p>
                        <p>Outcome measure: {entry.appraisal.outcomeMeasure || "Not entered"}</p>
                        {(entry.appraisal.effectEstimate || entry.appraisal.uncertainty) &&
                          <p>Estimate: {entry.appraisal.effectEstimate || "Not entered"} · Uncertainty: {entry.appraisal.uncertainty || "Not entered"}</p>}
                        <p>Methods checked at: {entry.appraisal.methodsLocator}</p>
                        {entry.appraisal.limitations && <p>Reviewer limitations: {entry.appraisal.limitations}</p>}
                        <p>Concern notes — selection: {entry.appraisal.selectionBias}; confounding: {entry.appraisal.confounding}; measurement: {entry.appraisal.measurementBias}; missing data: {entry.appraisal.missingData}.</p>
                      </> : <p>Add source-checked study context before treating opposing findings as comparable.</p>}
                      {assessAppraisalReadiness(entry).caveats.map((caveat) =>
                        <p className={styles.methodsCaveat} key={caveat}>{caveat}</p>)}
                      <button type="button" className={styles.inlineButton}
                        aria-expanded={editingEvidenceId === entry.id}
                        onClick={() => setEditingEvidenceId(editingEvidenceId === entry.id ? "" : entry.id)}>
                        {entry.appraisal ? "Revise methods appraisal" : "Appraise study methods"}
                      </button>
                    </div>
                  </div>;
                })}
                {editingEntry && <EvidenceMethodAppraisalEditor
                  key={editingEntry.id}
                  record={editingEntry}
                  onSave={(input) => saveMethodAppraisal(editingEntry.id, input)}
                  onCancel={() => setEditingEvidenceId("")}
                />}
                {comparabilityFlags.length > 0 && <div className={styles.comparability}>
                  <h3>Potential non-comparability — investigate before interpreting conflict</h3>
                  <p>These prompts compare reviewer-entered context for opposing classifications.
                    They do not establish statistical heterogeneity or settle contradictory findings.</p>
                  {comparabilityFlags.map((flag) => {
                    const first = project.papers.find((paper) => paper.id === flag.paperIds[0]);
                    const second = project.papers.find((paper) => paper.id === flag.paperIds[1]);
                    return <div key={flag.id} className={styles.comparabilityItem}>
                      <strong>{first?.title || "Source 1"} vs. {second?.title || "Source 2"}</strong>
                      <p>{flag.explanation}</p>
                      <small>Context flags: {flag.kinds.join(", ")}</small>
                    </div>;
                  })}
                </div>}
                {!assessments.length && <p className={styles.empty}>No reviewed evidence for this claim. Do not infer support or contradictions from titles alone.</p>}
              </> : <p className={styles.empty}>Select a claim to see its supporting, conflicting and unresolved evidence.</p>}
            </article>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>06 · RESEARCH-GAP INTELLIGENCE</span>
                <h2>Research gaps: what needs further investigation?</h2>
              </div>
              <button type="button" className={styles.secondary} onClick={() => downloadGapAudit(project)}>
                Export source-linked gap audit (.md)
              </button>
            </div>
            <p className={styles.caution}>
              These are transparent follow-up prompts based only on this project's saved papers and
              human-entered assessments. They are NOT verified gaps in the published literature,
              research quality scores or AI-generated findings.
            </p>
            {gapAudit && <>
              <div className={styles.gapSummary}>
                <div><strong>{gapAudit.totals.assessedPapers} / {gapAudit.totals.papers}</strong><span>Saved sources assessed</span></div>
                <div><strong>{gapAudit.totals.abstractOnly}</strong><span>Abstract-only links</span></div>
                <div><strong>{gapAudit.totals.unresolved}</strong><span>Mixed or unclear links</span></div>
                <div><strong>{gapAudit.totals.searchEvents}</strong><span>Logged searches</span></div>
              </div>
              {gapAudit.signals.length === 0 ?
                <p className={styles.empty}>No local review reminders triggered. This does not establish that the literature is complete or in consensus.</p> :
                <div className={styles.gapGrid}>
                  {gapAudit.signals.map((item) => (
                    <article className={styles.gapCard} key={item.id}>
                      <div className={styles.gapCardHeading}>
                        <span className={styles.gapKind}>{item.kind.replace(/-/g, " ")}</span>
                        <span className={styles.gapPriority}>{item.priority.replace(/-/g, " ")}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.observation}</p>
                      <strong>Question for the researcher</strong>
                      <p>{item.followUpQuestion}</p>
                      <strong>Next verification step</strong>
                      <p>{item.nextStep}</p>
                      {item.claimId && <button type="button" className={styles.gapInspect}
                        onClick={() => { setSelectedClaimId(item.claimId || ""); document.getElementById("atlas-claim-review")?.scrollIntoView({ behavior: "smooth" }); }}>
                        Inspect related claim
                      </button>}
                      {item.paperIds.length > 0 && <details className={styles.gapSources}>
                        <summary>Trace {item.paperIds.length} related source(s)</summary>
                        <ul>{item.paperIds.map((id) => {
                          const paper = project.papers.find((source) => source.id === id);
                          return paper && <li key={id}>
                            <a href={doiUrl(paper.doi)} target="_blank" rel="noopener noreferrer">{paper.title}</a> ({paper.year})
                          </li>;
                        })}</ul>
                      </details>}
                      <small>{item.assessmentIds.length} linked evidence records · project-scoped signal</small>
                    </article>
                  ))}
                </div>}
              <details className={styles.gapCaveats}>
                <summary>Read scientific and search-coverage limitations</summary>
                <ul>{gapAudit.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
              </details>
            </>}
          </section>
          <section className={styles.panel}>
            <span className={styles.eyebrow}>07 · REPRODUCE</span>
            <h2>Research history</h2>
            <p className={styles.muted}>A local record of project creation, registry searches, saved literature and classification changes. Export your project regularly for a portable backup.</p>
            <ol className={styles.timeline}>
              {[...project.events].reverse().slice(0, 30).map((event) => <li key={event.id}><time>{safeDate(event.at)}</time><strong>{event.action.replace(/-/g, " ")}</strong><span>{event.summary}</span></li>)}
            </ol>
          </section>
          <footer className={styles.footer}>Researcher-reviewed classifications only · No automatic consensus percentages · No cloud backup · <a href="/trust">Research integrity</a> · <a href="/privacy">Privacy</a></footer>
        </>
      )}
    </main>
  );
}
