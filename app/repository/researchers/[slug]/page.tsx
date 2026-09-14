import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeOrcid } from "@/lib/open-repository";
import { getPublishedResearcher } from "@/lib/open-repository-store";
import styles from "../../repository.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://scholar.mabrigkorie.org").replace(/\/$/, "");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedResearcher(slug);
  if (!result) return { title: "Researcher not found" };
  const researcher = result.researcher;
  const canonical = baseUrl() + "/repository/researchers/" + researcher.slug;
  return {
    title: researcher.fullName + " — Open Research Profile",
    description:
      researcher.bio ||
      "Open scholarly profile for " + researcher.fullName + " at " + researcher.affiliation + ".",
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title: researcher.fullName + " — MABRIG Open Research Repository",
      description: researcher.bio || researcher.affiliation,
      url: canonical,
    },
  };
}

export default async function RepositoryResearcherPage({ params }: Props) {
  const { slug } = await params;
  const result = await getPublishedResearcher(slug);
  if (!result) notFound();

  const { researcher, works } = result;
  const orcid = normalizeOrcid(researcher.orcid);
  const canonical = baseUrl() + "/repository/researchers/" + researcher.slug;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: researcher.fullName,
    affiliation: researcher.affiliation
      ? { "@type": "Organization", name: researcher.affiliation }
      : undefined,
    description: researcher.bio || undefined,
    url: canonical,
    sameAs: orcid ? ["https://orcid.org/" + orcid] : [],
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.profileHero}>
          <span className={styles.eyebrow}>OPEN RESEARCHER PROFILE</span>
          <h1>{researcher.fullName}</h1>
          <p>
            {researcher.affiliation}
            {researcher.department ? " · " + researcher.department : ""}
          </p>
          {researcher.bio ? <p>{researcher.bio}</p> : null}
          <div className={styles.actions}>
            {orcid ? (
              <a className={styles.button} href={"https://orcid.org/" + orcid} target="_blank" rel="noreferrer">
                ORCID profile
              </a>
            ) : null}
            <a className={styles.buttonSecondary} href="/repository">Browse repository</a>
          </div>
        </section>

        <section className={styles.profileGrid}>
          <aside className={styles.panel}>
            <span className={styles.eyebrow}>PROFILE</span>
            <h2 className={styles.sectionTitle}>Research identity</h2>
            <div className={styles.facts}>
              <span><strong>Name:</strong> {researcher.fullName}</span>
              <span><strong>Affiliation:</strong> {researcher.affiliation}</span>
              {researcher.department ? <span><strong>Department:</strong> {researcher.department}</span> : null}
              {orcid ? <span><strong>ORCID:</strong> {orcid}</span> : null}
              <span><strong>Public works:</strong> {works.length}</span>
            </div>
          </aside>

          <article className={styles.panel}>
            <span className={styles.eyebrow}>SCHOLARLY OUTPUTS</span>
            <h2 className={styles.sectionTitle}>Approved repository works</h2>
            <div className={styles.works}>
              {works.map((work: any) => (
                <div className={styles.workCard} key={work._id}>
                  <span className={styles.eyebrow}>{String(work.workType).replaceAll("_", " ")} · {work.year}</span>
                  <h3><a href={"/repository/works/" + work.slug}>{work.title}</a></h3>
                  <p>{work.abstract.length > 220 ? work.abstract.slice(0, 220) + "…" : work.abstract}</p>
                  {work.journal ? <p><strong>{work.journal}</strong></p> : null}
                </div>
              ))}
            </div>
          </article>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </div>
    </main>
  );
}
