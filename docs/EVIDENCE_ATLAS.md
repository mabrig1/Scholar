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

Counts of source classifications are not a validated consensus score, meta-analysis or statement of causal certainty. Abstract-only assessments are visibly labeled and counted separately. Research-gap inference, automatic claim extraction, AI summarization and bidirectional Zotero syncing are not implemented in this release.

No unauthenticated write endpoints, cloud project storage, automatic PDFs, user account migration, live deployment or production changes are included.

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

1. Search and screening coverage log; PDF/page anchoring and evidence extraction proposals.
2. Context-aware contradiction review, structured research-gap detection and method-aware evidence quality review.
3. Authentication and cloud projects through separately deployable service.
4. Zotero read import first; user-approved notes/tags exports later.
5. StatLab results linking, objective alignment, collaboration and reproducible literature review export.
