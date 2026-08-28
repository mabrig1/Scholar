"use client";

import { useEffect, useState } from "react";
import styles from "./system-health.module.css";

type Health = {
  name: string;
  configured: boolean;
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  detail: string;
};

type Result = {
  checkedAt: string;
  checks: Health[];
  summary: { total: number; healthy: number; configuredAi: number; healthyAi: number };
};

export default function SystemHealthClient() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system-health", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Health check failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health check failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>AI & SCHOLARLY API HEALTH CENTER</div>
          <h1>Know which publishing engines are healthy before client work begins.</h1>
          <p>Researcher Pro tests the configured AI fallbacks and core scholarly services without revealing secret keys. Use this dashboard to diagnose provider outages, invalid credentials and degraded external services.</p>
        </div>
        <button className={styles.refresh} onClick={refresh} disabled={loading}>{loading ? "Testing services…" : "Run live health check"}</button>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.summary}>
        <div><span>Services healthy</span><strong>{result ? `${result.summary.healthy}/${result.summary.total}` : "—"}</strong></div>
        <div><span>AI providers configured</span><strong>{result?.summary.configuredAi ?? "—"}</strong></div>
        <div><span>AI providers healthy</span><strong>{result?.summary.healthyAi ?? "—"}</strong></div>
        <div><span>Last checked</span><strong>{result ? new Date(result.checkedAt).toLocaleTimeString() : "—"}</strong></div>
      </section>

      <section className={styles.grid}>
        {(result?.checks || []).map((check) => <article className={`${styles.card} ${check.ok ? styles.ok : check.configured ? styles.bad : styles.missing}`} key={check.name}>
          <div className={styles.cardHead}><div><span className={styles.status}>{check.ok ? "HEALTHY" : check.configured ? "DEGRADED" : "MISSING"}</span><h2>{check.name}</h2></div><div className={styles.dot} /></div>
          <div className={styles.meta}>
            <div><span>Configured</span><strong>{check.configured ? "Yes" : "No"}</strong></div>
            <div><span>HTTP</span><strong>{check.status ?? "—"}</strong></div>
            <div><span>Latency</span><strong>{check.latencyMs !== null ? `${check.latencyMs} ms` : "—"}</strong></div>
          </div>
          <p>{check.detail}</p>
        </article>)}
      </section>

      {!result && !loading && !error && <div className={styles.empty}>No health check has run yet.</div>}

      <section className={styles.note}>
        <strong>Operational rule:</strong> AI provider health is not the same as model quality or available quota. A green health check confirms that the credential/service endpoint responded successfully; actual generation may still be affected by model availability, rate limits or account limits.
      </section>
    </main>
  );
}
