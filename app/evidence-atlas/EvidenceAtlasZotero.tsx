"use client";

import { useState, type FormEvent } from "react";
import type { AtlasProject, SearchArticle } from "@/lib/evidence-atlas";
import type { ZoteroPublicItem } from "@/packages/evidence-atlas-core/src/zotero-public";
import styles from "./objective-alignment.module.css";

type Preview = {
  items: ZoteroPublicItem[];
  skipped: number;
  checkedAt: string;
  disclaimer: string;
  error?: string;
};

export default function EvidenceAtlasZotero({ project, onVerified }: {
  project: AtlasProject;
  onVerified: (article: SearchArticle) => void;
}) {
  const [kind, setKind] = useState<"users" | "groups">("users");
  const [id, setId] = useState("");
  const [collection, setCollection] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function retrieve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setPreview(null);
    if (!/^[1-9]\d{0,11}$/.test(id.trim())) {
      setError("Enter a numeric Zotero user or group library ID (not a username).");
      return;
    }
    if (collection.trim() && !/^[A-Z0-9]{8}$/.test(collection.trim().toUpperCase())) {
      setError("Collection key must consist of eight letters or digits.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: kind, id: id.trim() });
      if (collection.trim()) params.set("collection", collection.trim().toUpperCase());
      const response = await fetch("/api/evidence-atlas/zotero?" + params, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to retrieve Zotero metadata.");
      setPreview(payload as Preview);
      setNotice("Preview loaded. Only DOI-bearing public records appear. Verify the exact DOI before saving.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to retrieve Zotero metadata.");
    } finally { setLoading(false); }
  }
  async function verify(item: ZoteroPublicItem) {
    setVerifying(item.doi);
    setError(""); setNotice("");
    try {
      const params = new URLSearchParams({ doi: item.doi });
      const response = await fetch("/api/evidence-atlas/zotero/verify?" + params, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.article) throw new Error(payload.error || "Crossref could not verify this DOI.");
      if (payload.article.doi !== item.doi) throw new Error("The verified DOI did not match the Zotero record.");
      onVerified(payload.article as SearchArticle);
      setNotice("Exact DOI verified against Crossref and sent to the project paper library. The stored title comes from Crossref.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to verify DOI.");
    } finally { setVerifying(""); }
  }
  return <section className={styles.module} aria-label="Import papers from public Zotero libraries">
    <div className={styles.header}>
      <div>
        <span className={styles.eyebrow}>ZOTERO CONNECTION · PUBLIC LIBRARIES</span>
        <h2>Bring your publicly shared references into Evidence Atlas</h2>
        <p>Browse a public Zotero user or group library by its numeric ID. Preview up to 20 top-level records with DOIs, then verify each DOI in Crossref before adding it to this map.</p>
      </div>
    </div>
    <form className={styles.zoteroForm} onSubmit={retrieve}>
      <label>Library type
        <select value={kind} onChange={(e) => setKind(e.target.value as "users" | "groups")}>
          <option value="users">Public user library</option><option value="groups">Public group library</option>
        </select>
      </label>
      <label>Numeric user / group ID
        <input value={id} maxLength={12} inputMode="numeric" required
          onChange={(e) => setId(e.target.value)} placeholder="Zotero numeric library ID" />
      </label>
      <label>Collection key (optional)
        <input value={collection} maxLength={8} onChange={(e) => setCollection(e.target.value.toUpperCase())}
          placeholder="8-character collection key" />
      </label>
      <button disabled={loading} type="submit">{loading ? "Loading preview…" : "Preview references"}</button>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {preview && <>
      <p className={styles.caution}>{preview.disclaimer} Retrieved {preview.items.length} DOI-bearing records; {preview.skipped} skipped (missing DOI, duplicate or unsupported type). No Zotero item is modified.</p>
      <div className={styles.zoteroList}>
        {preview.items.map((item) => {
          const saved = project.papers.some((paper) => paper.doi === item.doi);
          return <article className={styles.zoteroItem} key={item.key}>
            <strong>{item.title}</strong>
            <p>{item.creators.slice(0, 3).join("; ") || "Creator unavailable"} · {item.date || "Date unavailable"} · {item.itemType}</p>
            <small>DOI: {item.doi}</small>
            <div className={styles.actions}>
              <a href={"https://doi.org/" + encodeURIComponent(item.doi).replace("%2F", "/")}
                target="_blank" rel="noopener noreferrer">Check DOI ↗</a>
              {item.zoteroUrl && <a href={item.zoteroUrl} target="_blank" rel="noopener noreferrer">Zotero item ↗</a>}
              <button type="button" disabled={saved || Boolean(verifying)}
                onClick={() => verify(item)}>
                {saved ? "Saved ✓" : verifying === item.doi ? "Verifying…" : "Verify DOI & save"}
              </button>
            </div>
          </article>;
        })}
        {!preview.items.length && <p>No DOI-bearing top-level papers were found in this preview. Try another public collection or use Scholar's Crossref search.</p>}
      </div>
    </>}
    <p className={styles.caution}>
      This early-access connector reads **public bibliography metadata only**. It does not access private Zotero libraries, accept API keys, upload PDF attachments, synchronize changes or modify Zotero items. DOI verification does not verify study findings, current retraction status or journal quality.
    </p>
  </section>;
}
