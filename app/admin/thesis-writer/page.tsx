export const dynamic = "force-dynamic";

export default function NounThesisWriterPage() {
  const aiConfigured = Boolean(
    process.env.AI_API_KEY?.trim() &&
    process.env.AI_BASE_URL?.trim() &&
    process.env.AI_MODEL?.trim(),
  );
  const aiModel = process.env.AI_MODEL?.trim();
  const currentYear = new Date().getFullYear();

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <span className="badge">NOUN EXPERT RESEARCH STUDIO • ADMIN</span>
          <h1>Expert Thesis Writer — National Open University of Nigeria</h1>
          <p>Develop, revise and quality-check NOUN research projects chapter by chapter, using verified sources and verified findings, then download a supervisor-ready Microsoft Word draft.</p>
        </div>
        <div className="actions">
          <a className="btn secondary" href="/admin">Admin Dashboard</a>
          <a className="btn secondary" href="/admin/converter">Word Conversion Studio</a>
        </div>
      </header>

      <section className="admin-converter-layout">
        <article className="card admin-converter-card">
          <div className="conversion-power-badge">🎓 EXPERT NOUN THESIS WORKFLOW</div>
          <h2>Write, Continue, Correct or Expand a NOUN Thesis</h2>
          <p>The recommended workflow is sequential: generate or revise one chapter/section, review it with the supervisor, then continue. A full-thesis option remains available for compact projects and first drafts.</p>

          <form action="/api/admin/thesis/noun" method="post" target="_blank">
            <div className="form-grid">
              <div className="field full check-row">
                <input type="hidden" name="expertMode" value="off" />
                <label><input type="checkbox" name="expertMode" value="on" defaultChecked /> Enable Expert Thesis Writer rules</label>
              </div>

              <label className="field">
                <span>Writing mode</span>
                <select name="mode" defaultValue="chapter1">
                  <option value="chapter1">Step 1 — Chapter One</option>
                  <option value="chapter2">Step 2 — Chapter Two</option>
                  <option value="chapter3">Step 3 — Chapter Three</option>
                  <option value="chapter4">Step 4 — Chapter Four</option>
                  <option value="chapter5">Step 5 — Chapter Five</option>
                  <option value="proposal">Research proposal — Chapters 1–3</option>
                  <option value="full">Full thesis — preliminary pages + Chapters 1–5 + references + appendices</option>
                </select>
              </label>

              <label className="field">
                <span>Degree level</span>
                <select name="degreeLevel" defaultValue="undergraduate">
                  <option value="undergraduate">Undergraduate / First Degree</option>
                  <option value="pgde">PGDE</option>
                  <option value="masters">Master&apos;s</option>
                  <option value="phd">PhD</option>
                </select>
              </label>

              <label className="field">
                <span>Target pages for this generation</span>
                <input name="targetPages" type="number" min="4" max="100" defaultValue="15" />
              </label>

              <label className="field">
                <span>Research approach</span>
                <select name="methodologyType" defaultValue="unspecified">
                  <option value="unspecified">Use approved methodology supplied below</option>
                  <option value="quantitative">Quantitative</option>
                  <option value="qualitative">Qualitative</option>
                  <option value="mixed">Mixed methods</option>
                  <option value="secondary">Secondary / documentary data</option>
                </select>
              </label>

              <label className="field full">
                <span>Section focus (optional)</span>
                <input name="sectionFocus" maxLength={300} placeholder="e.g. 2.1 Conceptual Framework, 2.3 Empirical Review, 4.6 Test of Hypotheses" />
              </label>

              <label className="field">
                <span>Paragraph development</span>
                <select name="paragraphTarget" defaultValue="13-15-lines">
                  <option value="13-15-lines">Expert target — substantial paragraphs approximating 13–15 lines</option>
                  <option value="balanced">Balanced academic paragraphs</option>
                </select>
              </label>

              <label className="field">
                <span>Citation density</span>
                <select name="citationDensity" defaultValue="intensive">
                  <option value="intensive">Intensive — target 3–5 verified citations in literature-heavy paragraphs</option>
                  <option value="standard">Standard — cite evidence where academically necessary</option>
                </select>
              </label>

              <label className="field">
                <span>Empirical study target (Chapter 2)</span>
                <input name="empiricalStudyTarget" type="number" min="13" max="20" defaultValue="15" />
              </label>

              <label className="field">
                <span>Theoretical framework</span>
                <input value="Exactly 3 theories in Expert Mode" readOnly />
              </label>

              <label className="field">
                <span>Minimum verified references target</span>
                <input name="minimumReferences" type="number" min="10" max="150" defaultValue="50" />
              </label>

              <label className="field">
                <span>Reference year window</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input aria-label="Reference start year" name="referenceYearStart" type="number" min="1900" max={currentYear} defaultValue={Math.max(2015, currentYear - 10)} />
                  <input aria-label="Reference end year" name="referenceYearEnd" type="number" min="1900" max={currentYear} defaultValue={currentYear} />
                </div>
              </label>

              <label className="field">
                <span>Completion month and year</span>
                <input name="monthYear" required defaultValue="August 2026" placeholder="e.g. August 2026" />
              </label>

              <label className="field full">
                <span>Thesis / project title</span>
                <input name="title" required maxLength={300} placeholder="Enter the approved research title" />
              </label>

              <label className="field">
                <span>Student full name</span>
                <input name="studentName" required placeholder="Surname and other names as approved" />
              </label>

              <label className="field">
                <span>Matriculation number</span>
                <input name="matricNumber" required placeholder="e.g. NOU123456789" />
              </label>

              <label className="field">
                <span>Faculty</span>
                <input name="faculty" required placeholder="e.g. Arts, Education, Social Sciences" />
              </label>

              <label className="field">
                <span>Department</span>
                <input name="department" required placeholder="Department" />
              </label>

              <label className="field">
                <span>Programme</span>
                <input name="programme" required placeholder="e.g. B.Sc. Political Science" />
              </label>

              <label className="field">
                <span>Award statement</span>
                <input name="award" required placeholder="e.g. Bachelor of Science (B.Sc.) in Political Science" />
              </label>

              <label className="field">
                <span>Study Centre</span>
                <input name="studyCentre" placeholder="NOUN Study Centre" />
              </label>

              <label className="field">
                <span>Supervisor</span>
                <input name="supervisor" placeholder="Supervisor&apos;s name" />
              </label>

              <label className="field full">
                <span>Existing chapter / previous thesis work (optional)</span>
                <textarea name="existingWork" rows={12} placeholder="Paste an existing chapter or previous draft when you want the Expert Writer to continue, expand, restructure or correct it instead of starting from zero." />
              </label>

              <label className="field full">
                <span>Supervisor corrections (optional but high priority)</span>
                <textarea name="supervisorCorrections" rows={8} placeholder="Paste supervisor comments, corrections, required headings, rejected wording, methodology changes or defense corrections. Expert Mode treats these as mandatory instructions." />
              </label>

              <label className="field full">
                <span>Background / research brief</span>
                <textarea name="backgroundBrief" rows={7} placeholder="Explain the topic, variables, location, rationale, research gap and approved background notes." />
              </label>

              <label className="field full">
                <span>Statement of the problem</span>
                <textarea name="problemStatement" rows={6} placeholder="Paste the approved problem statement or explain the research gap the study should address." />
              </label>

              <label className="field full">
                <span>Aim / purpose and specific objectives</span>
                <textarea name="objectives" rows={7} placeholder="Enter the approved general objective and numbered specific measurable objectives." />
              </label>

              <label className="field full">
                <span>Research questions and/or hypotheses</span>
                <textarea name="researchQuestions" rows={7} placeholder="Paste the approved research questions and null/alternative hypotheses where applicable." />
              </label>

              <label className="field full">
                <span>Methodology details</span>
                <textarea name="methodology" rows={10} placeholder="Area of study, research design, sources of data, population, sample size and formula, sampling technique, instruments, validity, reliability, collection procedure, analysis methods, software and limitations/ethics where applicable." />
              </label>

              <label className="field full">
                <span>Verified findings / data for Chapters 4 and 5</span>
                <textarea name="findingsData" rows={12} placeholder="Paste verified response rates, demographic tables, SPSS/Excel output, coefficients, p-values, interview themes, quotations, findings or analysis notes. Leave blank if results are unavailable; the writer inserts placeholders rather than inventing data." />
              </label>

              <label className="field full">
                <span>Verified source pack / APA references</span>
                <textarea name="verifiedSources" rows={15} placeholder="Paste verified peer-reviewed articles, official reports and references, preferably one reference per line with DOI or official URL where available. The writer may cite only sources identifiable here." />
              </label>

              <div className="field full check-row">
                <input type="hidden" name="requireDoiOrUrl" value="off" />
                <input type="hidden" name="includeQualityAudit" value="off" />
                <input type="hidden" name="includeDefensePack" value="off" />
                <input type="hidden" name="automaticTableOfContents" value="off" />
                <label><input type="checkbox" name="requireDoiOrUrl" value="on" defaultChecked /> Audit DOI / official URL coverage</label>
                <label><input type="checkbox" name="includeQualityAudit" value="on" defaultChecked /> Append Expert Quality Audit</label>
                <label><input type="checkbox" name="includeDefensePack" value="on" /> Append Thesis Defense Preparation Pack</label>
                <label><input type="checkbox" name="automaticTableOfContents" value="on" defaultChecked /> Insert automatic Word table of contents</label>
              </div>

              <label className="field full">
                <span>Faculty / supervisor-specific instructions</span>
                <textarea name="facultyInstructions" rows={7} placeholder="Add faculty-specific chapter headings, citation rules, page requirements, terminology or supervisor instructions that override the general NOUN baseline." />
              </label>

              <label className="field full">
                <span>Dedication (optional)</span>
                <textarea name="dedication" rows={3} placeholder="Enter the student&apos;s approved dedication, or leave blank for a placeholder." />
              </label>

              <label className="field full">
                <span>Acknowledgements (optional)</span>
                <textarea name="acknowledgement" rows={5} placeholder="Enter approved acknowledgements, or leave blank for a placeholder." />
              </label>

              <label className="field full">
                <span>Appendices / instruments (optional)</span>
                <textarea name="appendices" rows={8} placeholder="Questionnaire, interview guide, consent form, letter of introduction, attestation, additional tables or approved supporting materials." />
              </label>
            </div>

            <div className="notice" style={{ marginTop: 16 }}>
              <strong>Expert workflow:</strong> chapter-by-chapter generation is now the default. Chapter Two can target 13–20 verified empirical studies, exactly three theories and strong citation density. A Section Focus can be used to generate only 2.1, 2.3, 4.6 or another large subsection before combining the supervised work.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>Evidence firewall:</strong> citation-density and reference-count settings are targets, not permission to invent sources. The writer may cite only the verified source pack. Unsupported claims become <strong>[Add verified citation]</strong>; missing data become <strong>[Insert verified result/data]</strong>. Chapter Four never fabricates respondents, tables, p-values or interview quotations.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>Automatic Quality Audit:</strong> when enabled, the downloaded Word file reports the number of supplied reference lines, DOI/URL coverage, detected citations, unresolved citation/result placeholders and Chapter Two heading-rule violations, followed by a supervisor checklist.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>NOUN formatting baseline:</strong> A4, Times New Roman 12pt, 1-inch margins, justified body text, first-line indentation, double spacing, bold chapter/subheadings, chapter page breaks, APA-style hanging references, Roman-numbered preliminary pages and Arabic-numbered main text. The full-thesis abstract remains single-spaced and capped at 400 words.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>Faculty differences:</strong> the 23-word title rule is enforced only when the Faculty field indicates Education. Other faculties use the approved title and the Faculty/Supervisor Instructions field for their specific requirements.
            </div>

            <div className="notice" style={{ marginTop: 10 }}>
              <strong>AI connection:</strong> {aiConfigured ? `Configured${aiModel ? ` with ${aiModel}` : ""}.` : "Not fully configured. Add AI_API_KEY, AI_BASE_URL and AI_MODEL in Vercel before using the thesis writer."}
            </div>

            <button className="btn primary conversion-download-btn" type="submit">🎓 Generate Expert NOUN Word Draft (.docx)</button>
          </form>
        </article>

        <aside className="card conversion-business-card">
          <span className="poster-kicker">EXPERT THESIS WORKFLOW</span>
          <h2>What is enhanced</h2>
          <div className="conversion-feature-list">
            <div><strong>Sequential chapters</strong><span>Chapter One is the default starting point; continue only after review.</span></div>
            <div><strong>Section Focus</strong><span>Generate one demanding subsection at a time for long literature reviews and results chapters.</span></div>
            <div><strong>Supervisor Correction Mode</strong><span>Paste existing work plus corrections and the writer prioritizes the supervisor&apos;s instructions.</span></div>
            <div><strong>Expert Chapter Two</strong><span>Eight thematic conceptual areas where suitable, exactly three theories, verified empirical studies and a research-gap synthesis.</span></div>
            <div><strong>Reference Firewall</strong><span>Only supplied verified sources may become citations; missing evidence is visibly flagged.</span></div>
            <div><strong>Data Firewall</strong><span>No invented respondents, statistics, tables, significance tests, interview quotations or findings.</span></div>
            <div><strong>Quality Audit</strong><span>Reference count, DOI/URL coverage, placeholders and structural checks are appended automatically.</span></div>
            <div><strong>Defense Pack</strong><span>Optional opening statement, methodology defense and likely examiner questions grounded in the thesis.</span></div>
            <div><strong>Word-ready NOUN format</strong><span>Preliminary pages, pagination, headings, APA references and appendices remain automated.</span></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
