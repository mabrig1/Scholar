import type { Metadata } from "next";
import { listPublishedWorks } from "@/lib/open-repository-store";
import styles from "./repository.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MABRIG Open Research Repository",
  description:
    "Open scholarly records and rights-cleared research outputs with Google Scholar-compatible metadata, author profiles and permanent public pages.",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function RepositoryPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  let works: any[] = [];
  let error = "";
  try {
    works = await listPublishedWorks(q, 60);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Repository records are temporarily unavailable.";
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>MABRIG OPEN RESEARCH REPOSITORY</span>
            <h1>Make legitimate research easier to discover, verify and cite.</h1>
            <p>
              A moderated open repository for postgraduate researchers, early-career academics and lecturers.
              Every approved work receives one permanent public record, structured scholarly metadata and a
              researcher profile designed for responsible discovery.
            </p>
            <div className={styles.actions}>
              <a className={styles.button} href="/repository/submit">Deposit a scholarly work</a>
              <a className={styles.buttonSecondary} href="/academic-indexing-agent">Run the Indexing Agent</a>
            </div>
          </div>
          <aside className={styles.heroAside}>
            <span>One scholarly work per public URL</span>
            <span>Google Scholar / Highwire metadata</span>
            <span>ORCID and DOI identity links</span>
            <span>Rights and metadata moderation</span>
            <span>Searchable PDF or stable full-text link</span>
          </aside>
        </section>

        <div className={styles.notice}>
          <strong>Repository standard:</strong> submission does not mean immediate publication. Every deposit remains
          private until rights and metadata are reviewed. Publication here improves discoverability but does not
          guarantee Google or Google Scholar indexing.
        </div>

        <form className={styles.search} method="get">
          <input name="q" defaultValue={q} placeholder="Search title, abstract, journal or keywords" aria-label="Search repository" />
          <button type="submit">Search repository</button>
        </form>

        {error ? (
          <section className={styles.panel}><div className={styles.error}>{error}</div></section>
        ) : works.length ? (
          <section className={styles.grid}>
            {works.map((work) => {
              const researcher = work.researcherId || {};
              return (
                <article className={styles.card} key={work._id}>
                  <span className={styles.eyebrow}>{String(work.workType).replaceAll("_", " ")}</span>
                  <h2>{work.title}</h2>
                  <p>{work.abstract.length > 240 ? `${work.abstract.slice(0, 240)}…` : work.abstract}</p>
                  <div className={styles.meta}>
                    <span>{work.year}</span>
                    {work.journal ? <span>{work.journal}</span> : null}
                    {work.doi ? <span>DOI</span> : null}
                  </div>
                  <p>
                    <a href={`/repository/researchers/${researcher.slug}`}>{researcher.fullName}</a>
                    {researcher.affiliation ? ` · ${researcher.affiliation}` : ""}
                  </p>
                  <a href={`/repository/works/${work.slug}`}>Open scholarly record →</a>
                </article>
              );
            })}
          </section>
        ) : (
          <section className={styles.panel}>
            <div className={styles.empty}>
              {q ? "No approved repository works matched this search." : "No approved repository works are public yet."}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
