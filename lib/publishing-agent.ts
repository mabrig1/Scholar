import { scopusCostMeta, scopusJournals, scopusSourcesUrl, type ScopusJournal } from "@/lib/scopus-journals";

export type PublishingAgentInput = {
  title: string;
  abstract: string;
  keywords: string;
  field: string;
  articleType: string;
  budget: "zero" | "low" | "moderate" | "flexible";
  indexingGoal: "scopus" | "verified" | "either";
  studyStage: "idea" | "draft" | "complete" | "revising";
};

export type RankedScopusJournal = ScopusJournal & {
  matchScore: number;
  matchReasons: string[];
  scopusUrl: string;
  costLabel: string;
};

const budgetPriority: Record<PublishingAgentInput["budget"], number> = {
  zero: 0,
  low: 1,
  moderate: 2,
  flexible: 3,
};

function words(value: string) {
  return value.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [];
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function phraseMatch(text: string, phrase: string) {
  const normalized = phrase.toLowerCase().trim();
  if (normalized.length >= 3) return text.includes(normalized);
  return text.split(/[^a-z0-9]+/).includes(normalized);
}

function readiness(input: PublishingAgentInput) {
  const abstractWords = input.abstract.trim().split(/\s+/).filter(Boolean).length;
  const keywordCount = input.keywords.split(",").map((item) => item.trim()).filter(Boolean).length;
  const text = `${input.title} ${input.abstract}`.toLowerCase();
  let score = 20;
  const checks = [
    { label: "Focused title (8–24 words)", passed: input.title.trim().split(/\s+/).length >= 8 && input.title.trim().split(/\s+/).length <= 24, weight: 12 },
    { label: "Substantive abstract (150–350 words)", passed: abstractWords >= 150 && abstractWords <= 350, weight: 18 },
    { label: "At least 3 keywords", passed: keywordCount >= 3, weight: 10 },
    { label: "Method or study design is visible", passed: includesAny(text, ["method", "design", "survey", "experiment", "interview", "sample", "analysis"]), weight: 15 },
    { label: "Results or findings are visible", passed: includesAny(text, ["result", "finding", "showed", "revealed", "demonstrated", "significant"]), weight: 15 },
    { label: "Conclusion or implication is visible", passed: includesAny(text, ["conclusion", "implication", "recommend", "suggest", "contribute"]), weight: 10 },
  ];
  for (const check of checks) if (check.passed) score += check.weight;
  return {
    score: Math.min(score, 100),
    level: score >= 80 ? "submission-focused" : score >= 60 ? "promising draft" : "development required",
    checks,
    abstractWords,
    keywordCount,
  };
}

export function rankScopusJournals(input: PublishingAgentInput, limit = 6): RankedScopusJournal[] {
  const manuscriptText = `${input.field} ${input.keywords} ${input.title} ${input.abstract}`.toLowerCase();
  const priorityText = `${input.field} ${input.keywords} ${input.title}`.toLowerCase();
  const manuscriptWords = new Set(words(manuscriptText));
  const genericTerms = new Set(["analysis", "data", "research", "study", "result", "method", "article", "science"]);

  return scopusJournals
    .map((journal) => {
      let score = 10;
      const matchedTags = journal.fieldTags.filter((tag) => {
        const tagWords = words(tag);
        const exactMatch = phraseMatch(manuscriptText, tag);
        const distinctiveMatch = tagWords.some((word) => word.length >= 6 && !genericTerms.has(word) && manuscriptWords.has(word));
        return exactMatch || distinctiveMatch;
      });
      score += Math.min(matchedTags.length * 12, 60);
      if (journal.fieldTags.some((tag) => phraseMatch(priorityText, tag))) score += 18;
      const disciplineWords = words(journal.discipline).filter((word) => word.length >= 6 && !genericTerms.has(word));
      if (disciplineWords.some((word) => priorityText.includes(word))) score += 8;

      const costPriority = scopusCostMeta[journal.costRoute].priority;
      const affordable = costPriority <= budgetPriority[input.budget];
      if (affordable) score += input.budget === "zero" ? 22 : 14;
      else score -= 18;

      const matchReasons: string[] = [];
      if (matchedTags.length) matchReasons.push(`Topic overlap: ${matchedTags.slice(0, 3).join(", ")}`);
      else matchReasons.push("Broad field match needs manual scope review");
      matchReasons.push(affordable ? "Fits the selected cost ceiling as a starting route" : "May exceed the selected cost ceiling; investigate waivers or exclude");

      return {
        ...journal,
        matchScore: Math.max(0, Math.min(score, 100)),
        matchReasons,
        scopusUrl: scopusSourcesUrl(journal.scopusSearchTerm),
        costLabel: scopusCostMeta[journal.costRoute].label,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || scopusCostMeta[a.costRoute].priority - scopusCostMeta[b.costRoute].priority)
    .slice(0, limit);
}

export function buildPublishingPlan(input: PublishingAgentInput) {
  const readinessResult = readiness(input);
  const candidates = rankScopusJournals(input);
  const zeroFirst = input.budget === "zero" || input.budget === "low";

  const costPlan = zeroFirst
    ? [
        "Start with diamond open-access journals and sponsored journals that state no mandatory author fee.",
        "Keep a parallel no-fee subscription route if immediate open access is not essential.",
        "Check institutional or country-based agreements and request a waiver before submission where the policy permits it.",
        "Never pay an invoice until the journal title, ISSN, Scopus coverage and official fee page have all been verified.",
      ]
    : [
        "Rank scope fit and methodological fit first, then compare the full publication cost.",
        "Check institutional agreements, funder support and country-based waivers before accepting an APC.",
        "Record every fee in writing from the official journal site; exclude optional editing and fast-track upsells from the core APC comparison.",
        "Keep at least one zero-fee fallback journal in the submission ladder.",
      ];

  return {
    readiness: readinessResult,
    candidates,
    pathway: input.indexingGoal === "scopus" ? "Scopus-first, cost-controlled pathway" : input.indexingGoal === "verified" ? "Verified-journal, evidence-first pathway" : "Balanced verification and Scopus pathway",
    costPlan,
    stages: [
      {
        id: "diagnose",
        title: "1. Diagnose the manuscript",
        outcome: "A correction list covering contribution, study design, evidence, references, ethics and reporting completeness.",
        actions: [
          "State one precise research problem, one evidence-based contribution and the target audience.",
          "Confirm that the abstract reports context, objective, methods, key results and conclusion.",
          "Use the appropriate reporting checklist where relevant: CONSORT, PRISMA, STROBE, CARE or discipline equivalent.",
        ],
      },
      {
        id: "shortlist",
        title: "2. Build a three-journal ladder",
        outcome: "One primary journal and two fallbacks with documented scope, cost and indexing evidence.",
        actions: [
          "Read at least five recent articles from each candidate and compare topic, method, population and article type.",
          "Verify exact title and ISSN in Scopus Sources; reject discontinued coverage or mismatched titles.",
          "Verify the official APC, waiver, subscription and institutional-agreement routes on the same day the shortlist is finalized.",
        ],
      },
      {
        id: "prepare",
        title: "3. Engineer the submission package",
        outcome: "A journal-specific manuscript, cover letter, declarations and clean technical files.",
        actions: [
          "Follow the current author guidelines for word count, headings, references, figures, tables and supplementary files.",
          "Prepare authorship, ORCID, ethics, consent, funding, conflicts, data availability and AI-use disclosures where applicable.",
          "Write a brief cover letter explaining fit and contribution without exaggerated novelty or invented metrics.",
        ],
      },
      {
        id: "submit",
        title: "4. Submit through the official portal",
        outcome: "A traceable submission made by the author through the verified journal system.",
        actions: [
          "Use only the submission link reached from the journal's official website.",
          "Save the manuscript version, confirmation email, manuscript ID and every uploaded file.",
          "Do not submit the same manuscript to more than one journal at the same time.",
        ],
      },
      {
        id: "respond",
        title: "5. Manage peer review and publication",
        outcome: "A disciplined response-to-reviewers package and verified final scholarly record.",
        actions: [
          "Answer every reviewer point in a numbered matrix and identify exactly where the manuscript changed.",
          "Challenge requests respectfully when evidence or ethics requires it; never fabricate new analyses or citations.",
          "After publication, verify DOI, ORCID, author name, affiliation and Scopus record; request corrections through official channels if needed.",
        ],
      },
    ],
    redFlags: [
      "Indexing claimed only on the journal website with no matching current Scopus source record.",
      "Guaranteed acceptance, guaranteed indexing or an unrealistically short peer-review promise.",
      "Payment requested through a personal account, chat message or unrelated domain.",
      "Hidden APCs, unclear waiver rules, fake metrics, copied editorial-board identities or a mismatched ISSN.",
      "Pressure to add citations that do not improve the manuscript or to conceal AI-generated/fabricated content.",
    ],
    evidenceSources: [
      { label: "Scopus Sources", url: scopusSourcesUrl() },
      { label: "DOAJ journal search", url: "https://doaj.org/" },
      { label: "Think. Check. Submit.", url: "https://thinkchecksubmit.org/journals/" },
      { label: "EQUATOR reporting guidelines", url: "https://www.equator-network.org/" },
    ],
  };
}
