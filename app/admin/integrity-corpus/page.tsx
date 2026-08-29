export const dynamic = "force-dynamic";

export default function IntegrityCorpusAdminPage() {
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div><span className="badge">SCHOLAR INTEGRITY ENGINE</span><h1>Institutional Corpus Manager</h1><p>Build a permissioned comparison collection from theses, projects, articles and prior submissions.</p></div>
      </header>
      <section className="section container">
        <article className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2>Ingest a permitted source</h2>
          <p>Upload TXT, Markdown, DOCX or text-based PDF up to 4 MB, or paste source text. Do not upload material you are not permitted to retain and compare.</p>
          <form action="/api/admin/integrity-corpus" method="post" encType="multipart/form-data" className="form-grid">
            <label className="field full"><span>Title</span><input name="title" placeholder="Thesis, project or article title" /></label>
            <label className="field"><span>Source type</span><select name="sourceType" defaultValue="thesis"><option value="thesis">Thesis / dissertation</option><option value="project">Undergraduate project</option><option value="article">Article</option><option value="submission">Previous submission</option><option value="institutional">Institutional document</option></select></label>
            <label className="field"><span>Institution</span><input name="institution" placeholder="University or organisation" /></label>
            <label className="field"><span>Author</span><input name="author" /></label>
            <label className="field"><span>Year</span><input name="year" type="number" min="1900" max="2100" /></label>
            <label className="field full"><span>Evidence URL (optional)</span><input name="url" type="url" /></label>
            <label className="field full"><span>Document</span><input name="file" type="file" accept=".txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label>
            <label className="field full"><span>Or paste source text</span><textarea name="text" rows={12} /></label>
            <label className="field full"><span><input name="permissionConfirmed" value="yes" type="checkbox" required /> I confirm this material may be retained and used for academic similarity comparison.</span></label>
            <button className="btn primary" type="submit">Add to Scholar corpus</button>
          </form>
          <div className="notice" style={{ marginTop: 18 }}><strong>Privacy:</strong> corpus retention is separate from ordinary similarity checking. Public users must explicitly opt in before their submission is retained for future comparison.</div>
        </article>
      </section>
    </main>
  );
}
