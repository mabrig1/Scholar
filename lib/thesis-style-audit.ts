export type ThesisStyleIssue = {
  id: string;
  label: string;
  count: number;
  severity: "info" | "warning";
  guidance: string;
  examples: string[];
};

export type ThesisStyleReport = {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageSentenceWords: number;
  averageParagraphWords: number;
  fleschReadingEase: number;
  longSentenceCount: number;
  longParagraphCount: number;
  passiveVoiceSignals: number;
  nominalizationSignals: number;
  hedgeSignals: number;
  repeatedOpeningSignals: number;
  citationCount: number;
  doiCount: number;
  numericTokenCount: number;
  issues: ThesisStyleIssue[];
};

export type RewriteIntegrityAudit = {
  passed: boolean;
  citationsPreserved: boolean;
  numbersPreserved: boolean;
  headingsPreserved: boolean;
  quotationsPreserved: boolean;
  doisPreserved: boolean;
  missingCitations: string[];
  changedNumbers: string[];
  missingHeadings: string[];
  missingQuotations: string[];
  missingDois: string[];
  wordCountChangePercent: number;
  vocabularyRetentionPercent: number;
};

const WORD_PATTERN = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’\-][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g;
const HEDGES = new Set(["arguably", "apparently", "generally", "largely", "likely", "maybe", "often", "perhaps", "possibly", "probably", "seemingly", "somewhat", "typically"]);
const NOMINAL_ENDINGS = /(?:tion|sion|ment|ance|ence|ity|ness|ization|isation)$/i;
const NOMINAL_EXCLUSIONS = new Set(["government", "department", "statement", "management", "development", "community", "university"]);

function words(value: string) {
  return value.match(WORD_PATTERN) || [];
}

function sentences(value: string) {
  return value
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Fig|Eq|et al)\./gi, (match) => match.replace(".", "∯"))
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
    .map((sentence) => sentence.replace(/∯/g, ".").trim())
    .filter((sentence) => words(sentence).length > 0);
}

function paragraphs(value: string) {
  return value.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function estimateSyllables(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length <= 3) return 1;
  const withoutSilentE = cleaned.replace(/(?:[^l]e|es|ed)$/, "");
  return Math.max(1, withoutSilentE.match(/[aeiouy]{1,2}/g)?.length || 1);
}

function topExamples(values: string[], max = 5) {
  return [...new Set(values)].slice(0, max);
}

export function citationFragments(text: string) {
  const parenthetical = text.match(/\((?=[^\n()]*[A-Za-z])[^\n()]{0,160}\b(?:19|20)\d{2}[a-z]?[^\n()]{0,100}\)/g) || [];
  const narrative = text.match(/\b[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]+(?:\s+(?:and|&amp;|&)\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]+|\s+et al\.)?\s+\((?:19|20)\d{2}[a-z]?\)/g) || [];
  return [...new Set([...parenthetical, ...narrative])].sort();
}

export function numericTokens(text: string) {
  return (text.match(/(?<![A-Za-z])[-+]?\d+(?:[.,]\d+)?%?/g) || []).sort();
}

export function doiTokens(text: string) {
  return [...new Set((text.match(/10\.\d{4,9}\/[\w.()/:;-]+/gi) || []).map((doi) => doi.replace(/[.,;]+$/, "").toLowerCase()))].sort();
}

export function headingFragments(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter((line) =>
    /^(?:#{1,6}\s+|chapter\s+(?:one|two|three|four|five|six|\d+)|\d+(?:\.\d+){0,4}\s+)/i.test(line) ||
    /^[A-Z][A-Z\s&:-]{7,}$/.test(line),
  );
}

export function quotationFragments(text: string) {
  const matches = text.match(/[“"]([^”"\n]{12,})[”"]/g) || [];
  return [...new Set(matches.map((quote) => quote.trim()))].sort();
}

function multisetDifference(source: string[], target: string[]) {
  const counts = new Map<string, number>();
  for (const value of target) counts.set(value, (counts.get(value) || 0) + 1);
  const missing: string[] = [];
  for (const value of source) {
    const remaining = counts.get(value) || 0;
    if (remaining > 0) counts.set(value, remaining - 1);
    else missing.push(value);
  }
  return missing;
}

export function analyzeThesisStyle(text: string): ThesisStyleReport {
  const allWords = words(text);
  const allSentences = sentences(text);
  const allParagraphs = paragraphs(text);
  const longSentences = allSentences.filter((sentence) => words(sentence).length > 32);
  const longParagraphs = allParagraphs.filter((paragraph) => words(paragraph).length > 180);
  const passiveExamples = allSentences.filter((sentence) => /\b(?:am|are|been|being|is|was|were)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/i.test(sentence));
  const nominalizations = allWords.filter((word) => NOMINAL_ENDINGS.test(word) && !NOMINAL_EXCLUSIONS.has(word.toLowerCase()));
  const hedges = allWords.filter((word) => HEDGES.has(word.toLowerCase()));
  const openings = new Map<string, string[]>();
  for (const sentence of allSentences) {
    const opening = words(sentence).slice(0, 2).join(" ").toLowerCase();
    if (opening.split(" ").length < 2) continue;
    openings.set(opening, [...(openings.get(opening) || []), sentence]);
  }
  const repeatedOpenings = [...openings.entries()].filter(([, matches]) => matches.length >= 3);
  const syllables = allWords.reduce((sum, word) => sum + estimateSyllables(word), 0);
  const readingEase = allWords.length && allSentences.length
    ? 206.835 - 1.015 * (allWords.length / allSentences.length) - 84.6 * (syllables / allWords.length)
    : 0;
  const issues: ThesisStyleIssue[] = [];
  if (longSentences.length) issues.push({ id: "long-sentences", label: "Long sentences", count: longSentences.length, severity: "warning", guidance: "Consider dividing sentences longer than 32 words where each clause carries a separate idea.", examples: topExamples(longSentences) });
  if (longParagraphs.length) issues.push({ id: "long-paragraphs", label: "Dense paragraphs", count: longParagraphs.length, severity: "warning", guidance: "Give each paragraph one controlling idea, evidence and interpretation.", examples: topExamples(longParagraphs) });
  if (passiveExamples.length) issues.push({ id: "passive", label: "Possible passive constructions", count: passiveExamples.length, severity: "info", guidance: "Retain passive voice when the procedure matters more than the actor; otherwise name the actor directly.", examples: topExamples(passiveExamples) });
  if (nominalizations.length) issues.push({ id: "nominalizations", label: "Heavy nominalization", count: nominalizations.length, severity: "info", guidance: "Where precision allows, turn abstract nouns into direct verbs to make claims clearer.", examples: topExamples(nominalizations) });
  if (hedges.length) issues.push({ id: "hedges", label: "Hedging words", count: hedges.length, severity: "info", guidance: "Keep warranted caution, but remove stacked or unsupported qualifiers.", examples: topExamples(hedges) });
  if (repeatedOpenings.length) issues.push({ id: "openings", label: "Repeated sentence openings", count: repeatedOpenings.length, severity: "info", guidance: "Vary repeated openings while preserving the logical subject of each sentence.", examples: topExamples(repeatedOpenings.map(([opening]) => opening)) });
  return {
    wordCount: allWords.length,
    sentenceCount: allSentences.length,
    paragraphCount: allParagraphs.length,
    averageSentenceWords: allSentences.length ? allWords.length / allSentences.length : 0,
    averageParagraphWords: allParagraphs.length ? allWords.length / allParagraphs.length : 0,
    fleschReadingEase: Math.max(0, Math.min(100, readingEase)),
    longSentenceCount: longSentences.length,
    longParagraphCount: longParagraphs.length,
    passiveVoiceSignals: passiveExamples.length,
    nominalizationSignals: nominalizations.length,
    hedgeSignals: hedges.length,
    repeatedOpeningSignals: repeatedOpenings.length,
    citationCount: citationFragments(text).length,
    doiCount: doiTokens(text).length,
    numericTokenCount: numericTokens(text).length,
    issues,
  };
}

export function auditRewriteIntegrity(source: string, rewritten: string): RewriteIntegrityAudit {
  const missingCitations = citationFragments(source).filter((fragment) => !rewritten.includes(fragment));
  const changedNumbers = multisetDifference(numericTokens(source), numericTokens(rewritten));
  const missingHeadings = headingFragments(source).filter((fragment) => !rewritten.includes(fragment));
  const missingQuotations = quotationFragments(source).filter((fragment) => !rewritten.includes(fragment));
  const missingDois = doiTokens(source).filter((fragment) => !doiTokens(rewritten).includes(fragment));
  const sourceWords = words(source).map((word) => word.toLowerCase());
  const rewrittenWords = words(rewritten).map((word) => word.toLowerCase());
  const lostVocabulary = multisetDifference(sourceWords, rewrittenWords).length;
  const vocabularyRetentionPercent = sourceWords.length ? ((sourceWords.length - lostVocabulary) / sourceWords.length) * 100 : 100;
  const wordCountChangePercent = sourceWords.length ? ((rewrittenWords.length - sourceWords.length) / sourceWords.length) * 100 : 0;
  const citationsPreserved = missingCitations.length === 0;
  const numbersPreserved = changedNumbers.length === 0 && multisetDifference(numericTokens(rewritten), numericTokens(source)).length === 0;
  const headingsPreserved = missingHeadings.length === 0;
  const quotationsPreserved = missingQuotations.length === 0;
  const doisPreserved = missingDois.length === 0;
  return {
    passed: citationsPreserved && numbersPreserved && headingsPreserved && quotationsPreserved && doisPreserved,
    citationsPreserved,
    numbersPreserved,
    headingsPreserved,
    quotationsPreserved,
    doisPreserved,
    missingCitations,
    changedNumbers,
    missingHeadings,
    missingQuotations,
    missingDois,
    wordCountChangePercent,
    vocabularyRetentionPercent,
  };
}
