# Mabrig Researcher Pro

Mabrig Researcher Pro combines three Mabrig products into one research workspace:

- **Mabrig PublishAI** — journal intelligence, publishing pathways, citation audits, submission readiness, visibility strategy and research-publishing administration.
- **DocForge AI** — configurable Word-document generation, cleanup, rewriting and professional academic formatting.
- **Mabrig Academic Assistance** — document submission, order tracking, payments, client instructions, thesis tools, printing, binding and human-assisted services.

The original repositories remain independent. This repository is the consolidated product and future source of truth for shared Researcher Pro development.

The platform also includes an evidence-safe thesis humanizer, a Chapter Two Research Studio for DOI-traceable literature reviews, a local-first Chapter Four Data Analysis Lab, and the MABRIG Open Research Repository for moderated rights-cleared scholarly deposits with permanent public records.

## Agentic Research OS

The `/research-agent` workspace adds an auditable multi-agent research flow: Mission Planner → Literature Scout → Evidence Auditor → Synthesis Agent → Grounding Critic → specialist handoffs. It uses Crossref for DOI-registered discovery, OpenAlex for secondary verification and retraction/open-access signals, deterministic evidence scoring, source-ID constrained synthesis, and a deep-mode second-pass critique when an AI provider is configured. The agent never treats retrieval scores as truth and explicitly preserves full-text and human-review gates.

## Main workspaces

| Route | Purpose |
| --- | --- |
| `/` | Unified Researcher Pro landing page |
| `/workspace` | Persistent browser-based manuscript profile and guided workflow |
| `/research-agent` | Agentic Research OS for multi-step planning, DOI-backed discovery, OpenAlex verification, evidence scoring, grounded synthesis and critique |
| `/academic-indexing-agent` | Public step-by-step Google Scholar indexing-readiness agent for identity, metadata, rights-safe hosting, crawl discovery, Highwire tags and verification |
| `/repository` | MABRIG Open Research Repository public search and approved scholarly records |
| `/repository/submit` | Moderated rights-safe scholarly deposit workflow |
| `/repository/works/[slug]` | Permanent one-work-per-URL scholarly landing page with Highwire metadata and JSON-LD |
| `/repository/researchers/[slug]` | Public researcher profile and approved outputs |
| `/humanizer` | Thesis style diagnostics, voice-preserving editing, five integrity firewalls, comparison and Word export |
| `/chapter-two` | DOI-registered article search, conceptual/theoretical frameworks, previous-study synthesis and Word export |
| `/chapter-four` | CSV-based descriptive statistics, Likert reliability, correlation, chi-square, regression and Word report export |
| `/formatter` | Public DocForge formatting and Word export studio |
| `/publishing-agent` | Manuscript-specific publishing pathway |
| `/free-journals` | Evidence-aware journal directory |
| `/scopus-journals` | Separate Scopus-pathway directory and verification guidance |
| `/academic-support` | Academic assistance and service ordering |
| `/academic-printing/order` | Document upload, instructions, pricing and payment flow |
| `/track` | Client order tracking and follow-up instructions |
| `/pricing` | Transparent self-service and human-assisted plans |
| `/trust` | Research integrity, journal evidence, privacy and oversight commitments |
| `/privacy`, `/terms` | Public privacy notice and terms of use |
| `/admin` | Protected operations dashboard |
| `/admin/submission-readiness` | Submission readiness gate |
| `/admin/journal-matrix` | Multi-journal comparison |
| `/admin/citation-auditor` | DOI, citation and retraction-signal audit |
| `/admin/scholar-auditor` | Google Scholar compatibility audit |
| `/admin/google-scholar-studio` | Lecturer Google Scholar indexing/visibility readiness studio with profile, crawlability and metadata action plan |
| `/admin/scopus-studio` | Lecturer Scopus visibility studio for author-profile cleanup, source coverage verification and publication readiness |
| `/admin/lecturer-agent` | Persistent, review-gated workflows for grading, grants, thesis supervision, publication and APER/EAA evidence |
| `/admin/repository` | Protected repository moderation queue for rights and metadata review |

## Responsible-use boundary

Researcher Pro supports legitimate research planning, editing, formatting, citation checking and publication preparation. It must not invent sources, guarantee journal acceptance, misrepresent indexing, or replace the researcher's responsibility for authorship and factual accuracy.

The Academic Indexing Agent does not use Google's Indexing API for scholarly articles because Google restricts that API to eligible JobPosting and livestream BroadcastEvent pages. It instead follows Scholar-compatible crawlability, bibliographic metadata, sitemap/Search Console and verification workflows.

The MABRIG Open Research Repository keeps new deposits private until an administrator verifies both the sharing rights/version and the scholarly metadata. Approved records receive permanent public URLs, Highwire/Google Scholar metadata, structured ScholarlyArticle data, author profiles, public PDF delivery when a rights-cleared PDF is supplied, and automatic sitemap inclusion. Repository publication does not guarantee Google Scholar indexing, citations or academic impact.

Lecturer Agent Hub external actions are disabled by default. Grades, portal uploads, grant submissions, student feedback, journal submissions, profile updates and APER/EAA claims require a recorded lecturer decision. A recorded approval marks a package ready for a separately configured integration; it does not bypass institutional authorization or submit anything by itself.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Required production configuration

At minimum, configure:

- `MONGODB_URI`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `PAYSTACK_SECRET_KEY` when checkout is enabled
- one supported AI provider for AI-enhanced features

The deterministic journal and formatting tools remain useful when optional AI providers are unavailable. See `.env.example` for the full integration list.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Source products

- <https://github.com/mabrig1/publish>
- <https://github.com/mabrig1/docforge-ai>
- <https://github.com/mabrig1/mabrig-academic-assistance>

## Licence

Private commercial product. Copyright Mabrig Technologies.
