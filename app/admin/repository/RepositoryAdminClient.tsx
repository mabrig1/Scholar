"use client";

import { useEffect, useState } from "react";
import styles from "../../repository/repository.module.css";

type Work = {
  _id: string;
  title: string;
  year: number;
  workType: string;
  abstract: string;
  authors: Array<{ name: string }>;
  journal?: string;
  doi?: string;
  license?: string;
  rightsStatement?: string;
  rightsConfirmed: boolean;
  fileName?: string;
  externalUrl?: string;
  researcherId?: {
    fullName?: string;
    affiliation?: string;
    contactEmail?: string;
    orcid?: string;
  };
};

export default function RepositoryAdminClient() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rights, setRights] = useState<Record<string, boolean>>({});
  const [metadata, setMetadata] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/repository", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load queue.");
      setWorks(data.works || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function moderate(id: string, action: "approve" | "reject") {
    setError("");
    try {
      const response = await fetch("/api/admin/repository", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          rightsReviewed: Boolean(rights[id]),
          metadataReviewed: Boolean(metadata[id]),
          note: notes[id] || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Moderation failed.");
      setWorks((current) => current.filter((work) => work._id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Moderation failed.");
    }
  }

  if (loading) return <div className={styles.panel}>Loading repository moderation queue…</div>;

  return (
    <div className={styles.adminList}>
      {error ? <div className={styles.error}>{error}</div> : null}
      {!works.length ? <div className={styles.panel}>No pending repository submissions.</div> : null}
      {works.map((work) => (
        <article className={styles.adminItem} key={work._id}>
          <span className={styles.eyebrow}>{work.workType.replaceAll("_", " ")} · {work.year}</span>
          <h3>{work.title}</h3>
          <p><strong>Researcher:</strong> {work.researcherId?.fullName} · {work.researcherId?.affiliation}</p>
          <p><strong>Authors:</strong> {work.authors.map((author) => author.name).join(", ")}</p>
          <p>{work.abstract}</p>
          {work.journal ? <p><strong>Source:</strong> {work.journal}</p> : null}
          {work.doi ? <p><strong>DOI:</strong> {work.doi}</p> : null}
          {work.license ? <p><strong>Licence:</strong> {work.license}</p> : null}
          {work.rightsStatement ? <p><strong>Rights basis:</strong> {work.rightsStatement}</p> : null}
          <p><strong>Depositor rights confirmation:</strong> {work.rightsConfirmed ? "Yes" : "No"}</p>
          {work.fileName ? (
            <a className={styles.inlineLink} href={"/api/admin/repository/file/" + work._id} target="_blank" rel="noreferrer">
              Review submitted PDF →
            </a>
          ) : null}
          {!work.fileName && work.externalUrl ? (
            <a className={styles.inlineLink} href={work.externalUrl} target="_blank" rel="noreferrer">
              Review external full text →
            </a>
          ) : null}

          <div className={styles.adminActions}>
            <label>
              <input type="checkbox" checked={Boolean(rights[work._id])} onChange={(e) => setRights((v) => ({ ...v, [work._id]: e.target.checked }))} />
              Rights/version reviewed and acceptable for public repository display
            </label>
            <label>
              <input type="checkbox" checked={Boolean(metadata[work._id])} onChange={(e) => setMetadata((v) => ({ ...v, [work._id]: e.target.checked }))} />
              Title, authors, abstract, year, DOI/source metadata reviewed
            </label>
            <textarea
              placeholder="Moderation note (optional)"
              value={notes[work._id] || ""}
              onChange={(e) => setNotes((v) => ({ ...v, [work._id]: e.target.value }))}
            />
            <div className={styles.adminButtons}>
              <button className={styles.button} onClick={() => void moderate(work._id, "approve")}>Approve and publish</button>
              <button className={styles.button + " " + styles.danger} onClick={() => void moderate(work._id, "reject")}>Reject</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
