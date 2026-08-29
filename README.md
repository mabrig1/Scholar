# Mabrig Researcher Pro

Mabrig Researcher Pro combines three Mabrig products into one research workspace:

- **Mabrig PublishAI** — journal intelligence, publishing pathways, citation audits, submission readiness, visibility strategy and research-publishing administration.
- **DocForge AI** — configurable Word-document generation, cleanup, rewriting and professional academic formatting.
- **Mabrig Academic Assistance** — document submission, order tracking, payments, client instructions, thesis tools, printing, binding and human-assisted services.

The original repositories remain independent. This repository is the consolidated product and future source of truth for shared Researcher Pro development.

The platform also includes an evidence-safe thesis humanizer, a Chapter Two Research Studio for DOI-traceable literature reviews and a local-first Chapter Four Data Analysis Lab for thesis results, statistical tables, assumption-aware interpretation and editable Word export.

## Main workspaces

| Route | Purpose |
| --- | --- |
| `/` | Unified Researcher Pro landing page |
| `/workspace` | Persistent browser-based manuscript profile and guided workflow |
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

## Responsible-use boundary

Researcher Pro supports legitimate research planning, editing, formatting, citation checking and publication preparation. It must not invent sources, guarantee journal acceptance, misrepresent indexing, or replace the researcher's responsibility for authorship and factual accuracy.

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
