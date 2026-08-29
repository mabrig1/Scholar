"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { normalizeResearchWorkspace, RESEARCH_WORKSPACE_STORAGE_KEY } from "@/lib/research-workspace";
import { apa7Reference, authorYearLabel, type ScholarlyArticle } from "@/lib/scholarly-articles";
import styles from "./chapter-two.module.css";

type SearchResponse = {
  articles: ScholarlyArticle[];
  verifiedAt: string;
};

type DraftResponse = {
  draft: string;
  mode: "ai-assisted" | "evidence-outline";
  provider: string | null;
  references: string[];
  evidenceMatrix: Array<{ authorYear: string; title: string; journal: string; doi: string; abstractStatus: string }>;
  integrityNotice: string;
  generatedAt: string;
};

const currentYear = new Date().getUTCFullYear();
const maxSelectedArticles = 12;

export default function ChapterTwoClient() {
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const [concepts, setConcepts] = useState("");
  const [theories, setTheories] = useState("");
  const [objectives, setObjectives] = useState("");
  const [fromYear, setFromYear] = useState(currentYear - 6);
  const [toYear, setToYear] = useState(currentYear);
  const [resultCount, setResultCount] = useState(10);
  const [articles, setArticles] = useState<ScholarlyArticle[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RESEARCH_WORKSPACE_STORAGE_KEY);
      if (!stored) return;
      const workspace = normalizeResearchWorkspace(JSON.parse(stored));
      if (workspace.title) {
        setTopic(workspace.title);
        setQuery(workspace.title);
      }
      if (workspace.keywords) setConcepts(workspace.keywords);
    } catch {
      window.localStorage.removeItem(RESEARCH_WORKSPACE_STORAGE_KEY);
    }
  }, []);

  const selectedArticles = useMemo(() => {
    const selectedSet = new Set(selected);
    return articles.filter((article) => selectedSet.has(article.doi));
  }, [articles, selected]);

  async function searchArticles(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setSearchError("");
    setDraft(null);
    try {
      const params = new URLSearchParams({ q: query, from: String(fromYear), to: String(toYear), rows: String(resultCount) });
      const response = await fetch(`/api/research/articles?${params}`);
      const data = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "The scholarly search failed.");
      setArticles((current) => [...new Map([...current, ...data.articles].map((article) => [article.doi, article])).values()].slice(-60));
      setSelected((current) => {
        const additions = data.articles
          .filter((article) => !article.retracted && !current.includes(article.doi))
          .slice(0, Math.max(0, maxSelectedArticles - current.length))
          .map((article) => article.doi);
        return [...current, ...additions];
      });
      if (!topic.trim()) setTopic(query.trim());
      requestAnimationFrame(() => document.getElementById("article-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "The scholarly search failed.");
    } finally {
      setSearching(false);
    }
  }

  function toggleArticle(article: ScholarlyArticle) {
    if (article.retracted) return;
    setSelected((current) => {
      if (current.includes(article.doi)) return current.filter((doi) => doi !== article.doi);
      if (current.length >= maxSelectedArticles) {
        setSearchError(`Select no more than ${maxSelectedArticles} articles for one evidence draft.`);
        return current;
      }
      setSearchError("");
      return [...current, article.doi];
    });
  }

  async function generateChapter() {
    setGenerating(true);
    setDraftError("");
    setDraft(null);
    try {
      const response = await fetch("/api/research/chapter-two", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, concepts, theories, objectives, articles: selectedArticles }),
      });
      const data = await response.json() as DraftResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "The Chapter Two draft could not be created.");
      setDraft(data);
      requestAnimationFrame(() => document.getElementById("chapter-draft")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "The Chapter Two draft could not be created.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyDraft() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft.draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function exportWord() {
    if (!draft) return;
    setExporting(true);
    setDraftError("");
    try {
      const response = await fetch("/api/research/chapter-two/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, draft: draft.draft, integrityNotice: draft.integrityNotice }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Word export failed." }));
        throw new Error(data.error || "Word export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${topic || "chapter-two"}-literature-review.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Word export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className="container nav">
        <a className="brand researcher-brand" href="/"><span>MRP</span><strong>Mabrig Researcher Pro</strong></a>
        <nav className="actions" aria-label="Research tools"><a className="btn secondary" href="/workspace">Workspace</a><a className="btn secondary" href="/chapter-four">Analyze data</a><a className="btn secondary" href="/formatter">Format</a></nav>
      </header>

      <section className={styles.hero}>
        <div className="container">
          <span className="badge">CHAPTER TWO • VERIFIED EVIDENCE WORKFLOW</span>
          <h1>Build your literature review on articles that can be traced.</h1>
          <p className="lead">Search DOI records, confirm independent indexing, select the strongest sources, and create conceptual, theoretical and empirical-review sections without fabricated citations.</p>
          <div className={styles.flow}><span>1 · Search</span><b>→</b><span>2 · Verify</span><b>→</b><span>3 · Select</span><b>→</b><span>4 · Synthesize</span><b>→</b><span>5 · Export</span></div>
        </div>
      </section>

      <section className={`container ${styles.workspace}`}>
        <form className={styles.searchPanel} onSubmit={searchArticles}>
          <div className={styles.panelHeading}><span>1</span><div><h2>Find scholarly articles</h2><p>Search journal-article metadata registered with Crossref.</p></div></div>
          <label className={styles.wide}><span>Research topic or focused search phrase</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. e-governance and service delivery in Nigerian local government" required minLength={4} /></label>
          <div className={styles.searchOptions}>
            <label><span>From year</span><input type="number" min={1900} max={currentYear} value={fromYear} onChange={(event) => setFromYear(Number(event.target.value))} /></label>
            <label><span>To year</span><input type="number" min={fromYear} max={currentYear} value={toYear} onChange={(event) => setToYear(Number(event.target.value))} /></label>
            <label><span>Results</span><select value={resultCount} onChange={(event) => setResultCount(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select></label>
          </div>
          {searchError ? <p className={styles.error} role="alert">{searchError}</p> : null}
          <button className={styles.primaryButton} type="submit" disabled={searching}>{searching ? "Checking scholarly registries…" : "Search verified article records →"}</button>
          <p className={styles.registryNote}><strong>Verification meaning:</strong> Crossref confirms registered DOI metadata. A dual-index badge means the DOI was also found in OpenAlex. This verifies identity and traceability—not methodological quality.</p>
        </form>

        <section className={styles.setupPanel}>
          <div className={styles.panelHeading}><span>2</span><div><h2>Design the chapter</h2><p>Connect the evidence to the study variables and objectives.</p></div></div>
          <label><span>Complete study title</span><textarea rows={3} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Enter the complete thesis or project title" /></label>
          <label><span>Core concepts / variables</span><textarea rows={3} value={concepts} onChange={(event) => setConcepts(event.target.value)} placeholder="Separate concepts with commas, e.g. employee motivation, organizational performance" /></label>
          <label><span>Proposed theory or theories</span><textarea rows={3} value={theories} onChange={(event) => setTheories(event.target.value)} placeholder="e.g. Technology Acceptance Model; Institutional Theory" /></label>
          <label><span>Research objectives or questions</span><textarea rows={5} value={objectives} onChange={(event) => setObjectives(event.target.value)} placeholder="Paste the specific objectives or research questions" /></label>
        </section>
      </section>

      {articles.length ? <section className={`container ${styles.results}`} id="article-results">
        <div className={styles.resultsTop}><div><span className="badge">SOURCE LIBRARY</span><h2>Select evidence for Chapter Two</h2><p>{selected.length}/{maxSelectedArticles} selected · run additional searches for theories or concepts; new results are added to this library.</p></div><div className={styles.libraryActions}><button type="button" onClick={() => { setArticles([]); setSelected([]); setDraft(null); }}>Clear library</button><button className={styles.primaryButton} type="button" onClick={() => void generateChapter()} disabled={generating || selected.length < 3}>{generating ? "Reverifying DOI records…" : "Build Chapter Two draft →"}</button></div></div>
        {draftError ? <p className={styles.error} role="alert">{draftError}</p> : null}
        <div className={styles.articleGrid}>{articles.map((article) => (
          <article className={`${styles.articleCard} ${selected.includes(article.doi) ? styles.selected : ""} ${article.retracted ? styles.retracted : ""}`} key={article.doi}>
            <div className={styles.articleTop}>
              <label><input type="checkbox" checked={selected.includes(article.doi)} disabled={article.retracted} onChange={() => toggleArticle(article)} /><span>{article.retracted ? "Retracted signal" : selected.includes(article.doi) ? "Selected" : "Select"}</span></label>
              <span className={article.verification === "crossref-openalex" ? styles.dualBadge : styles.doiBadge}>{article.verification === "crossref-openalex" ? "CROSSREF + OPENALEX" : "DOI REGISTERED"}</span>
            </div>
            <h3>{article.title}</h3>
            <p className={styles.authors}>{authorYearLabel(article)} · {article.journal}</p>
            <div className={styles.articleFacts}><span>{article.year}</span><span>{article.citationCount} citations indexed</span><span>{article.abstract ? "Abstract available" : "Full text needed"}</span>{article.openAccess === true ? <span>Open access signal</span> : null}</div>
            {article.abstract ? <p className={styles.abstract}>{article.abstract}</p> : <p className={styles.noAbstract}>No abstract was supplied by the index. Do not state methods or findings until you read the full article.</p>}
            <p className={styles.reference}>{apa7Reference(article)}</p>
            <div className={styles.articleLinks}><a href={article.url} target="_blank" rel="noreferrer">Open DOI ↗</a>{article.openAlexId ? <a href={article.openAlexId} target="_blank" rel="noreferrer">OpenAlex record ↗</a> : null}</div>
          </article>
        ))}</div>
      </section> : null}

      {draft ? <section className={`container ${styles.draftSection}`} id="chapter-draft">
        <div className={styles.draftTop}><div><span className="badge">{draft.mode === "ai-assisted" ? "EVIDENCE-BOUND AI DRAFT" : "EVIDENCE-GUIDED OUTLINE"}</span><h2>Your Chapter Two working draft</h2><p>{draft.mode === "ai-assisted" ? `Generated with ${draft.provider}; every DOI was reverified first.` : "No AI provider was configured, so the studio produced a rigorous writing outline without inventing evidence."}</p></div><div className={styles.draftActions}><button type="button" onClick={() => void copyDraft()}>{copied ? "Copied ✓" : "Copy draft"}</button><button className={styles.primaryButton} type="button" disabled={exporting} onClick={() => void exportWord()}>{exporting ? "Building Word…" : "Export APA Word document"}</button></div></div>
        <div className={styles.integrity}><strong>Evidence boundary:</strong> {draft.integrityNotice}</div>
        <pre className={styles.draftText}>{draft.draft}</pre>
        <div className={styles.matrixBlock}><h2>Evidence verification matrix</h2><div className={styles.tableWrap}><table><thead><tr><th>Author/year</th><th>Article</th><th>Journal</th><th>Evidence status</th><th>DOI</th></tr></thead><tbody>{draft.evidenceMatrix.map((row) => <tr key={row.doi}><td>{row.authorYear}</td><td>{row.title}</td><td>{row.journal}</td><td>{row.abstractStatus}</td><td><a href={`https://doi.org/${row.doi}`} target="_blank" rel="noreferrer">{row.doi}</a></td></tr>)}</tbody></table></div></div>
      </section> : null}

      <section className={`container ${styles.guidance}`}>
        <div><h2>What a strong Chapter Two must do</h2><p>A literature review is not a procession of summaries. It should define concepts, explain the theory that connects the variables, compare methods and findings, expose contradictions, and show the precise gap your study will address.</p></div>
        <ul><li>Read the complete article—not only its title or abstract.</li><li>Use foundational sources for theories and recent studies for current evidence.</li><li>Report purpose, method, sample and findings only when the source states them.</li><li>Check every DOI, correction and retraction signal before submission.</li></ul>
      </section>
    </main>
  );
}
