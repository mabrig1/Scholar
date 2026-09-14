import RepositoryAdminClient from "./RepositoryAdminClient";
import styles from "../../repository/repository.module.css";

export default function RepositoryAdminPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.profileHero}>
          <span className={styles.eyebrow}>ADMIN · MABRIG OPEN RESEARCH REPOSITORY</span>
          <h1>Moderation queue</h1>
          <p>Approve only after verifying both the sharing rights/version and the scholarly metadata.</p>
        </section>
        <RepositoryAdminClient />
      </div>
    </main>
  );
}
