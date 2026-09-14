"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildAcademicIndexingMission,
  type AcademicIndexingInput,
} from "@/lib/academic-indexing-agent";
import styles from "./indexing-agent.module.css";

const initial: AcademicIndexingInput = {
  fullName: "",
  institution: "",
  institutionalEmailVerified: false,
  publicScholarProfile: false,
  orcid: "",
  title: "",
  authors: [],
  year: "",
  journal: "",
  doi: "",
  abstract: "",
  articleUrl: "",
  pdfUrl: "",
  rightsConfirmed: false,
  publicLandingPage: false,
  freeAbstractVisible: false,
  searchablePdf: false,
  oneArticlePerUrl: false,
  scholarMetaTags: false,
  robotsAllowed: false,
  titleAndAuthorsVisible: false,
  referencesPresent: false,
  canonicalUrl: false,
  sitemapIncluded: false,
  linkedFromAuthorPage: false,
  googleSearchVisible: false,
  googleScholarVisible: false,
};

const readinessChecks: Array<[keyof AcademicIndexingInput, string, string]> = [
  ["rightsConfirmed", "Sharing rights confirmed", "Use only a version you are legally allowed to make public."],
  ["publicLandingPage", "Public article landing page", "No login wall; one stable page for this paper."],
  ["freeAbstractVisible", "Complete abstract visible", "Show the author-written abstract directly on the public page."],
  ["oneArticlePerUrl", "One paper per URL", "Avoid multiple papers or multiple abstracts on the same page."],
  ["searchablePdf", "Text-searchable PDF", "Needed when you expose a full-text PDF."],
  ["titleAndAuthorsVisible", "Clear title and authors", "Title at the top; authors immediately underneath."],
  ["referencesPresent", "References section present", "Use a conventional References or Bibliography heading."],
  ["scholarMetaTags", "Scholar/Highwire tags deployed", "citation_title and one citation_author tag per author."],
  ["canonicalUrl", "Canonical URL deployed", "Keep one stable canonical landing-page address."],
  ["robotsAllowed", "Crawler access allowed", "Do not block the article page or downloadable scholarly file."],
  ["sitemapIncluded", "Added to XML sitemap", "Expose the article URL through the host site's sitemap."],
  ["linkedFromAuthorPage", "Linked from a publications page", "Use an author, institution, department or repository page."],
  ["googleSearchVisible", "Visible in Google Search", "Verify exact-title or site: search before diagnosing Scholar."],
  ["googleScholarVisible", "Visible in Google Scholar", "Confirm the exact paper title and author parsing manually."],
];

function tone(status: string) {
  if (status === "done") return styles.done;
  if (status === "current") return styles.current;
  if (status === "blocked") return styles.blocked;
  return styles.pending;
}

export default function AcademicIndexingAgentClient() {
  const [input, setInput] = useState(initial);
  const [authorsText, setAuthorsText] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("mabrig_academic_indexing_agent");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { input?: AcademicIndexingInput };
      if (!parsed.input) return;
      setInput({ ...initial, ...parsed.input });
      setAuthorsText((parsed.input.authors || []).join("\n"));
    } catch {
      // Ignore malformed local state.
    }
  }, []);

  const mission = useMemo(() => buildAcademicIndexingMission(input), [input]);

  function setField<K extends keyof AcademicIndexingInput>(key: K, value: AcademicIndexingInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function updateAuthors(value: string) {
    setAuthorsText(value);
    setField(
      "authors",
      value
        .split(/\n|;/)
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  function save() {
    localStorage.setItem(
      "mabrig_academic_indexing_agent",
      JSON.stringify({ input, savedAt: new Date().toISOString() }),
    );
    setSaved(true);
  }

  function reset() {
    setInput(initial);
    setAuthorsText("");
    setSaved(false);
    localStorage.removeItem("mabrig_academic_indexing_agent");
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>MABRIG ACADEMIC DISCOVERY AGENT</span>
            <h1>From finished paper to index-ready scholarly record.</h1>
            <p>
              A guided workflow for postgraduate researchers, early-career academics and Level 1 lecturers.
              The agent identifies the next blocker, generates Scholar-compatible metadata, builds a crawl path,
              and gives you verification links.
            </p>
          </div>
          <aside className={styles.heroCard}>
            <span>Mission progress</span>
            <strong>{mission.progress}%</strong>
            <div className={styles.progress}><i style={{ width: `${mission.progress}%` }} /></div>
            <small>Google Scholar controls final inclusion and timing. This system improves eligibility; it does not guarantee indexing.</small>
          </aside>
        </section>

        <section className={styles.notice}>
          <strong>Policy guard:</strong> This workflow intentionally does not use Google's Indexing API for academic papers.
          Google restricts that API to eligible JobPosting and livestream BroadcastEvent pages. Academic discovery is handled through
          crawlable scholarly pages, metadata, sitemaps/Search Console, repository links and verification.
        </section>

        <section className={styles.grid}>
          <div className={styles.formColumn}>
            <article className={styles.panel}>
              <span className={styles.eyebrow}>STEP 1 — RESEARCHER IDENTITY</span>
              <h2>Who owns this scholarly record?</h2>
              <div className={styles.two}>
                <label>Publishing name<input value={input.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder="e.g. Ada N. Okafor" /></label>
                <label>Institution / affiliation<input value={input.institution} onChange={(e) => setField("institution", e.target.value)} placeholder="University or research institute" /></label>
              </div>
              <label>ORCID<input value={input.orcid} onChange={(e) => setField("orcid", e.target.value)} placeholder="0000-0000-0000-0000" /></label>
              <div className={styles.checks}>
                <label className={styles.check}><input type="checkbox" checked={input.publicScholarProfile} onChange={(e) => setField("publicScholarProfile", e.target.checked)} /><span><strong>Public Google Scholar profile</strong><small>Useful for author visibility; article inclusion still depends on the scholarly content.</small></span></label>
                <label className={styles.check}><input type="checkbox" checked={input.institutionalEmailVerified} onChange={(e) => setField("institutionalEmailVerified", e.target.checked)} /><span><strong>Institutional email verified</strong><small>Use the institution's email when available.</small></span></label>
              </div>
            </article>

            <article className={styles.panel}>
              <span className={styles.eyebrow}>STEP 2 — PAPER PASSPORT</span>
              <h2>Normalize the paper metadata.</h2>
              <label>Paper title<input value={input.title} onChange={(e) => setField("title", e.target.value)} /></label>
              <label>Authors, one per line<textarea value={authorsText} onChange={(e) => updateAuthors(e.target.value)} rows={4} placeholder={"Ada N. Okafor\nBello Musa"} /></label>
              <div className={styles.three}>
                <label>Year<input value={input.year} onChange={(e) => setField("year", e.target.value)} inputMode="numeric" /></label>
                <label>Journal / repository<input value={input.journal} onChange={(e) => setField("journal", e.target.value)} /></label>
                <label>DOI, if any<input value={input.doi} onChange={(e) => setField("doi", e.target.value)} placeholder="10.xxxx/..." /></label>
              </div>
              <label>Complete author-written abstract<textarea value={input.abstract} onChange={(e) => setField("abstract", e.target.value)} rows={7} /></label>
              <label>Public article landing-page URL<input value={input.articleUrl} onChange={(e) => setField("articleUrl", e.target.value)} placeholder="https://repository.example.edu/paper/..." /></label>
              <label>Public PDF URL, if legally shareable<input value={input.pdfUrl} onChange={(e) => setField("pdfUrl", e.target.value)} placeholder="https://repository.example.edu/paper.pdf" /></label>
            </article>

            <article className={styles.panel}>
              <span className={styles.eyebrow}>STEPS 3–7 — EXECUTION EVIDENCE</span>
              <h2>Mark only what has actually been completed.</h2>
              <div className={styles.checks}>
                {readinessChecks.map(([field, label, help]) => (
                  <label className={styles.check} key={String(field)}>
                    <input
                      type="checkbox"
                      checked={Boolean(input[field])}
                      onChange={(e) => setField(field, e.target.checked as never)}
                    />
                    <span><strong>{label}</strong><small>{help}</small></span>
                  </label>
                ))}
              </div>
              <div className={styles.actions}>
                <button onClick={save}>Save mission on this device</button>
                <button className={styles.secondary} onClick={reset}>Reset</button>
              </div>
              {saved && <p className={styles.saved}>Saved locally in this browser.</p>}
            </article>
          </div>

          <aside className={styles.resultColumn}>
            <article className={styles.agentCard}>
              <span className={styles.eyebrow}>AGENT DECISION</span>
              <h2>Do this next</h2>
              <p className={styles.nextAction}>{mission.nextAction}</p>
              <div className={styles.scoreRow}><span>Scholar readiness</span><strong>{mission.readiness.score}/100</strong></div>
              <div className={styles.progress}><i style={{ width: `${mission.readiness.score}%` }} /></div>
            </article>

            <article className={styles.panel}>
              <span className={styles.eyebrow}>EXECUTION TRACE</span>
              <h2>Seven-stage indexing mission</h2>
              <div className={styles.stages}>
                {mission.stages.map((item) => (
                  <details className={`${styles.stage} ${tone(item.status)}`} key={item.id} open={item.status === "current"}>
                    <summary><span>{item.title}</span><b>{item.status}</b></summary>
                    <p>{item.summary}</p>
                    {item.blockers.length > 0 && <ul>{item.blockers.map((x) => <li key={x}>{x}</li>)}</ul>}
                    <ol>{item.actions.map((x) => <li key={x}>{x}</li>)}</ol>
                  </details>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelTitle}>
                <div><span className={styles.eyebrow}>GENERATED PACK</span><h2>Highwire / Scholar meta tags</h2></div>
                <button className={styles.smallButton} onClick={() => copy("meta", mission.highwireMetaTags)}> {copied === "meta" ? "Copied" : "Copy"} </button>
              </div>
              <pre>{mission.highwireMetaTags || "Complete the paper passport to generate metadata."}</pre>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelTitle}>
                <div><span className={styles.eyebrow}>OPTIONAL WEB DISCOVERY</span><h2>ScholarlyArticle JSON-LD</h2></div>
                <button className={styles.smallButton} onClick={() => copy("jsonld", mission.jsonLd)}> {copied === "jsonld" ? "Copied" : "Copy"} </button>
              </div>
              <pre>{mission.jsonLd}</pre>
            </article>

            <article className={styles.panel}>
              <span className={styles.eyebrow}>VERIFY</span>
              <h2>Discovery checks</h2>
              <div className={styles.links}>
                {mission.verificationLinks.length ? mission.verificationLinks.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}<span>→</span></a>
                )) : <p>Add a paper title to generate exact-title verification links.</p>}
              </div>
            </article>

            {mission.warnings.length > 0 && (
              <article className={styles.warningCard}>
                <strong>Research-integrity safeguards</strong>
                <ul>{mission.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </article>
            )}

            <p className={styles.policy}>{mission.policyNotice}</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
