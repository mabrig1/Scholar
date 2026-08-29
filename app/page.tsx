const workspaces = [
  {
    eyebrow: "ANALYZE",
    title: "Chapter Four Data Lab",
    description:
      "Analyze CSV data with descriptive statistics, Likert summaries, reliability, correlation, chi-square and regression, then export to Word.",
    href: "/chapter-four",
    action: "Analyze thesis data",
  },
  {
    eyebrow: "PUBLISH",
    title: "Publishing Intelligence",
    description:
      "Evaluate manuscript readiness, compare verified journal pathways, audit citations and build a responsible submission plan.",
    href: "/publishing-agent",
    action: "Open publishing agent",
  },
  {
    eyebrow: "FORMAT",
    title: "DocForge Formatting Studio",
    description:
      "Turn academic text into a clean Word document with APA 7, MLA 9, UNN and configurable professional formatting.",
    href: "/formatter",
    action: "Format a document",
  },
  {
    eyebrow: "ASSIST",
    title: "Academic Support",
    description:
      "Submit documents for editing, rewriting, humanizing, printing, binding and institution-specific preparation.",
    href: "/academic-support",
    action: "Request assistance",
  },
];

const trustPoints = [
  "Meaning-preserving rewriting",
  "No invented citations",
  "Evidence-aware journal guidance",
  "Downloadable Word documents",
  "Up to 100-page service submissions",
  "Human assistance when software is not enough",
];

export default function ResearcherProHome() {
  return (
    <>
      <header className="container nav researcher-nav">
        <a className="brand researcher-brand" href="/">
          <span>MRP</span>
          <strong>Mabrig Researcher Pro</strong>
        </a>
        <nav className="actions" aria-label="Primary navigation">
          <a className="btn secondary" href="/workspace">Workspace</a>
          <a className="btn secondary" href="/chapter-four">Analyze</a>
          <a className="btn secondary" href="/formatter">Format</a>
          <a className="btn secondary" href="/publishing-agent">Publish</a>
          <a className="btn secondary" href="/pricing">Pricing</a>
          <a className="btn primary" href="/academic-printing/order">Human Support</a>
        </nav>
      </header>

      <main>
        <section className="researcher-hero">
          <div className="container researcher-hero-grid">
            <div>
              <span className="badge">ONE RESEARCH WORKSPACE • GLOBAL SUPPORT</span>
              <h1>Research. Analyze. Format. Publish—with confidence.</h1>
              <p className="lead">
                Mabrig Researcher Pro brings publishing intelligence, DocForge document formatting and professional academic assistance into one responsible research platform.
              </p>
              <div className="actions">
                <a className="btn primary" href="/workspace">Create my manuscript workspace</a>
                <a className="btn secondary" href="/publishing-agent">Find my publishing pathway</a>
              </div>
            </div>
            <aside className="researcher-command-card" aria-label="Research workflow">
              <span>RESEARCHER COMMAND CENTRE</span>
              <ol>
                <li><strong>Prepare</strong><small>Rewrite, humanize and structure</small></li>
                <li><strong>Analyze</strong><small>Build Chapter Four tables and findings</small></li>
                <li><strong>Format</strong><small>Apply institutional or journal style</small></li>
                <li><strong>Audit</strong><small>Check citations and readiness</small></li>
                <li><strong>Submit</strong><small>Follow a journal-specific pathway</small></li>
              </ol>
            </aside>
          </div>
        </section>

        <section className="section container">
          <div className="section-heading">
            <span className="badge">ONE CONNECTED RESEARCH EXPERIENCE</span>
            <h2>Choose your workspace</h2>
            <p>Every tool remains focused, while your research journey stays inside one platform.</p>
          </div>
          <div className="researcher-workspace-grid">
            {workspaces.map((workspace) => (
              <article className="researcher-workspace-card" key={workspace.title}>
                <span>{workspace.eyebrow}</span>
                <h3>{workspace.title}</h3>
                <p>{workspace.description}</p>
                <a href={workspace.href}>{workspace.action} →</a>
              </article>
            ))}
          </div>
        </section>

        <section className="section researcher-trust-section">
          <div className="container researcher-trust-grid">
            <div>
              <span className="badge">RESPONSIBLE RESEARCH SUPPORT</span>
              <h2>Powerful assistance without compromising integrity.</h2>
              <p>
                The platform supports legitimate research, editing, formatting and publication preparation. Researchers remain responsible for authorship, factual accuracy and assessed submissions.
              </p>
            </div>
            <div className="researcher-trust-list">
              {trustPoints.map((point) => <span key={point}>✓ {point}</span>)}
            </div>
          </div>
        </section>

        <section className="section container">
          <div className="cta-panel researcher-cta">
            <span className="badge">MABRIG RESEARCHER PRO</span>
            <h2>Move your manuscript from draft to decision.</h2>
            <p>Begin with self-service tools, then request human assistance for complex work.</p>
            <div className="actions">
              <a className="btn primary" href="/academic-printing/order">Submit a document</a>
              <a className="btn secondary" href="/free-journals">Browse journal pathways</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container researcher-footer">
          <strong>Mabrig Researcher Pro</strong>
          <span><a href="/pricing">Pricing</a> • <a href="/trust">Trust</a> • <a href="/privacy">Privacy</a> • <a href="/terms">Terms</a></span>
        </div>
      </footer>
    </>
  );
}
