import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>
    <nav className="container nav" aria-label="Admin tools">
      <div className="brand">RESEARCHER PRO ADMIN</div>
      <div className="actions">
        <a className="btn secondary" href="/admin">Dashboard</a>
        <a className="btn secondary" href="/admin/converter">Word Studio</a>
        <a className="btn secondary" href="/admin/submission-readiness">Submission Gate</a>
        <a className="btn secondary" href="/admin/journal-matrix">Journal Matrix</a>
        <a className="btn secondary" href="/admin/citation-auditor">Citation Audit</a>
        <a className="btn secondary" href="/admin/integrity-corpus">Integrity Corpus</a>
        <a className="btn primary" href="/admin/lecturer-agent">Lecturer Agent Hub</a>
        <a className="btn primary" href="/admin/thesis-writer">🎓 NOUN Thesis Writer</a>
        <a className="btn secondary" href="/admin/noun-chapter-humanizer">✍🏽 NOUN Chapter Humanizer</a>
      </div>
    </nav>
    {children}
  </>;
}
