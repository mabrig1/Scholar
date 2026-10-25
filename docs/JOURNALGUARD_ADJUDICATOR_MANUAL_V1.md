# JournalGuard independent benchmark — adjudicator operating manual (v1.0, DRAFT)

**Status: protocol and empty templates only. No cases adjudicated or metrics measured.**
Protocol maintainer: Mabrig Technologies. Reference labels must be determined by reviewers independent of the author and of JournalGuard's outputs.

## Scope and unit of evaluation
The benchmark unit is **(case_id, claim_id)**, not "is this journal predatory?" or "is this journal Scopus-indexed?"
Supported claim IDs in `journalguard.claims.v1`:
`issn_checksum`, `website_https_scheme`, `publisher_domain_authorization`,
`doi_syntax`, `doi_registration`, `doi_title_consistency`,
`scopus_journal_coverage`, `scopus_article_indexing`.

The first two narrow syntactic claims are *not* statements about the integrity of a journal. DOI registration is not publisher verification or peer review. Authoritative Scopus records, when licensed and accessible, are mandatory for any non-abstaining Scopus decision.

## Sampling plan
Plan for 150 *journal/article cases* and a held-out set that is never used for coding decisions or threshold tuning. Initial recruitment targets: 60 cases with documented supported identity claims, 60 with documented contradictory claims, and 30 with insufficient/ambiguous independent evidence. These are **prospective targets**; do not fill the target into the gold-label field. The final reference label is set independently *for each claim* and may disagree with the sampling target.
Stratify by discipline, journal region, journal language, publisher type, identifier availability and source accessibility. Record sampling exclusions and inclusion dates; avoid using JournalGuard flags or outputs to identify test items. Capture permission terms and do not redistribute licensed source files.

## Independent annotation
1. Research coordinator selects and locks case IDs, sample date, source eligibility rules, code commit and immutable file hashes.
2. Adjudicators A and B independently inspect original, dated sources with JournalGuard predictions hidden. They independently annotate each applicable claim as `supported`, `contradicted`, `unknown`, or `not_applicable`.
3. Use direct evidence: registration-agency metadata for DOI registration, ISSN standard checksum for the checksum claim; independent publisher registry or official site attestations for publisher authorization; authorized Scopus source/document evidence for the distinct indexing claims.
4. Cite the exact evidence URL/record key, date, snapshot hash, rationale, and any license/access restriction. Reject claims based on a search snippet, HTTPS padlock, DOI existence alone or the system's risk score.
5. Any disagreement goes to an independent third reviewer; preserve original two labels and their evidence, and record reconciliation rationale before executing JournalGuard on the test set.
6. If relevant reliable evidence is missing or inaccessible, choose `unknown` rather than infer a negative claim. Do not label journal misconduct solely from an ISSN or domain inconsistency.

## Locked evaluation
Record model commit, claim schema, engine configuration, source API versions, network status and frozen timestamp. Execute system/baselines on identical cases **after** reference labels are locked. Preserve request/response JSON and failures. Prevent inadvertent third-party requests with personal or confidential data. Redact secrets.
The current implementation uses hardcoded Crossref/DataCite endpoints and never fetches an arbitrary submitted journal URL. V3 does not validate publisher authorization via an authenticated registry; its domain-auth claim should remain `unknown`.

## Metrics and denominators
For claim-level *decidable* reference labels (supported/contradicted):
- **Coverage** = (supported or contradicted predictions on decidable cases) / all decidable cases.
- **Selective risk** = wrong decisive predictions / all decisive predictions on decidable cases.
- **Abstention rate** = unknown predictions / all evaluable cases; separately show not_applicable.
- **Contradiction precision** = true contradictions predicted as contradicted / all contradicted predictions with decidable gold labels.
- **Contradiction recall** = true contradictions predicted as contradicted / all contradiction gold labels. Count abstentions as misses in this definition.
- **False-accusation rate** = supported gold labeled contradicted / all supported gold labels. Report with abstention-inclusive denominator and separately risk conditional on a decisive prediction.
Provide confusion matrices including abstentions, per-claim numbers, sampling-unit confidence intervals, and pre-registered small-cell suppression rules.
Do not pool multiple correlated claims from the same journal as independent observations when estimating uncertainty; use journal-level clustered bootstrap or justified hierarchical models. With small cells, display `insufficient N`, not over-interpreted subgroup conclusions.
For annotator agreement, report percent agreement and Cohen's kappa where appropriate before reconciliation, with prevalence caveats.

## Deliverables and publication guardrails
- Frozen benchmark case list, inclusion/exclusion ledger, two independent labels, tie-break resolutions, licensed-evidence references, hashes, prediction logs, script version, raw confusion matrices and uncertainty intervals.
- Distinguish held-out score from development runs. Report comparisons to ISSN/DOI-only and Crossref-only baselines, including requests/timeouts, where implemented.
- Do not call the study completed or cite percentages until independently labeled and run.
- The 150 cases are a recruitment target, not yet a statistical power calculation. Confirm the sample-size rationale and preregistration before collection.
- Maintain a documented correction and appeal process before any public journal identity flags are displayed.
