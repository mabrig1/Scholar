import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildRepositoryHighwireMeta, normalizeDoi, repositoryJsonLd } from "@/lib/open-repository";
import { getPublishedWork } from "@/lib/open-repository-store";
import styles from "../../repository.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://scholar.mabrigkorie.org").replace(/\/$/, "");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await getPublishedWork(slug);
  if (!work) return { title: "Scholarly work not found" };

  const canonicalUrl = baseUrl() + "/repository/works/" + work.slug;
  const pdfUrl = work.fileName ? baseUrl() + "/repository/files/" + work.slug : "";
  const authors = (work.authors || []).map((author: { name: string }) => author.name);
  const highwire = buildRepositoryHighwireMeta({
    title: work.title,
    authors,
    year: work.year,
    journal: work.journal,
    doi: work.doi,
    canonicalUrl,
    pdfUrl,
  });

  return {
    title: work.title,
    description: work.abstract.slice(0, 300),
    alternates: { canonical: canonicalUrl },
    authors: authors.map((name: string) => ({ name })),
    other: highwire,
    openGraph: {
      type: "article",
      title: work.title,
      description: work.abstract.slice(0, 300),
      url: canonicalUrl,
    },
  };
}

export default async function RepositoryWorkPage({ params }: Props) {
  const { slug } = await params;
  const work = await getPublishedWork(slug);
  if (!work) notFound();

  const researcher = work.researcherId || {};
  const canonicalUrl = baseUrl() + "/repository/works/" + work.slug;
  const pdfUrl = work.fileName ? baseUrl() + "/repository/files/" + work.slug : "";
  const doi = normalizeDoi(work.doi);
  const jsonLd = repositoryJsonLd({
    title: work.title,
    authors: work.authors || [],
    year: work.year,
    abstract: work.abstract,
    keywords: work.keywords || [],
    journal: work.journal,
    doi: work.doi,
    canonicalUrl,
    pdfUrl,
    license: work.license,
  });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <article className={styles.workHero}>
          <span className={styles.eyebrow}>MABRIG OPEN RESEARCH REPOSITORY · {String(work.workType).replaceAll("_", " ")}</span>
          <h1>{work.title}</h1>
          <p>
            {(work.authors || []).map((author: { name: string }) => author.name).join(", ")} · {work.year}
            {work.journal ? " · " + work.journal : ""}
          </p>
          <div className={styles.actions}>
            {pdfUrl ? <a className={styles.button} href={pdfUrl} target="_blank" rel="noreferrer">Read PDF</a> : null}
            {!pdfUrl && work.externalUrl ? <a className={styles.button} href={work.externalUrl} target="_blank" rel="noreferrer">Open full text</a> : null}
            {doi ? <a className={styles.buttonSecondary} href={"https://doi.org/" + doi} target="_blank" rel="noreferrer">Resolve DOI</a> : null}
            <a className={styles.buttonSecondary} href={"/repository/researchers/" + researcher.slug}>Researcher profile</a>
          </div>
        </article>

        <section className={styles.workLayout}>
          <article className={styles.panel}>
            <span className={styles.eyebrow}>ABSTRACT</span>
            <h2 className={styles.sectionTitle}>Scholarly abstract</h2>
            <p className={styles.abstract}>{work.abstract}</p>

            {(work.keywords || []).length ? (
              <>
                <h3>Keywords</h3>
                <div className={styles.keywords}>{work.keywords.map((keyword: string) => <span key={keyword}>{keyword}</span>)}</div>
              </>
            ) : null}

            {work.rightsStatement ? (
              <>
                <h3>Rights statement</h3>
                <p className={styles.abstract}>{work.rightsStatement}</p>
              </>
            ) : null}
          </article>

          <aside className={styles.panel}>
            <span className={styles.eyebrow}>SCHOLARLY RECORD</span>
            <h2 className={styles.sectionTitle}>Metadata</h2>
            <div className={styles.sideList}>
              <div><strong>Researcher</strong><a href={"/repository/researchers/" + researcher.slug}>{researcher.fullName}</a></div>
              <div><strong>Affiliation</strong>{researcher.affiliation || "Not supplied"}</div>
              <div><strong>Year</strong>{work.year}</div>
              <div><strong>Work type</strong>{String(work.workType).replaceAll("_", " ")}</div>
              {work.journal ? <div><strong>Journal / source</strong>{work.journal}</div> : null}
              {doi ? <div><strong>DOI</strong><a href={"https://doi.org/" + doi} target="_blank" rel="noreferrer">{doi}</a></div> : null}
              {work.license ? <div><strong>Licence</strong>{work.license}</div> : null}
              <div><strong>Repository URL</strong>{canonicalUrl}</div>
            </div>
            <p className={styles.finePrint}>
              This public record was approved after repository moderation. MABRIG does not claim that repository
              publication guarantees Google Scholar inclusion, citations or journal indexing.
            </p>
          </aside>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </div>
    </main>
  );
}
