import { generateWithAiFallback } from "@/lib/ai-provider";
import {
  crossrefItemToArticle,
  deduplicateArticlesByTitle,
  reconstructOpenAlexAbstract,
  type ScholarlyArticle,
} from "@/lib/scholarly-articles";

export type ResearchMissionType = "literature-review" | "thesis" | "publication" | "grant" | "general";
export type ResearchDepth = "rapid" | "deep";

export type ResearchMissionInput = {
  topic: string;
  researchQuestion?: string;
  objectives?: string;
  field?: string;
  keywords?: string;
  missionType: ResearchMissionType;
  depth: ResearchDepth;
  fromYear: number;
  toYear: number;
  maxSources: number;
};

export type ResearchAgentDefinition = {
  id: string;
  name: string;
  role: string;
  capability: string;
  reviewGate: string;
};

export type ResearchMissionStep = {
  order: number;
  agentId: string;
  title: string;
  goal: string;
  output: string;
  route?: string;
};

export type ScoredEvidence = ScholarlyArticle & {
  evidenceScore: number;
  evidenceBand: "strong" | "useful" | "caution";
  scoreReasons: string[];
};

export type AgentTraceStep = {
  agent: string;
  action: string;
  status: "completed" | "skipped";
  detail: string;
  durationMs: number;
};

export type GroundingAudit = {
  validSourceIds: string[];
  citedSourceIds: string[];
  unknownSourceIds: string[];
  citationCoveragePercent: number;
  warnings: string[];
};

export const RESEARCH_AGENTS: ResearchAgentDefinition[] = [
  {
    id: "planner",
    name: "Mission Planner",
    role: "Turns a broad research goal into an ordered, reviewable workflow.",
    capability: "Goal decomposition, dependency ordering, stage-aware routing and handoffs.",
    reviewGate: "The researcher can change the mission scope before evidence retrieval.",
  },
  {
    id: "scout",
    name: "Literature Scout",
    role: "Finds registry-backed scholarly literature instead of relying on generic web snippets.",
    capability: "Crossref discovery with OpenAlex verification and DOI-normalized deduplication.",
    reviewGate: "Sources remain inspectable and link back to their DOI records.",
  },
  {
    id: "auditor",
    name: "Evidence Auditor",
    role: "Scores source quality signals and flags weak or unsafe evidence.",
    capability: "Retraction checks, citation signals, recency, abstract availability and dual-registry verification.",
    reviewGate: "Retracted records are never promoted as usable evidence.",
  },
  {
    id: "synthesizer",
    name: "Synthesis Agent",
    role: "Builds an evidence-grounded briefing from the retrieved source set.",
    capability: "Source-ID constrained synthesis, gap detection, disagreement mapping and next-question generation.",
    reviewGate: "The agent is instructed to cite only supplied source IDs and never fabricate bibliographic facts.",
  },
  {
    id: "critic",
    name: "Grounding Critic",
    role: "Challenges the synthesis before the user relies on it.",
    capability: "Citation-token validation, unsupported-source detection and optional second-pass AI critique.",
    reviewGate: "Warnings are surfaced instead of silently rewriting uncertain claims.",
  },
  {
    id: "methods",
    name: "Methods & Statistics Agent",
    role: "Routes empirical work into study design and analysis workflows.",
    capability: "Method prompts, Chapter Four handoff, assumption-aware analysis and interpretation.",
    reviewGate: "Statistical conclusions still require researcher review and appropriate data.",
  },
  {
    id: "integrity",
    name: "Integrity Agent",
    role: "Checks citation, overlap and manuscript-integrity risks before submission.",
    capability: "Similarity screening, citation audit and evidence-preserving humanization.",
    reviewGate: "No automated misconduct verdicts; evidence is presented for human judgment.",
  },
  {
    id: "publisher",
    name: "Publication Strategist",
    role: "Moves a mature manuscript toward a verifiable journal pathway.",
    capability: "Readiness checks, journal matching and submission preparation.",
    reviewGate: "No acceptance guarantees or unverified indexing/APC claims.",
  },
];

function normalizeText(value: unknown, max = 4_000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeMissionInput(input: Partial<ResearchMissionInput>): ResearchMissionInput {
  const currentYear = new Date().getUTCFullYear();
  const fromYear = Math.max(1900, Math.min(currentYear, Number(input.fromYear) || currentYear - 5));
  const toYear = Math.max(fromYear, Math.min(currentYear, Number(input.toYear) || currentYear));
  const missionType: ResearchMissionType = ["literature-review", "thesis", "publication", "grant", "general"].includes(String(input.missionType))
    ? input.missionType as ResearchMissionType
    : "general";
  const depth: ResearchDepth = input.depth === "rapid" ? "rapid" : "deep";

  return {
    topic: normalizeText(input.topic, 500),
    researchQuestion: normalizeText(input.researchQuestion, 1_500),
    objectives: normalizeText(input.objectives, 3_000),
    field: normalizeText(input.field, 300),
    keywords: normalizeText(input.keywords, 600),
    missionType,
    depth,
    fromYear,
    toYear,
    maxSources: Math.max(6, Math.min(20, Number(input.maxSources) || 12)),
  };
}

export function buildMissionPlan(input: ResearchMissionInput): ResearchMissionStep[] {
  const steps: ResearchMissionStep[] = [
    {
      order: 1,
      agentId: "planner",
      title: "Frame the research mission",
      goal: "Clarify the core question, scope, evidence window and intended output.",
      output: "A bounded mission that can be audited instead of an open-ended prompt.",
      route: "/research-agent",
    },
    {
      order: 2,
      agentId: "scout",
      title: "Retrieve scholarly evidence",
      goal: `Search DOI-registered literature from ${input.fromYear}–${input.toYear} and verify records across scholarly registries.`,
      output: "A deduplicated evidence set with DOI links and source metadata.",
      route: "/chapter-two",
    },
    {
      order: 3,
      agentId: "auditor",
      title: "Rank and challenge the evidence",
      goal: "Prioritize verifiable, non-retracted, information-rich sources while surfacing caution signals.",
      output: "Evidence scores, reasons and warnings.",
      route: "/plagiarism-checker",
    },
    {
      order: 4,
      agentId: "synthesizer",
      title: "Synthesize findings and gaps",
      goal: "Answer the research question using only the retrieved source set and identify disagreements, gaps and next searches.",
      output: "A source-grounded briefing with traceable [S#] citations.",
      route: "/chapter-two",
    },
    {
      order: 5,
      agentId: "critic",
      title: "Run a grounding critique",
      goal: "Check whether the synthesis cites only known evidence IDs and identify claims needing manual verification.",
      output: "Grounding coverage, unknown-citation warnings and a critique.",
      route: "/trust",
    },
  ];

  if (input.missionType === "thesis") {
    steps.push({
      order: steps.length + 1,
      agentId: "methods",
      title: "Route into thesis execution",
      goal: "Carry the evidence into literature review, methodology decisions and data-analysis preparation.",
      output: "A handoff into Chapter Two and Chapter Four workspaces.",
      route: "/chapter-four",
    });
  }

  if (input.missionType === "publication") {
    steps.push({
      order: steps.length + 1,
      agentId: "publisher",
      title: "Build the publication pathway",
      goal: "Use the reviewed evidence and manuscript profile to assess readiness and journal fit.",
      output: "A verifiable submission pathway.",
      route: "/publishing-agent",
    });
  }

  if (input.missionType === "grant") {
    steps.push({
      order: steps.length + 1,
      agentId: "planner",
      title: "Convert evidence into a fundable problem frame",
      goal: "Extract the evidence gap, beneficiary, intervention logic and measurable outcomes for grant development.",
      output: "A grant-ready evidence narrative for lecturer/human review.",
      route: "/admin/lecturer-agent",
    });
  }

  steps.push({
    order: steps.length + 1,
    agentId: "integrity",
    title: "Protect the final research artifact",
    goal: "Run citation, similarity and formatting checks before any submission or external action.",
    output: "A human-reviewable integrity and readiness checkpoint.",
    route: "/plagiarism-checker",
  });

  return steps;
}

function requestHeaders() {
  const email = process.env.CROSSREF_MAILTO?.trim();
  return {
    Accept: "application/json",
    "User-Agent": `Mabrig-Researcher-Pro-Agent/1.0${email ? ` (mailto:${email})` : ""}`,
  };
}

function buildSearchQuery(input: ResearchMissionInput) {
  return [
    input.topic,
    input.researchQuestion,
    input.keywords,
    input.field,
    input.objectives?.slice(0, 800),
  ].filter(Boolean).join(" ").slice(0, 1_800);
}

async function enrichFromOpenAlex(article: ScholarlyArticle): Promise<ScholarlyArticle> {
  try {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("filter", `doi:https://doi.org/${article.doi}`);
    url.searchParams.set("per-page", "1");
    url.searchParams.set("select", "id,doi,title,is_retracted,cited_by_count,open_access,abstract_inverted_index");
    if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return article;
    const result = (await response.json())?.results?.[0];
    if (!result?.id) return article;
    return {
      ...article,
      abstract: article.abstract || reconstructOpenAlexAbstract(result.abstract_inverted_index),
      citationCount: Math.max(article.citationCount, Number(result.cited_by_count) || 0),
      openAccess: typeof result.open_access?.is_oa === "boolean" ? result.open_access.is_oa : article.openAccess,
      openAlexId: String(result.id),
      retracted: Boolean(result.is_retracted),
      verification: "crossref-openalex",
    };
  } catch {
    return article;
  }
}

export async function retrieveMissionEvidence(input: ResearchMissionInput): Promise<ScholarlyArticle[]> {
  const query = buildSearchQuery(input);
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", query);
  url.searchParams.set("filter", `from-pub-date:${input.fromYear}-01-01,until-pub-date:${input.toYear}-12-31,type:journal-article`);
  url.searchParams.set("select", "DOI,title,author,published,published-print,published-online,issued,created,container-title,publisher,URL,abstract,volume,issue,page,article-number,is-referenced-by-count");
  url.searchParams.set("rows", String(Math.min(50, input.maxSources * 3)));
  url.searchParams.set("sort", "relevance");
  const mailto = process.env.CROSSREF_MAILTO?.trim();
  if (mailto) url.searchParams.set("mailto", mailto);

  const response = await fetch(url, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Crossref retrieval failed (${response.status}).`);

  const items = (await response.json())?.message?.items;
  const registered = Array.isArray(items)
    ? items.map(crossrefItemToArticle).filter((article): article is ScholarlyArticle => Boolean(article))
    : [];
  const unique = deduplicateArticlesByTitle(registered, input.maxSources);
  return Promise.all(unique.map(enrichFromOpenAlex));
}

export function scoreEvidence(article: ScholarlyArticle, currentYear = new Date().getUTCFullYear()): ScoredEvidence {
  if (article.retracted) {
    return {
      ...article,
      evidenceScore: 0,
      evidenceBand: "caution",
      scoreReasons: ["Retraction signal detected; do not use as supporting evidence."],
    };
  }

  let score = 30;
  const reasons: string[] = ["DOI metadata verified in Crossref."];

  if (article.verification === "crossref-openalex") {
    score += 20;
    reasons.push("Independently indexed by OpenAlex.");
  }

  if (article.abstract.length >= 250) {
    score += 15;
    reasons.push("Abstract is available for relevance checking.");
  } else {
    reasons.push("Abstract is missing or limited; full-text review is important.");
  }

  const age = Math.max(0, currentYear - article.year);
  if (age <= 2) {
    score += 15;
    reasons.push("Recent publication.");
  } else if (age <= 5) {
    score += 10;
    reasons.push("Published within the last five years.");
  } else if (age > 10) {
    reasons.push("Older source; verify whether it remains current for this claim.");
  }

  const citationBoost = Math.min(20, Math.round(Math.log10(Math.max(1, article.citationCount) + 1) * 9));
  if (citationBoost > 0) {
    score += citationBoost;
    reasons.push(`Citation signal: ${article.citationCount} recorded citations.`);
  }

  score = Math.max(0, Math.min(100, score));
  const evidenceBand: ScoredEvidence["evidenceBand"] = score >= 75 ? "strong" : score >= 55 ? "useful" : "caution";
  return { ...article, evidenceScore: score, evidenceBand, scoreReasons: reasons };
}

export function rankEvidence(articles: ScholarlyArticle[]) {
  return articles
    .map((article) => scoreEvidence(article))
    .sort((left, right) => right.evidenceScore - left.evidenceScore || right.citationCount - left.citationCount);
}

function sourcePacket(evidence: ScoredEvidence[]) {
  return evidence.map((article, index) => ({
    id: `S${index + 1}`,
    title: article.title,
    year: article.year,
    journal: article.journal,
    doi: article.doi,
    citationCount: article.citationCount,
    evidenceScore: article.evidenceScore,
    verification: article.verification,
    abstract: article.abstract || "Abstract unavailable — do not infer findings from the title alone.",
  }));
}

function fallbackSynthesis(input: ResearchMissionInput, evidence: ScoredEvidence[]) {
  if (!evidence.length) {
    return "No registry-backed journal articles were retrieved for this mission. Broaden the keywords, year range or research question before drawing conclusions.";
  }
  const top = evidence.slice(0, 5);
  return [
    `Mission: ${input.topic}`,
    `Evidence retrieved: ${evidence.length} DOI-registered journal articles.`,
    "",
    "Highest-priority sources for manual review:",
    ...top.map((article, index) => `[S${index + 1}] ${article.title} (${article.year}) — evidence score ${article.evidenceScore}/100; DOI https://doi.org/${article.doi}`),
    "",
    "AI synthesis is unavailable because no supported model provider is configured. The evidence set and scoring remain usable; inspect the linked papers before making substantive claims.",
  ].join("\n");
}

async function synthesizeMission(input: ResearchMissionInput, evidence: ScoredEvidence[]) {
  const packet = sourcePacket(evidence);
  if (!packet.length) return { text: fallbackSynthesis(input, evidence), provider: null, model: null };

  const prompt = `You are the Synthesis Agent inside Mabrig Researcher Pro. Produce a rigorous academic evidence briefing using ONLY the supplied source packet.

RESEARCH MISSION
Type: ${input.missionType}
Topic: ${input.topic}
Research question: ${input.researchQuestion || "Not specified"}
Objectives: ${input.objectives || "Not specified"}
Field: ${input.field || "Not specified"}

SOURCE PACKET
${JSON.stringify(packet, null, 2)}

STRICT RULES
1. Every substantive finding or source-specific statement must end with one or more source IDs such as [S1] or [S2][S4].
2. Never cite or invent a source outside this packet.
3. If an abstract is unavailable, do not infer study findings from the title.
4. Distinguish what the supplied metadata/abstracts support from what requires full-text verification.
5. Do not invent sample sizes, methods, countries, effect sizes, journal rankings or conclusions.
6. Treat evidence scores as retrieval-quality signals, not proof that a claim is true.
7. Highlight disagreements and evidence gaps rather than forcing consensus.

Return these sections:
- Executive evidence answer
- What the evidence supports
- Contradictions or uncertainty
- Research gaps
- Best sources to read first
- Next research actions
- Full-text verification warnings`;

  const result = await generateWithAiFallback(prompt);
  return result
    ? { text: result.text, provider: result.provider, model: result.model }
    : { text: fallbackSynthesis(input, evidence), provider: null, model: null };
}

export function auditGrounding(text: string, sourceCount: number): GroundingAudit {
  const validSourceIds = Array.from({ length: sourceCount }, (_, index) => `S${index + 1}`);
  const tokenMatches = [...text.matchAll(/\[S(\d+)\]/gi)].map((match) => `S${Number(match[1])}`);
  const citedSourceIds = [...new Set(tokenMatches.filter((id) => validSourceIds.includes(id)))];
  const unknownSourceIds = [...new Set(tokenMatches.filter((id) => !validSourceIds.includes(id)))];
  const paragraphCandidates = text
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 90 && !/^[-#]/.test(value));
  const citedParagraphs = paragraphCandidates.filter((paragraph) => /\[S\d+\]/i.test(paragraph)).length;
  const citationCoveragePercent = paragraphCandidates.length
    ? Math.round((citedParagraphs / paragraphCandidates.length) * 100)
    : (citedSourceIds.length ? 100 : 0);
  const warnings: string[] = [];

  if (unknownSourceIds.length) warnings.push(`Unknown source IDs detected: ${unknownSourceIds.join(", ")}.`);
  if (citationCoveragePercent < 60) warnings.push("Citation coverage is low; manually verify uncited substantive paragraphs.");
  if (!citedSourceIds.length && sourceCount > 0) warnings.push("No [S#] source citations were detected in the synthesis.");
  if (!warnings.length) warnings.push("No structural citation-token problems detected. Full-text claim verification is still required.");

  return { validSourceIds, citedSourceIds, unknownSourceIds, citationCoveragePercent, warnings };
}

async function critiqueMission(input: ResearchMissionInput, synthesis: string, evidence: ScoredEvidence[]) {
  if (input.depth !== "deep" || !evidence.length) return null;
  const prompt = `You are the Grounding Critic in an academic research system. Audit the draft below against the supplied source packet. Do not rewrite the draft.

DRAFT
${synthesis}

SOURCE PACKET
${JSON.stringify(sourcePacket(evidence), null, 2)}

Return:
1. Unsupported or overconfident claims
2. Claims that require full-text verification
3. Missing counter-evidence or uncertainty
4. Citation/source-ID issues
5. A concise verdict: PASS WITH REVIEW, REVISE, or INSUFFICIENT EVIDENCE

Do not introduce new sources or facts.`;
  return generateWithAiFallback(prompt);
}

export async function runResearchMission(inputValue: Partial<ResearchMissionInput>) {
  const input = normalizeMissionInput(inputValue);
  if (input.topic.length < 8) throw new Error("Provide a research topic of at least eight characters.");

  const trace: AgentTraceStep[] = [];
  const planStart = Date.now();
  const plan = buildMissionPlan(input);
  trace.push({
    agent: "Mission Planner",
    action: "Decomposed the research goal into an ordered workflow.",
    status: "completed",
    detail: `${plan.length} reviewable steps generated for a ${input.missionType} mission.`,
    durationMs: Date.now() - planStart,
  });

  const retrievalStart = Date.now();
  const retrieved = await retrieveMissionEvidence(input);
  trace.push({
    agent: "Literature Scout",
    action: "Queried Crossref and checked records against OpenAlex.",
    status: "completed",
    detail: `${retrieved.length} deduplicated DOI-registered journal articles retrieved.`,
    durationMs: Date.now() - retrievalStart,
  });

  const auditStart = Date.now();
  const evidence = rankEvidence(retrieved);
  const retractions = evidence.filter((item) => item.retracted).length;
  trace.push({
    agent: "Evidence Auditor",
    action: "Ranked evidence and checked safety signals.",
    status: "completed",
    detail: `${evidence.filter((item) => item.evidenceBand === "strong").length} strong, ${evidence.filter((item) => item.evidenceBand === "useful").length} useful, ${evidence.filter((item) => item.evidenceBand === "caution").length} caution; ${retractions} retraction signal(s).`,
    durationMs: Date.now() - auditStart,
  });

  const synthesisStart = Date.now();
  const synthesis = await synthesizeMission(input, evidence);
  trace.push({
    agent: "Synthesis Agent",
    action: "Built a source-constrained evidence briefing.",
    status: "completed",
    detail: synthesis.provider ? `AI synthesis generated with ${synthesis.provider}/${synthesis.model}.` : "Deterministic fallback used because no supported AI provider responded.",
    durationMs: Date.now() - synthesisStart,
  });

  const groundingStart = Date.now();
  const groundingAudit = auditGrounding(synthesis.text, evidence.length);
  const criticResult = await critiqueMission(input, synthesis.text, evidence);
  trace.push({
    agent: "Grounding Critic",
    action: "Audited citation tokens and challenged unsupported claims.",
    status: "completed",
    detail: criticResult
      ? `Deep critique generated with ${criticResult.provider}/${criticResult.model}; citation coverage ${groundingAudit.citationCoveragePercent}%.`
      : `Structural grounding audit completed; citation coverage ${groundingAudit.citationCoveragePercent}%.`,
    durationMs: Date.now() - groundingStart,
  });

  return {
    missionId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    input,
    agents: RESEARCH_AGENTS,
    plan,
    evidence,
    synthesis: synthesis.text,
    groundingAudit,
    critic: criticResult?.text ?? null,
    ai: {
      enabled: Boolean(synthesis.provider),
      provider: synthesis.provider,
      model: synthesis.model,
      deepCriticEnabled: Boolean(criticResult),
    },
    trace,
    handoffs: [
      { label: "Continue literature review", route: "/chapter-two" },
      { label: "Analyze research data", route: "/chapter-four" },
      { label: "Run integrity check", route: "/plagiarism-checker" },
      { label: "Build publication pathway", route: "/publishing-agent" },
      { label: "Format final document", route: "/formatter" },
    ],
  };
}
