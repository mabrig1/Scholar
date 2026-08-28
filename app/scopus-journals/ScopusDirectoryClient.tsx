"use client";

import { useMemo, useState } from "react";
import { scopusCostMeta, scopusDisciplines, scopusJournals, scopusSourcesUrl, type ScopusCostRoute } from "@/lib/scopus-journals";
import styles from "./scopus.module.css";

export default function ScopusDirectoryClient() {
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [costRoute, setCostRoute] = useState<ScopusCostRoute | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopusJournals.filter((journal) => {
      const matchesQuery = !q || `${journal.name} ${journal.discipline} ${journal.fieldTags.join(" ")} ${journal.publisher}`.toLowerCase().includes(q);
      const matchesDiscipline = discipline === "all" || journal.discipline === discipline;
      const matchesCost = costRoute === "all" || journal.costRoute === costRoute;
      return matchesQuery && matchesDiscipline && matchesCost;
    });
  }, [query, discipline, costRoute]);

  const zeroRouteCount = scopusJournals.filter((journal) => journal.costRoute === "diamond-open-access" || journal.costRoute === "no-mandatory-fee").length;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a href="/" className={styles.brand}>Mabrig <strong>Researcher Pro</strong></a>
        <nav className={styles.toplinks} aria-label="Journal pathways">
          <a href="/free-journals">Verified journals</a>
          <a className={styles.active} href="/scopus-journals">Scopus journals</a>
          <a href="/publishing-agent">Publishing agent</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>SEPARATE SCOPUS PATHWAY</span>
          <h1>Target Scopus journals with <em>evidence, fit and cost control.</em></h1>
          <p>
            This shortlist is kept separate from the general verified-journal directory. Each candidate includes a cost route,
            official journal link and direct Scopus Sources search—but final current coverage must be rechecked before submission.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="/publishing-agent">Build my publishing plan →</a>
            <a className={styles.secondary} href={scopusSourcesUrl()} target="_blank" rel="noreferrer">Open Scopus Sources ↗</a>
          </div>
        </div>
        <aside className={styles.protocol}>
          <span>THE FOUR-PROOF GATE</span>
          <ol>
            <li><b>Title + ISSN</b><small>Exact match in Scopus Sources</small></li>
            <li><b>Coverage status</b><small>Current, not discontinued</small></li>
            <li><b>Scope fit</b><small>Recent comparable articles</small></li>
            <li><b>True total cost</b><small>Official APC, waiver or no-fee route</small></li>
          </ol>
        </aside>
      </section>

      <section className={styles.stats} aria-label="Directory summary">
        <div><strong>{scopusJournals.length}</strong><span>curated Scopus-pathway candidates</span></div>
        <div><strong>{zeroRouteCount}</strong><span>zero-fee or no-mandatory-fee starting routes</span></div>
        <div><strong>4</strong><span>proofs required before submission</span></div>
      </section>

      <section className={styles.notice}>
        <strong>Important:</strong> Scopus states that source coverage can be discontinued and that coverage years are not a promise of continued coverage.
        Therefore, these are cost-aware candidates—not permanent indexing guarantees. Always use the official source record on the day you shortlist.
      </section>

      <section className={styles.directory}>
        <div className={styles.heading}>
          <div><span className={styles.eyebrow}>SCOPUS JOURNAL SHORTLIST</span><h2>Find a field-fit, low-cost starting route</h2></div>
          <span>{filtered.length} results</span>
        </div>

        <div className={styles.filters}>
          <label><span>Search topic or journal</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. public health, education, machine learning" /></label>
          <label><span>Discipline</span><select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="all">All disciplines</option>{scopusDisciplines.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Cost route</span><select value={costRoute} onChange={(event) => setCostRoute(event.target.value as ScopusCostRoute | "all")}><option value="all">All cost routes</option>{Object.entries(scopusCostMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
        </div>

        <div className={styles.grid}>
          {filtered.map((journal) => (
            <article className={styles.card} key={journal.id}>
              <div className={styles.cardTop}><span className={styles.scopusBadge}>SCOPUS PATHWAY</span><span className={`${styles.costBadge} ${styles[journal.costRoute]}`}>{scopusCostMeta[journal.costRoute].label}</span></div>
              <h3>{journal.name}</h3>
              <p className={styles.discipline}>{journal.discipline} · {journal.publisher}</p>
              <div className={styles.tags}>{journal.fieldTags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
              <p className={styles.costNote}>{journal.costNote}</p>
              <div className={styles.verifyBox}><strong>Required verification</strong><p>{journal.verificationNote}</p></div>
              <div className={styles.actions}>
                <a href={scopusSourcesUrl(journal.scopusSearchTerm)} target="_blank" rel="noreferrer">Check Scopus record ↗</a>
                <a href={journal.officialUrl} target="_blank" rel="noreferrer">Official journal ↗</a>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && <div className={styles.empty}>No journals match these filters. Try a broader field or open the publishing agent for a tailored pathway.</div>}
      </section>

      <section className={styles.knowledge}>
        <div><span className={styles.eyebrow}>HOW TO PUBLISH WITH MINIMAL COST</span><h2>A cost-saving strategy that does not weaken quality</h2></div>
        <div className={styles.knowledgeGrid}>
          <article><b>01</b><h3>Lead with fit</h3><p>Compare your manuscript with five recent articles. A free journal that is out of scope is still a costly rejection.</p></article>
          <article><b>02</b><h3>Use the zero-fee ladder</h3><p>Prioritize diamond OA, sponsored journals and standard subscription routes without mandatory author charges.</p></article>
          <article><b>03</b><h3>Ask before paying</h3><p>Check institutional agreements, country-based waivers and funder support before accepting an APC.</p></article>
          <article><b>04</b><h3>Prepare once, adapt carefully</h3><p>Build a clean master manuscript, then make only the scope, style and file changes required by each journal.</p></article>
        </div>
      </section>
    </main>
  );
}
