"use client";

import { useMemo, useState } from "react";
import { curatedCategories, curatedJournals, CuratedJournal, CuratedStatus } from "@/lib/curated-journals";
import styles from "./page.module.css";

type LiveCheck = {
  score: number;
  status: "verified-evidence" | "established-evidence" | "caution";
  evidence: string[];
  cautions: string[];
  checkedAt: string;
};

const statusMeta: Record<CuratedStatus, { label: string; help: string }> = {
  "verified-zero-fee": {
    label: "Verified zero-fee",
    help: "A current official source explicitly states that publication is free.",
  },
  "known-apc": {
    label: "APC currently applies",
    help: "Current evidence indicates a publication charge applies to at least the standard research route.",
  },
  conditional: {
    label: "Conditional / waiver route",
    help: "Cost-free publication may depend on funding, institution, country, article type or a waiver.",
  },
  repository: {
    label: "Repository / preprint",
    help: "Useful for dissemination, but not equivalent to peer-reviewed journal publication.",
  },
  archived: {
    label: "Archived / mixed entry",
    help: "This item is discontinued, mixed with another service, or otherwise needs correction before use.",
  },
  "verify-current": {
    label: "Recheck current policy",
    help: "A useful candidate, but its current APC/indexing status should be verified before submission.",
  },
};

export default function DirectoryClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<CuratedStatus | "all">("all");
  const [kind, setKind] = useState("all");
  const [checks, setChecks] = useState<Record<number, LiveCheck>>({});
  const [checking, setChecking] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return curatedJournals.filter((item) => {
      const matchesText = !q || `${item.name} ${item.category} ${item.note}`.toLowerCase().includes(q);
      const matchesCategory = category === "all" || item.category === category;
      const matchesStatus = status === "all" || item.status === status;
      const matchesKind = kind === "all" || item.kind === kind;
      return matchesText && matchesCategory && matchesStatus && matchesKind;
    });
  }, [query, category, status, kind]);

  const counts = useMemo(() => {
    return curatedJournals.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      {
        "verified-zero-fee": 0,
        "known-apc": 0,
        conditional: 0,
        repository: 0,
        archived: 0,
        "verify-current": 0,
      } as Record<CuratedStatus, number>,
    );
  }, []);

  async function liveVerify(item: CuratedJournal) {
    setChecking(item.id);
    setErrors((previous) => ({ ...previous, [item.id]: "" }));
    try {
      const response = await fetch(`/api/verify?title=${encodeURIComponent(item.name)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Live verification failed.");
      setChecks((previous) => ({ ...previous, [item.id]: data }));
    } catch (error) {
      setErrors((previous) => ({
        ...previous,
        [item.id]: error instanceof Error ? error.message : "Live verification failed.",
      }));
    } finally {
      setChecking(null);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a href="/" className={styles.brand}>Mabrig <strong>Researcher Pro</strong></a>
        <div className={styles.toplinks}>
          <a href="#directory">Verified journals</a>
          <a href="/scopus-journals">Scopus journals</a>
          <a href="/publishing-agent">Publishing agent</a>
        </div>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>EVIDENCE-AWARE JOURNAL DIRECTORY</span>
        <h1>Verified journal candidates — <em>now clearly separated from the Scopus pathway.</em></h1>
        <p>
          A curated starting point across major disciplines, upgraded with fee-risk labels, platform-vs-journal distinctions,
          live registry checks and clear warnings when a policy needs re-verification. Scopus-targeted journals now have a dedicated directory and technical agent.
        </p>
        <div className={styles.heroActions}>
          <a href="#directory" className={styles.primary}>Explore the directory ↓</a>
          <a href="/scopus-journals" className={styles.secondary}>Open Scopus pathway →</a>
          <a href="/publishing-agent" className={styles.secondary}>Build my publishing plan →</a>
        </div>
      </section>

      <section className={styles.factStrip}>
        <div><strong>{curatedJournals.length}</strong><span>curated verified-journal candidates</span></div>
        <div><strong>{counts["verified-zero-fee"]}</strong><span>officially confirmed zero-fee in this curated set</span></div>
        <div><strong>{counts["known-apc"]}</strong><span>known current APC corrections</span></div>
        <div><strong>{counts.repository + counts.archived}</strong><span>repository / archived entries separated from journals</span></div>
      </section>

      <section className={styles.warning}>
        <strong>Why this directory is different:</strong> fee policies, waiver rules and indexing change. A journal is never labelled
        “free” simply because an old list said so. Use the live check, then confirm the journal’s official author-guidelines page before paying or submitting.
        For Scopus-specific targeting, use the separate <a href="/scopus-journals">Scopus journal pathway</a> and verify current coverage in Scopus Sources.
      </section>

      <section id="directory" className={styles.directory}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>CURATED DIRECTORY</span>
            <h2>Filter by discipline, publication type and fee confidence</h2>
          </div>
          <span className={styles.resultCount}>{filtered.length} results</span>
        </div>

        <div className={styles.filters}>
          <label>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="journal, field, publisher clue…" />
          </label>
          <label>
            <span>Discipline</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All disciplines</option>
              {curatedCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Fee confidence</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as CuratedStatus | "all")}>
              <option value="all">All statuses</option>
              {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </label>
          <label>
            <span>Publication type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="all">All types</option>
              <option value="journal">Peer-reviewed journal candidate</option>
              <option value="platform">Publishing platform</option>
              <option value="repository">Repository / preprint</option>
            </select>
          </label>
        </div>

        <div className={styles.legend}>
          {Object.entries(statusMeta).map(([value, meta]) => (
            <button key={value} onClick={() => setStatus(value as CuratedStatus)} title={meta.help} className={`${styles.legendItem} ${styles[value]}`}>
              {meta.label}
            </button>
          ))}
          <button onClick={() => setStatus("all")} className={styles.clear}>Clear status filter</button>
        </div>

        <div className={styles.grid}>
          {filtered.map((item) => {
            const check = checks[item.id];
            const error = errors[item.id];
            const meta = statusMeta[item.status];
            return (
              <article className={styles.card} key={item.id}>
                <div className={styles.cardTop}>
                  <span className={styles.number}>#{item.id}</span>
                  <span className={`${styles.badge} ${styles[item.status]}`}>{meta.label}</span>
                </div>
                <h3>{item.name}</h3>
                <p className={styles.category}>{item.category}</p>
                <div className={styles.kind}>{item.kind === "journal" ? "Journal candidate" : item.kind === "repository" ? "Repository / preprint" : "Publishing platform"}</div>
                <p className={styles.note}>{item.note}</p>

                {check && (
                  <div className={styles.liveResult}>
                    <div><strong>Live evidence score: {check.score}/100</strong><span>{check.status.replaceAll("-", " ")}</span></div>
                    {check.evidence.slice(0, 2).map((evidence) => <p key={evidence}>✓ {evidence}</p>)}
                    {check.cautions.slice(0, 1).map((caution) => <p key={caution} className={styles.caution}>! {caution}</p>)}
                  </div>
                )}
                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.actions}>
                  <button onClick={() => liveVerify(item)} disabled={checking === item.id}>
                    {checking === item.id ? "Checking…" : check ? "Refresh live check" : "Run live registry check"}
                  </button>
                  {item.officialUrl && <a href={item.officialUrl} target="_blank" rel="noreferrer">Official site ↗</a>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.tools}>
        <div>
          <span className={styles.eyebrow}>DISCOVERY SOURCES</span>
          <h2>Go beyond 100 entries</h2>
          <p>Use authoritative open metadata to search thousands of current journals, then verify fees on the publisher site.</p>
        </div>
        <div className={styles.toolCards}>
          <a href="/publishing-agent"><strong>Publishing Agent</strong><span>Build a manuscript-specific, low-cost submission pathway</span></a>
          <a href="https://doaj.org/" target="_blank" rel="noreferrer"><strong>DOAJ</strong><span>Find open-access and no-fee journals</span></a>
          <a href="https://openalex.org/" target="_blank" rel="noreferrer"><strong>OpenAlex</strong><span>Discover journals and citation signals</span></a>
          <a href="https://thinkchecksubmit.org/" target="_blank" rel="noreferrer"><strong>Think. Check. Submit.</strong><span>Evaluate journal trust signals</span></a>
        </div>
      </section>
    </main>
  );
}
