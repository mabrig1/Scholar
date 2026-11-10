# MABRIG Evidence Atlas — v1 implementation and independent architecture

## What is implemented

- Route: /evidence-atlas, in the root Next.js App Router tree (not src/app).
- Browser-local project persistence with JSON export/import, strict versioned validation.
- Crossref DOI-registered paper search via Scholar's existing /api/research/articles adapter; optional OpenAlex metadata enrichment.
- Deduplicated paper library (50 sources per project for the first release).
- User-authored claim propositions (40 per project).
- Human-reviewed, passage-linked, abstract/full-text scoped classifications (300 assessments per project).
- Interactive bipartite map: paper nodes and claim nodes joined by classified evidence records.
- Claim dossier and counts without fabricated consensus percentages.
- **Phase 2: project-scoped research-gap audit** of review coverage, unreviewed claims, potential human-classified disagreements, abstract-only evidence, missing passage locators, methodological notes and retraction metadata flags.
- Exportable Markdown audit with DOI source links, evidence record IDs, reproducibility caveats and concrete follow-up questions.
- Append-only-with-bounded-retention research history for searches and map edits.
- Native Node test coverage for round trips, deduplication, evidence replacement, provenance and invalid imports.
- Home-page entry point.

## Independent domain boundary

Evidence Atlas's domain model is isolated from Scholar's billing, admin authentication, MongoDB models, AI providers, publishing and routing. It uses plain TypeScript types and deterministic functions with no runtime package dependencies.

At this stage the workbench is **local-first**, not a separately deployed FastAPI service. A future service can implement the same versioned AtlasProject contract and expose authenticated project APIs while retaining this browser interface. No separate server is claimed to be deployed or connected.

For an independently operated service:
1. Move the domain package to a versioned standalone package and publish a shared JSON Schema.
2. Provide a separate Python FastAPI service with POST /v1/projects, GET /v1/projects/:id, POST /v1/assessments and GET /v1/graph.
3. Use server-enforced Scholar identity/authorization, CSRF defenses where applicable, per-project ownership and tenant-isolated storage.
4. Add a queue for PDF extraction and optional source-grounded claim proposals. Require a human approval gate before classifying evidence.
5. Add integration adapters for Zotero and StatLab with explicit opt-in, tenant boundaries and reversible sync.
6. Establish distributed rate limits, quotas, caching, privacy retention and audit log protection before enabling public cloud storage.
7. Add request/response contract tests and migration tests before switching from browser storage.

**Do not send raw local research content to external providers automatically.**

## Evidence provenance and scientific limitations

Crossref DOI registration verifies bibliographic metadata, not quality, results or full-text authenticity. OpenAlex metadata enrichment is not a second independent full-text review. The search is limited by queries, years and provider coverage.

A claim represents a researcher's proposition. A colored line represents a human-entered classification connected to a source excerpt and explicit review scope. A citation count is **not** a quality score. Retraction flags are displayed; retraction status should be rechecked in the original records.

Counts of source classifications are not a validated consensus score, meta-analysis or statement of causal certainty. Abstract-only assessments are visibly labeled and counted separately. The deterministic gap audit identifies **review-workflow blind spots within a local corpus**, never field-wide research gaps; it does not search all relevant papers, score study quality, verify contradictions or infer novelty. Automatic claim extraction, AI explanations, full-text adjudication and bidirectional Zotero syncing are not implemented.

No unauthenticated write endpoints, cloud project storage, automatic PDFs, user account migration, live deployment or production changes are included.

## Phase 2 gap-intelligence protocol

The gap engine lives in `packages/evidence-atlas-core/src/gap-intelligence.ts`, outside Scholar-specific authentication, databases and payment code. It is run on the client without sending private project content to model providers. Every suggestion is derived from existing paper IDs and source-assessment IDs and can be exported as a Markdown research audit.

Potential disagreement requires both a positive and a negative human classification among sources without a retraction flag; such differences may reflect non-comparable outcomes or populations. A small source count is a workflow reminder, not a valid statistical decision rule. Abstract-only evidence and missing methodology/locators are flagged explicitly. A research question or recommended investigation is **not a claim that the published literature has a verified gap**.

This version deliberately does **not** auto-send the project to external LLMs. A later optional AI layer must provide explicit consent, per-user authorization, strict source allowlists, limits and server-side protections before release.


## Phase 3: source-anchored claim proposals (extractive MVP)

The interface can now select a saved DOI-backed paper and offer candidate sentences from its **existing abstract only**. This version uses **deterministic sentence extraction and outcome-keyword hints, not generative AI**. No user papers, abstracts or private drafts are submitted to third-party language-model APIs.

- Candidates preserve exact \`start\`/\`end\` character spans, DOI, paper ID and verbatim excerpt; approval fails if the source quote has been altered or the source no longer exists.
- A researcher must actively approve a proposed sentence as a *proposition*, not as verified study evidence. Approval never creates support/contradiction classifications.
- Claim provenance is stored as an optional backward-compatible \`AtlasClaim.origin\` field; existing v1 projects with unlinked researcher-authored claims remain supported.
- The review form can then be populated with the source excerpt and an initial **unclear** classification, but **nothing is saved as evidence** until the researcher separately reviews and submits it.
- Import validation checks exact source anchors and rejects tampered or orphaned origin metadata.

The sentence-extraction heuristic can select background claims, hypotheses or secondary citations. It therefore cannot verify that a sentence reports the paper's own results, and is not a scientific fact checker. Future AI extraction must be **opt-in**, use authenticated per-user quotas and server-side validation, return text anchored to lawful source passages and support human review.

## Test and launch gates

- npm ci
- npm run typecheck
- npm test
- npm run build
- Inspect DevShield and dependency audit on the pull request
- Manual: create map, search a real DOI, add a claim, classify a passage, revise it, reload, export/import and verify counts and history.
- Manual: verify keyboard access to graph node selections, narrow mobile layout and accessible assessment labels.
- Manual: test Crossref failure and rate limits. Configure platform distributed rate limiting before expanding traffic.
- Keep the change on a review branch until checks pass. Do not auto-merge or deploy.

## Scope of future milestones

1. Structured search coverage logs (database/date/filter screening), PDF/page anchoring and source-grounded extraction proposals.
2. Human-confirmed research-gap registry, context-aware contradiction review and method-aware evidence quality review beyond the current deterministic audit.
3. Authentication and cloud projects through separately deployable service.
4. Zotero read import first; user-approved notes/tags exports later.
5. StatLab results linking, objective alignment, collaboration and reproducible literature review export.
