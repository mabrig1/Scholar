export const dynamic = "force-dynamic";

export default function NounChapterHumanizerPage() {
  const aiConfigured = Boolean(
    process.env.AI_API_KEY?.trim() &&
    process.env.AI_BASE_URL?.trim() &&
    process.env.AI_MODEL?.trim(),
  );
  const aiModel = process.env.AI_MODEL?.trim();

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <span className="badge">NOUN CHAPTER EDITOR • ADMIN</span>
          <h1>NOUN Chapter-by-Chapter Rewriter &amp; Humanizer</h1>
          <p>Rewrite one thesis chapter at a time into clearer, more natural academic English while preserving the approved structure, citations, references, facts and research data.</p>
        </div>
        <div className="actions">
          <a className="btn secondary" href="/admin/thesis-writer">NOUN Thesis Writer</a>
          <a className="btn secondary" href="/admin">Admin Dashboard</a>
        </div>
      </header>

      <section className="admin-converter-layout">
        <article className="card admin-converter-card">
          <div className="conversion-power-badge">✍🏽 NOUN CHAPTER REWRITER &amp; HUMANIZER</div>
          <h2>Paste a completed chapter, rewrite it, and download a NOUN-formatted Word file</h2>
          <p>This tool is for revising existing research text. It does not manufacture citations, findings or statistics to make a chapter look complete.</p>

          <form action="/api/admin/thesis/noun-humanize" method="post" target="_blank">
            <div className="form-grid">
              <label className="field">
                <span>Select chapter</span>
                <select name="chapter" defaultValue="1">
                  <option value="1">Chapter One — Introduction</option>
                  <option value="2">Chapter Two — Literature Review</option>
                  <option value="3">Chapter Three — Methodology</option>
                  <option value="4">Chapter Four — Data Presentation / Analysis</option>
                  <option value="5">Chapter Five — Discussion / Conclusion / Recommendations</option>
                </select>
              </label>

              <label className="field">
                <span>Rewrite depth</span>
                <select name="depth" defaultValue="balanced">
                  <option value="light">Light — grammar, repetition and flow</option>
                  <option value="balanced">Balanced — natural rewrite + stronger coherence</option>
                  <option value="deep">Deep — substantial sentence restructuring</option>
                </select>
              </label>

              <label className="field full">
                <span>Research title (recommended)</span>
                <input name="researchTitle" maxLength={300} placeholder="Enter the approved thesis/project title" />
              </label>

              <label className="field">
                <span>Student name (optional)</span>
                <input name="studentName" maxLength={160} placeholder="Student full name" />
              </label>

              <label className="field">
                <span>Matric number (optional)</span>
                <input name="matricNumber" maxLength={80} placeholder="NOUN matriculation number" />
              </label>

              <label className="field full">
                <span>Paste chapter text</span>
                <textarea name="chapterText" rows={24} required maxLength={160000} placeholder="Paste the complete Chapter One, Two, Three, Four or Five here. Keep the original headings, citations, tables written as text, and references where they belong." />
              </label>

              <label className="field full">
                <span>Supervisor corrections (optional)</span>
                <textarea name="supervisorCorrections" rows={8} maxLength={20000} placeholder="Paste corrections from the supervisor: wording changes, sections to strengthen, rejected statements, required terminology, or structural instructions." />
              </label>

              <label className="field full">
                <span>Additional rewriting instructions (optional)</span>
                <textarea name="extraInstructions" rows={6} maxLength={10000} placeholder="Examples: reduce repetition, strengthen transitions, retain all headings, improve empirical synthesis, make methodology clearer, shorten overly long sentences." />
              </label>
            </div>

            <div className="notice" style={{ marginTop: 16 }}>
              <strong>NOUN formatting:</strong> downloaded chapters use A4 paper, Times New Roman 12pt, 1-inch margins, justified paragraphs, first-line indentation, double spacing, bold headings/subheadings and Arabic page numbering.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>Citation firewall:</strong> every detected author-year citation must survive the rewrite exactly. If the AI removes or changes a citation, the tool rejects the output instead of downloading a damaged chapter.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>Chapter 4 &amp; 5 data firewall:</strong> every numeric value is checked before and after rewriting. If a respondent count, percentage, coefficient, p-value, year or other number changes, the file is rejected. The editor is also instructed never to invent results or quotations.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>Humanization:</strong> this feature improves sentence variety, natural academic flow, transitions and readability. It does not promise to bypass or defeat AI-detection systems.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>AI connection:</strong> {aiConfigured ? `Configured${aiModel ? ` with ${aiModel}` : ""}.` : "Not fully configured. Add AI_API_KEY, AI_BASE_URL and AI_MODEL in Vercel before using this tool."}
            </div>

            <button className="btn primary conversion-download-btn" type="submit">✍🏽 Rewrite, Humanize &amp; Download NOUN Chapter (.docx)</button>
          </form>
        </article>

        <aside className="card conversion-business-card">
          <span className="poster-kicker">CHAPTER-SPECIFIC EDITING</span>
          <h2>What the editor protects</h2>
          <div className="conversion-feature-list">
            <div><strong>Chapter One</strong><span>Problem, objectives, questions/hypotheses, significance, scope and key terms stay academically aligned.</span></div>
            <div><strong>Chapter Two</strong><span>Author-year citations, theories, empirical studies and the research gap are preserved while synthesis and flow improve.</span></div>
            <div><strong>Chapter Three</strong><span>Design, population, sample, instruments, validity/reliability and analysis methods are not silently changed.</span></div>
            <div><strong>Chapter Four</strong><span>Numbers and reported results are protected by the strictest integrity check.</span></div>
            <div><strong>Chapter Five</strong><span>Conclusions and recommendations remain tied to the submitted findings rather than new invented claims.</span></div>
            <div><strong>Supervisor mode</strong><span>Paste supervisor corrections and make them part of the rewrite instructions.</span></div>
            <div><strong>Three rewrite depths</strong><span>Choose light correction, balanced humanization or deep restructuring.</span></div>
            <div><strong>Word-ready output</strong><span>Download the rewritten chapter already formatted for the NOUN academic workflow.</span></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
