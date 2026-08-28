import type { NounGeneratedThesis, NounThesisInput, NounWriterMode } from "./noun-thesis";
import { NounThesisError } from "./noun-thesis";

const AI_TIMEOUT_MS = 90_000;

export type ExpertMethodologyType = "quantitative" | "qualitative" | "mixed" | "secondary" | "unspecified";
export type ExpertCitationDensity = "standard" | "intensive";

export type NounExpertSettings = {
  enabled: boolean;
  sectionFocus: string;
  existingWork: string;
  supervisorCorrections: string;
  methodologyType: ExpertMethodologyType;
  citationDensity: ExpertCitationDensity;
  paragraphTarget: "balanced" | "13-15-lines";
  empiricalStudyTarget: number;
  theoryCount: number;
  minimumReferences: number;
  referenceYearStart: number;
  referenceYearEnd: number;
  requireDoiOrUrl: boolean;
  includeQualityAudit: boolean;
  includeDefensePack: boolean;
};

export type NounExpertGeneratedThesis = NounGeneratedThesis & {
  qualityAudit?: string;
  defensePack?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function selectedChapters(mode: NounWriterMode) {
  if (mode === "proposal") return [1, 2, 3];
  const match = mode.match(/^chapter([1-5])$/);
  if (match) return [Number(match[1])];
  return [1, 2, 3, 4, 5];
}

function chapterTitle(chapter: number) {
  if (chapter === 1) return "INTRODUCTION";
  if (chapter === 2) return "REVIEW OF RELATED LITERATURE";
  if (chapter === 3) return "RESEARCH METHODOLOGY";
  if (chapter === 4) return "DATA PRESENTATION, ANALYSIS AND DISCUSSION OF FINDINGS";
  return "SUMMARY, CONCLUSION AND RECOMMENDATIONS";
}

function chapterStructure(chapter: number, postgraduate: boolean) {
  if (chapter === 1) {
    return [
      "1.1 Introduction",
      "1.2 Background to the Study",
      "1.3 Statement of the Problem",
      "1.4 Objectives of the Study (general objective and specific measurable objectives)",
      "1.5 Research Questions",
      "1.6 Research Hypotheses where applicable",
      "1.7 Significance of the Study",
      "1.8 Justification of the Study",
      "1.9 Scope of the Study",
      "1.10 Definition of Key Terms",
    ];
  }
  if (chapter === 2) {
    return [
      "2.0 Introduction",
      "2.1 Conceptual Framework organised into clear thematic subheadings",
      "2.2 Theoretical Framework",
      "2.3 Empirical Review",
      "2.4 Summary/Appraisal of Reviewed Literature and Research Gap",
    ];
  }
  if (chapter === 3) {
    return [
      "3.0 Introduction",
      "3.1 Area of the Study",
      "3.2 Research Design and Sources of Data",
      "3.3 Population, Sample Size and Sampling Technique",
      "3.4 Instrumentation, Validity and Reliability where applicable",
      "3.5 Method of Data Analysis",
      "3.6 Limitations of the Study",
    ];
  }
  if (chapter === 4) {
    return [
      "4.1 Introduction",
      "4.2 Data Presentation and Response Rate where applicable",
      "4.3 Demographic Data Presentation and Analysis where applicable",
      "4.4 Data Analysis and Answers to Research Questions",
      "4.5 Qualitative/Thematic Analysis where applicable",
      "4.6 Test of Hypotheses where applicable",
      "4.7 Discussion of Findings",
      "4.8 Summary of Major Findings",
    ];
  }
  return [
    "5.1 Summary of Findings",
    "5.2 Conclusion",
    "5.3 Recommendations",
    postgraduate ? "5.4 Contribution to Knowledge" : "",
    postgraduate ? "5.5 Suggestions for Further Studies" : "5.4 Suggestions for Further Studies",
  ].filter(Boolean);
}

function chapterPageTarget(input: NounThesisInput, chapter: number) {
  const chapters = selectedChapters(input.mode);
  if (chapters.length === 1) return Math.max(4, Math.min(40, input.targetPages));
  const weights: Record<number, number> = input.mode === "proposal"
    ? { 1: 15 / 62, 2: 40 / 62, 3: 7 / 62 }
    : { 1: 15 / 102, 2: 40 / 102, 3: 7 / 102, 4: 30 / 102, 5: 10 / 102 };
  return Math.max(3, Math.round(input.targetPages * (weights[chapter] || (1 / chapters.length))));
}

function endpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:markdown|text)?\s*([\s\S]*?)\s*```$/i);
  return (match?.[1] || trimmed).trim();
}

function researchContext(input: NounThesisInput, settings: NounExpertSettings) {
  return [
    "Institution: National Open University of Nigeria (NOUN)",
    `Degree level: ${input.degreeLevel}`,
    `Faculty: ${input.faculty}`,
    `Department: ${input.department}`,
    `Programme: ${input.programme}`,
    `Research title: ${input.title}`,
    `Research approach: ${settings.methodologyType}`,
    settings.sectionFocus ? `Section focus requested by admin: ${settings.sectionFocus}` : "",
    input.backgroundBrief ? `Background/research brief supplied by admin:\n${input.backgroundBrief}` : "",
    input.problemStatement ? `Approved problem statement / research gap:\n${input.problemStatement}` : "",
    input.objectives ? `Approved objectives:\n${input.objectives}` : "",
    input.researchQuestions ? `Approved research questions/hypotheses:\n${input.researchQuestions}` : "",
    input.methodology ? `Approved methodology details:\n${input.methodology}` : "",
    input.findingsData ? `VERIFIED findings/data supplied by admin:\n${input.findingsData}` : "No verified findings/data were supplied.",
    input.verifiedSources ? `VERIFIED source/reference pack supplied by admin:\n${input.verifiedSources}` : "No verified source/reference pack was supplied.",
    settings.existingWork ? `Existing student/supervisor draft to continue, improve or correct:\n${settings.existingWork}` : "",
    settings.supervisorCorrections ? `Supervisor corrections that MUST be implemented:\n${settings.supervisorCorrections}` : "",
    input.facultyInstructions ? `Faculty/supervisor formatting or content instructions:\n${input.facultyInstructions}` : "",
  ].filter(Boolean).join("\n\n");
}

async function callAi(options: {
  input: NounThesisInput;
  settings: NounExpertSettings;
  label: string;
  instructions: string;
  targetPages: number;
  apiKey: string;
  baseUrl: string;
  model: string;
  contextOverride?: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const targetWords = Math.max(700, Math.min(9_000, Math.round(options.targetPages * 350)));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org";
    headers["X-Title"] = "Mabrig Researcher Pro - NOUN Expert Thesis Writer";
  }

  const paragraphInstruction = options.settings.paragraphTarget === "13-15-lines"
    ? "Aim for substantial paragraphs of roughly 180–250 words, approximating 13–15 lines in a typical Times New Roman 12pt double-spaced Word layout. Do not pad merely to hit a visual line count."
    : "Use well-developed academic paragraphs with natural variation in length.";

  const citationInstruction = options.settings.citationDensity === "intensive"
    ? "For literature-heavy analytical paragraphs, aim for 3–5 APA-style in-text citations ONLY when those citations can be traced to the verified source pack. If the source pack cannot support that density, use [Add verified citation] rather than inventing a source."
    : "Cite claims where needed using only the verified source pack. Use [Add verified citation] where evidence is required but unavailable.";

  try {
    const response = await fetch(endpoint(options.baseUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        temperature: 0.15,
        max_tokens: Math.min(12_000, Math.max(2_000, Math.ceil(targetWords * 1.7))),
        messages: [
          {
            role: "system",
            content: [
              "You are the Expert NOUN Thesis Writer inside a protected academic administration system.",
              "Write formal, precise, original scholarly prose with varied sentence structure and natural academic flow. Do not make claims about bypassing AI detection.",
              "Never fabricate sources, DOI links, quotations, statistics, respondents, sample sizes, fieldwork, significance tests, ethics approvals, interview statements, results, findings, dates or institutional facts.",
              "Use only references and data explicitly supplied in the verified source/data fields. Preserve supplied facts, citations and reference details accurately.",
              "If evidence is missing, insert [Add verified citation]. If data/results are missing, insert [Insert verified result/data].",
              "Do not cite Wikipedia, blogs or invented journal articles. Government statistics must come from official sources supplied by the administrator.",
              "Use APA 7 author-year citations. Every citation you create must correspond to an identifiable supplied reference; do not create an author/year pair absent from the source pack.",
              "For data chapters, do not calculate or infer a new statistic unless the exact calculation/output is explicitly supplied. Present and interpret supplied values only.",
              "Use Markdown headings (#, ##, ###) for structure. Use standard Markdown tables with pipe separators when tabular data are supplied. Do not use code fences. Main prose should not contain decorative bold or italics.",
              paragraphInstruction,
              citationInstruction,
              options.settings.supervisorCorrections ? "Treat supervisor corrections as mandatory while preserving verified evidence." : "",
            ].filter(Boolean).join(" "),
          },
          {
            role: "user",
            content: [
              options.contextOverride || researchContext(options.input, options.settings),
              `Requested output: ${options.label}`,
              `Approximate target length: ${targetWords} words (${options.targetPages} pages at roughly 350 words/page).`,
              options.instructions,
            ].join("\n\n"),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null) as ChatCompletionResponse | null;
    if (!response.ok) {
      throw new NounThesisError(payload?.error?.message || `AI provider failed while generating ${options.label}.`, 502);
    }
    const text = stripCodeFence(payload?.choices?.[0]?.message?.content || "");
    if (!text) throw new NounThesisError(`The AI writer returned an empty ${options.label}.`, 502);
    return text;
  } catch (error) {
    if (error instanceof NounThesisError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new NounThesisError(`${options.label} generation timed out. Generate one chapter or section at a time.`, 504);
    }
    console.error("Expert NOUN thesis generation failed", error);
    throw new NounThesisError(`Unable to generate ${options.label} right now.`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function chapterExpertInstructions(input: NounThesisInput, settings: NounExpertSettings, chapter: number) {
  const postgraduate = input.degreeLevel === "masters" || input.degreeLevel === "phd";
  const base = [
    `Write # CHAPTER ${["ONE", "TWO", "THREE", "FOUR", "FIVE"][chapter - 1]} followed by # ${chapterTitle(chapter)}.`,
    "Use the following structural headings in logical order unless Faculty/Supervisor Instructions explicitly require a different approved structure:",
    ...chapterStructure(chapter, postgraduate).map(item => `- ${item}`),
  ];

  if (settings.sectionFocus) {
    base.push(`The administrator specifically requested section focus: ${settings.sectionFocus}. Give that section priority and do not waste space repeating unrelated sections.`);
  }

  if (chapter === 1) {
    base.push(
      "Ensure specific objectives are measurable and align one-to-one with research questions. Preserve approved objectives/hypotheses when supplied.",
      "Definition of Key Terms should be operational and concise; it does not require forced citations.",
    );
  }

  if (chapter === 2) {
    base.push(
      "For 2.1 Conceptual Framework, use approximately eight meaningful thematic subheadings when the topic supports them. Do NOT use the phrase 'Concept of' in any heading.",
      `For 2.2 Theoretical Framework, use exactly ${settings.theoryCount} theories. For each theory: introduce it, state key tenets, explain criticisms/limitations where supported, and apply it directly to the study. Cite original proponents only when their source details are present in the verified source pack; otherwise insert [Add verified original-proponent citation].`,
      `For 2.3 Empirical Review, target up to ${settings.empiricalStudyTarget} verified studies. Review only studies identifiable in the source pack. If fewer are supplied, do not invent additional studies.`,
      "Conclude Chapter Two with a clear synthesis of conceptual, theoretical and empirical gaps that justify the study.",
    );
  }

  if (chapter === 3) {
    base.push(
      `Methodology type selected by admin: ${settings.methodologyType}. Use only design, population, sample, instrument, validity, reliability, collection and analysis details supplied or safely framed as proposed methodology.`,
      "Where sample values, formulas, reliability coefficients or software outputs are missing, insert explicit placeholders instead of inventing values.",
    );
  }

  if (chapter === 4) {
    base.push(
      "Use ONLY verified findings/data supplied by the administrator. Never invent respondents, percentages, means, standard deviations, regression coefficients, p-values, interview quotations, themes or tables.",
      "Present data first, then interpret each table/result, then answer each approved research question, then test supplied hypotheses where supported, then discuss each major finding against verified literature and theory.",
      input.findingsData
        ? "Use the supplied verified values exactly. When tabular values are supplied, render them as Markdown tables with a table number/title, followed by a clear prose interpretation."
        : "No verified findings/data were supplied. Create only a complete Chapter Four framework with [Insert verified result/data] placeholders.",
    );
  }

  if (chapter === 5) {
    base.push(
      "Tie summary, conclusions and recommendations directly to approved objectives and verified findings.",
      "Do not introduce new findings in Chapter Five.",
      input.findingsData
        ? "State contributions and recommendations only to the extent supported by verified results."
        : "Because verified findings are missing, produce a Chapter Five framework with [Insert verified finding] placeholders.",
    );
  }

  return base.join("\n");
}

function chapterFourContext(input: NounThesisInput, settings: NounExpertSettings, includeLiterature: boolean) {
  return [
    "Institution: National Open University of Nigeria (NOUN)",
    `Research title: ${input.title}`,
    `Research approach: ${settings.methodologyType}`,
    input.objectives ? `Approved objectives:\n${input.objectives}` : "",
    input.researchQuestions ? `Approved research questions/hypotheses:\n${input.researchQuestions}` : "",
    input.methodology ? `Approved methodology/analysis method:\n${input.methodology}` : "",
    input.findingsData ? `VERIFIED DATA/RESULTS — reproduce values exactly:\n${input.findingsData}` : "No verified findings/data supplied.",
    includeLiterature && input.verifiedSources ? `VERIFIED literature/reference pack for discussion:\n${input.verifiedSources}` : "",
    settings.existingWork ? `Existing Chapter Four draft to improve:\n${settings.existingWork}` : "",
    settings.supervisorCorrections ? `Mandatory supervisor corrections:\n${settings.supervisorCorrections}` : "",
    input.facultyInstructions ? `Faculty/supervisor instructions:\n${input.facultyInstructions}` : "",
  ].filter(Boolean).join("\n\n");
}

function stripChapterFourWrapper(text: string) {
  return text
    .replace(/^#\s*CHAPTER\s+FOUR\s*$/gim, "")
    .replace(/^#\s*DATA PRESENTATION[^\n]*$/gim, "")
    .trim();
}

function numericTokens(value: string) {
  return new Set(
    (value.match(/\b\d+(?:,\d{3})*(?:\.\d+)?%?\b/g) || [])
      .map(token => token.replace(/,/g, ""))
      .filter(token => !/^(?:[1-8]|4\.[1-8])$/.test(token)),
  );
}

function assertChapterFourNumericIntegrity(input: NounThesisInput, output: string) {
  if (!input.findingsData.trim()) return;
  const allowed = numericTokens([
    input.findingsData,
    input.methodology,
    input.researchQuestions,
    input.verifiedSources,
  ].join("\n"));
  const produced = numericTokens(output);
  const unexpected = [...produced].filter(token => !allowed.has(token));
  if (unexpected.length) {
    throw new NounThesisError(
      `Chapter Four safety check stopped the draft because new numeric value(s) appeared that were not in the supplied data/source pack: ${unexpected.slice(0, 8).join(", ")}. Verify the data and regenerate.`,
      422,
    );
  }
}

async function generateExpertChapterFour(options: {
  input: NounThesisInput;
  settings: NounExpertSettings;
  targetPages: number;
  apiKey: string;
  baseUrl: string;
  model: string;
}) {
  if (!options.input.findingsData.trim()) {
    return callAi({
      ...options,
      label: "Chapter 4: Data Presentation, Analysis and Discussion of Findings",
      instructions: chapterExpertInstructions(options.input, options.settings, 4),
    });
  }

  const total = Math.max(12, Math.min(40, options.targetPages));
  const presentationPages = Math.max(3, Math.round(total * 0.25));
  const analysisPages = Math.max(4, Math.round(total * 0.30));
  const hypothesisPages = Math.max(2, Math.round(total * 0.15));
  const discussionPages = Math.max(4, total - presentationPages - analysisPages - hypothesisPages);

  const dataContext = chapterFourContext(options.input, options.settings, false);
  const discussionContext = chapterFourContext(options.input, options.settings, true);

  const [presentation, analysis, hypotheses, discussion] = await Promise.all([
    callAi({
      ...options,
      label: "Chapter Four Part A — Data Presentation",
      targetPages: presentationPages,
      contextOverride: dataContext,
      instructions: [
        "Write ONLY sections ## 4.1 Introduction, ## 4.2 Data Presentation and Response Rate (where applicable), and ## 4.3 Demographic Data Presentation and Analysis (where applicable).",
        "Reproduce supplied values exactly. Use Markdown tables for supplied tabular data. Give every table a clear number/title, then interpret what the table shows without adding new values.",
        "If response-rate or demographic values were not supplied, omit that subsection or insert [Insert verified result/data]; never invent it.",
      ].join("\n"),
    }),
    callAi({
      ...options,
      label: "Chapter Four Part B — Research Question Data Analysis",
      targetPages: analysisPages,
      contextOverride: dataContext,
      instructions: [
        "Write ONLY ## 4.4 Data Analysis and Answers to Research Questions and, where applicable, ## 4.5 Qualitative/Thematic Analysis.",
        "Organise analysis one research question/objective at a time. For each: present the relevant supplied table/output, interpret it, and state the evidence-grounded answer.",
        "For qualitative data, use only themes and quotations actually supplied. Do not create participant quotations or frequencies.",
      ].join("\n"),
    }),
    callAi({
      ...options,
      label: "Chapter Four Part C — Hypothesis Testing",
      targetPages: hypothesisPages,
      contextOverride: dataContext,
      instructions: [
        "Write ONLY ## 4.6 Test of Hypotheses.",
        "Test and interpret only hypotheses for which verified statistical output is supplied. Reproduce test statistic, coefficient, p-value, significance level and decision exactly as supplied.",
        "Do not calculate a missing statistic. If a required output is absent, insert [Insert verified result/data].",
      ].join("\n"),
    }),
    callAi({
      ...options,
      label: "Chapter Four Part D — Discussion of Findings",
      targetPages: discussionPages,
      contextOverride: discussionContext,
      instructions: [
        "Write ONLY ## 4.7 Discussion of Findings and ## 4.8 Summary of Major Findings.",
        "Discuss findings objective by objective. Start with the verified study finding, explain its meaning, then compare it with prior studies and theory ONLY when those sources are present in the verified literature pack.",
        "State agreements, differences and plausible evidence-grounded implications without inventing explanations. Use [Add verified citation] where comparison evidence is missing.",
        "End with a concise numbered or prose summary of the major verified findings; do not introduce new results.",
      ].join("\n"),
    }),
  ]);

  const combined = [
    "# CHAPTER FOUR",
    `# ${chapterTitle(4)}`,
    stripChapterFourWrapper(presentation),
    stripChapterFourWrapper(analysis),
    stripChapterFourWrapper(hypotheses),
    stripChapterFourWrapper(discussion),
  ].filter(Boolean).join("\n\n");

  assertChapterFourNumericIntegrity(options.input, combined);
  return combined;
}

function countMatches(value: string, pattern: RegExp) {
  return (value.match(pattern) || []).length;
}

function buildQualityAudit(input: NounThesisInput, generated: NounGeneratedThesis, settings: NounExpertSettings) {
  const chapterText = generated.chapters.map(item => item.text).join("\n\n");
  const referenceLines = input.verifiedSources.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const linkedReferences = referenceLines.filter(line => /https?:\/\/|doi\s*[:/]|10\.\d{4,9}\//i.test(line));
  const citationInstances = countMatches(chapterText, /\([^()]*\b(?:19|20)\d{2}[a-z]?\b[^()]*\)/g);
  const citationPlaceholders = countMatches(chapterText, /\[Add verified(?: original-proponent)? citation\]/gi);
  const resultPlaceholders = countMatches(chapterText, /\[Insert verified (?:result\/data|finding|major findings)\]/gi);
  const conceptOfHeadings = chapterText.split("\n").filter(line => /^#{1,3}\s+/.test(line) && /concept of/i.test(line));

  const referenceStatus = referenceLines.length >= settings.minimumReferences
    ? "PASS"
    : `REVIEW — ${settings.minimumReferences - referenceLines.length} additional verified reference(s) requested by the configured target`;
  const linkStatus = !settings.requireDoiOrUrl || linkedReferences.length === referenceLines.length
    ? "PASS"
    : `REVIEW — ${referenceLines.length - linkedReferences.length} supplied reference line(s) do not contain a DOI/URL marker`;

  return [
    "# EXPERT THESIS QUALITY AUDIT",
    "",
    `Research title: ${input.title}`,
    `Writer mode: ${input.mode}`,
    `Degree level: ${input.degreeLevel}`,
    "",
    "## Evidence and Reference Checks",
    `- Supplied reference lines: ${referenceLines.length}`,
    `- Configured minimum reference target: ${settings.minimumReferences} — ${referenceStatus}`,
    `- Supplied references containing DOI/URL markers: ${linkedReferences.length}/${referenceLines.length || 0} — ${linkStatus}`,
    `- In-text citation instances detected in generated chapter text: ${citationInstances}`,
    `- [Add verified citation] placeholders: ${citationPlaceholders}`,
    `- Missing-result/finding placeholders: ${resultPlaceholders}`,
    "",
    "## Structure Checks",
    `- Chapter Two 'Concept of' heading violations detected: ${conceptOfHeadings.length}`,
    `- Theoretical-framework target: exactly ${settings.theoryCount} theories; confirm original-proponent sources are present in the verified source pack.`,
    `- Empirical-review target: up to ${settings.empiricalStudyTarget} verified studies; the writer is prohibited from inventing studies to reach the target.`,
    "- Chapter Four staged workflow: data presentation → research-question analysis → hypothesis testing → discussion of findings.",
    "",
    "## Supervisor Review Checklist",
    "- Confirm every in-text citation has a matching verified reference entry and every listed reference is actually cited where relevant.",
    "- Open DOI/official URLs and verify bibliographic details before submission.",
    "- Confirm all tables, figures, sample sizes, coefficients, p-values and interview quotations against original data/output.",
    "- Confirm chapter headings and title wording against the student's Faculty/Department handbook and supervisor instructions.",
    "- Run language, similarity and formatting checks after supervisor corrections; no similarity percentage is guaranteed by this tool.",
  ].join("\n");
}

async function buildDefensePack(options: {
  input: NounThesisInput;
  settings: NounExpertSettings;
  generated: NounGeneratedThesis;
  apiKey: string;
  baseUrl: string;
  model: string;
}) {
  const thesisText = options.generated.chapters.map(item => item.text).join("\n\n").slice(0, 45_000);
  const context = [
    `Research title: ${options.input.title}`,
    `Objectives: ${options.input.objectives}`,
    `Methodology: ${options.input.methodology}`,
    `Verified findings/data: ${options.input.findingsData || "Not supplied"}`,
    `Generated thesis excerpts:\n${thesisText}`,
  ].join("\n\n");

  return callAi({
    input: options.input,
    settings: options.settings,
    label: "NOUN Thesis Defense Preparation Pack",
    targetPages: 5,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    model: options.model,
    contextOverride: context,
    instructions: [
      "Create a concise defense preparation pack for the student.",
      "Include: a 2-minute opening presentation; problem statement; objectives; methodology defense; verified key findings only if supplied; contribution/significance; limitations; recommendations; and 20 likely examiner questions with evidence-grounded answer cues.",
      "Where a question depends on results not supplied, say [Review verified result before defense] rather than inventing an answer.",
      "Also include five difficult methodology questions and five questions about the research gap/theory.",
    ].join("\n"),
  });
}

export async function generateExpertNounThesis(input: NounThesisInput, settings: NounExpertSettings): Promise<NounExpertGeneratedThesis> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !baseUrl || !model) {
    throw new NounThesisError("NOUN Expert Thesis Writer requires AI_API_KEY, AI_BASE_URL and AI_MODEL in Vercel.", 503);
  }

  const chapters = selectedChapters(input.mode);
  const chapterJobs = chapters.map(chapter => {
    const targetPages = chapterPageTarget(input, chapter);
    if (chapter === 4) {
      return generateExpertChapterFour({ input, settings, targetPages, apiKey, baseUrl, model });
    }
    return callAi({
      input,
      settings,
      label: `Chapter ${chapter}: ${chapterTitle(chapter)}`,
      targetPages,
      apiKey,
      baseUrl,
      model,
      instructions: chapterExpertInstructions(input, settings, chapter),
    });
  });

  const abstractJob = input.mode === "full"
    ? callAi({
        input,
        settings,
        label: "Abstract",
        targetPages: 1,
        apiKey,
        baseUrl,
        model,
        instructions: "Write one single-paragraph NOUN abstract of no more than 400 words covering background/problem, purpose/objectives, methodology, verified major findings if supplied, conclusion and key recommendation/implication. Do not include citations. If findings are unavailable, use [Insert verified major findings].",
      })
    : Promise.resolve("");

  const [chapterTexts, abstract] = await Promise.all([Promise.all(chapterJobs), abstractJob]);
  const generated: NounGeneratedThesis = {
    chapters: chapters.map((chapter, index) => ({ chapter, title: chapterTitle(chapter), text: chapterTexts[index] })),
    abstract,
  };

  const result: NounExpertGeneratedThesis = { ...generated };
  if (settings.includeQualityAudit) result.qualityAudit = buildQualityAudit(input, generated, settings);
  if (settings.includeDefensePack) {
    result.defensePack = await buildDefensePack({ input, settings, generated, apiKey, baseUrl, model });
  }
  return result;
}
