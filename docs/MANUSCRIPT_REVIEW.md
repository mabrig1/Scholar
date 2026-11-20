# Manuscript Review Studio

Route: `/manuscript-review`, linked from the homepage, manuscript workspace and sitemap.

The video-inspired workflow provides eight review areas (methodology, statistics, citations, logic, ethics, reproducibility, novelty, writing), an editor overview, evidence-linked comments and an author revision checklist. It does not copy another product's branding or claim equivalent evaluation performance.

## Use

1. Paste text, load the saved workspace abstract, import PDF/DOCX/TXT/Markdown, or try the clearly fictional teaching example.
2. Select empirical/review/theoretical work and full-manuscript/excerpt scope. Uploads are limited to 5 MB; reviews to 60,000 characters. Longer documents are rejected, never silently truncated. Scanned PDFs require separate OCR.
3. Run basic screening in the browser. Optional AI review requires a separate explicit sharing choice. Input changes clear prior reports, checklist state and sharing consent.
4. Inspect comments and numbered source paragraphs. Mark items addressed only after checking them. This status is author-reported, not independent verification.
5. Export Word, Markdown or JSON before closing the tab. Continue source checking in Evidence Atlas, analysis in Chapter Four Lab, writing in the humanizer or submission planning in the publishing agent.

## Processing and limits

- Basic mode uses fixed reporting rules. Missing keywords are prompts to inspect reporting, not proof that content is absent or research is defective. No numeric quality scores, fake reviewer progress or acceptance forecasts are produced.
- AI mode calls the existing configured provider fallback with one structured review prompt covering all eight areas. It is not an independent multi-model swarm. Provider and model appear in successful reports.
- The JSON validator rejects unknown reviewers, invalid priorities/fields, oversized output, duplicate findings, nonexistent paragraph IDs and quotations that do not occur verbatim in the cited paragraph. Quotation matching does not verify the model's reasoning. Provider or validation failures visibly return basic screening.
- The manuscript is untrusted prompt data. There are no model tools, browsing actions, publication actions or unescaped HTML rendering. Novelty, source validity, ethics and statistics are not independently verified by this workflow.
- Paste/basic screening is browser-local. Uploading sends the file to Scholar for extraction; Word export sends the report for document generation; AI consent sends text to configured provider(s), potentially including fallback providers. These routes do not persist manuscripts or reports or log their text. The review tab does not write manuscript data to localStorage. External provider and infrastructure policies still apply.
- Routes use bounded body readers (including requests without content-length), no-store responses and existing per-instance rate limiting. Production platform limits remain necessary for stronger abuse control. Existing public AI features share the repository's deployment/security model.
- No new dependency, secret or database migration. Existing `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` or `GEMINI_API_KEY` and their model settings are reused. Without a configured provider the local screening experience still works.

## Validation

`npm run typecheck`, `npm test`, `npm run build`. New tests cover excerpt/theoretical/qualitative behavior, p-value reporting, exact passage validation, consent, streamed body limits, AI failure modes, TXT/DOCX extraction and real DOCX export. AI tests use explicit fixtures rather than paid provider calls. Provider availability and production deployment must be verified separately.

The added PDF fixture checks text-based PDF extraction, and oversized-text coverage verifies that imports fail instead of truncating. All 79 tests passed locally. The repository's required dependency audit detected existing Mongoose advisories; the pinned version was patched from 8.24.4 to 8.24.10 (with its mquery patch), after which `npm audit --audit-level=high` reported zero vulnerabilities.

Browser QA is unverified in this environment: the managed preview runner appends `--host` and `--strictPort` to `next dev`, which does not accept those flags. The app's working development command was not changed to accommodate the preview infrastructure. Review desktop/mobile layout and the complete interactive flow in a compatible Next.js preview before release.
