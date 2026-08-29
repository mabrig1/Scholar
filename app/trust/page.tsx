import type { Metadata } from "next";

export const metadata: Metadata = { title: "Trust Centre", description: "How Mabrig Researcher Pro handles research integrity, journal evidence, privacy and human oversight." };

const principles = [
  ["Research integrity", "We do not invent data, findings, citations, participants, statistics or ethical approvals. AI output must be reviewed and verified by the researcher."],
  ["Journal evidence", "Indexing, fees and policies can change. The platform points users to official journal, Scopus, Crossref and OpenAlex evidence for same-day verification."],
  ["No guaranteed acceptance", "Journal editors and reviewers make independent decisions. A readiness score or journal match is decision support, not an acceptance probability."],
  ["Privacy by design", "The manuscript workspace is stored in the user's browser. Submitted orders are sent only when the user deliberately completes the submission form."],
  ["Human oversight", "Complex formatting, editing and publication work can be escalated to a human reviewer. Automated output should never be treated as final without inspection."],
  ["Secure administration", "Administrative routes require deployment-configured credentials. Secrets belong in protected environment settings and are never committed to the repository."],
];

export default function TrustPage() {
  return <main className="commercial-shell"><header className="container nav"><a className="brand researcher-brand" href="/"><span>MRP</span><strong>Mabrig Researcher Pro</strong></a><div className="actions"><a className="btn secondary" href="/privacy">Privacy</a><a className="btn secondary" href="/terms">Terms</a><a className="btn primary" href="/workspace">My workspace</a></div></header><section className="commercial-hero trust-hero"><div className="container"><span className="badge">TRUST • EVIDENCE • HUMAN OVERSIGHT</span><h1>Responsible research support is a product feature.</h1><p className="lead">Researcher Pro is designed to make legitimate research work clearer and more efficient without disguising uncertainty or replacing scholarly responsibility.</p></div></section><section className="section container trust-principles">{principles.map(([title, text], index) => <article className="card" key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{text}</p></article>)}</section></main>;
}
