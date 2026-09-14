import type { Metadata } from "next";
import RepositorySubmitClient from "./RepositorySubmitClient";
import styles from "../repository.module.css";

export const metadata: Metadata = {
  title: "Deposit Research | MABRIG Open Research Repository",
  description: "Submit a rights-cleared scholarly work for moderated publication in the MABRIG Open Research Repository.",
};

export default function RepositorySubmitPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>MODERATED OPEN DEPOSIT</span>
            <h1>Deposit research without compromising rights or metadata quality.</h1>
            <p>
              Submit a rights-cleared PDF or stable public full-text link. Your record stays private until a repository
              administrator verifies the sharing basis and scholarly metadata.
            </p>
          </div>
          <aside className={styles.heroAside}>
            <span>Private moderation queue</span>
            <span>Duplicate DOI/title protection</span>
            <span>Public author profile after approval</span>
            <span>Permanent scholarly work URL</span>
          </aside>
        </section>
        <div className={styles.notice}>
          Do not deposit confidential data, unpublished student records, copyrighted publisher PDFs you cannot legally
          share, or work whose authorship/ownership is disputed.
        </div>
        <section className={styles.formWrap}>
          <article className={styles.panel}>
            <span className={styles.eyebrow}>SUBMISSION FORM</span>
            <h2 className={styles.sectionTitle}>Scholarly record and deposit</h2>
            <RepositorySubmitClient />
          </article>
          <aside className={styles.panel}>
            <span className={styles.eyebrow}>WHAT HAPPENS NEXT</span>
            <h2 className={styles.sectionTitle}>Repository review</h2>
            <div className={styles.sideList}>
              <div><strong>1. Rights review</strong>Administrator confirms the deposit basis and version that may be shared.</div>
              <div><strong>2. Metadata review</strong>Title, authors, year, DOI, abstract and source are checked for consistency.</div>
              <div><strong>3. Publication</strong>The approved work receives a public repository URL and author profile.</div>
              <div><strong>4. Discovery</strong>Scholar-compatible meta tags, structured data and sitemap discovery paths are emitted automatically.</div>
              <div><strong>5. Monitoring</strong>Use the Academic Indexing Agent to verify Google and Google Scholar discovery over time.</div>
            </div>
            <p className={styles.finePrint}>
              Repository publication does not create a DOI and does not guarantee Google Scholar indexing, citations or
              academic impact.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
