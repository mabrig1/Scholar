export type MatchKind = "verbatim" | "near-verbatim" | "possible-paraphrase";

export type SimilarityMatch = {
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  submittedText: string;
  sourceText: string;
  score: number;
  lexicalScore: number;
  semanticScore: number;
  matchedWords: number;
  kind: MatchKind;
};

export type SourceSummary = {
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  similarity: number;
  matchedWords: number;
  matches: number;
};

export type SimilarityReport = {
  overallSimilarity: number;
  matchedWords: number;
  totalWords: number;
  matches: SimilarityMatch[];
  sourceSummaries: SourceSummary[];
  risk: "low" | "moderate" | "high" | "very-high";
  excludedQuotedWords: number;
  excludedBibliographyWords: number;
  methodology: string[];
  limitations: string[];
};

type Source = { id: string; title: string; text: string; url?: string };
type PreparedSentence = {
  text: string;
  tokens: string[];
  content: Set<string>;
  bigrams: Set<string>;
  trigrams: Set<string>;
  fourgrams: Set<string>;
};
type CorpusSentence = PreparedSentence & { source: Source };

const STOP = new Set(
  "a an and are as at be been but by for from had has have he her hers him his i in into is it its of on or our she that the their them they this to was we were will with you your".split(" "),
);

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalized(tokens: string[]) {
  return tokens.join(" ");
}

function sentenceTexts(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => words(sentence).length >= 5);
}

function ngrams(tokens: string[], size: number) {
  const output = new Set<string>();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    output.add(tokens.slice(index, index + size).join(" "));
  }
  return output;
}

function prepareSentence(text: string): PreparedSentence {
  const tokens = words(text);
  return {
    text,
    tokens,
    content: new Set(tokens.filter((word) => !STOP.has(word))),
    bigrams: ngrams(tokens, 2),
    trigrams: ngrams(tokens, 3),
    fourgrams: ngrams(tokens, 4),
  };
}

function jaccard(first: Set<string>, second: Set<string>) {
  if (!first.size || !second.size) return 0;
  let intersection = 0;
  for (const value of first) if (second.has(value)) intersection += 1;
  return intersection / (first.size + second.size - intersection);
}

function dice(first: Set<string>, second: Set<string>) {
  if (!first.size || !second.size) return 0;
  let intersection = 0;
  for (const value of first) if (second.has(value)) intersection += 1;
  return (2 * intersection) / (first.size + second.size);
}

function sharedContentCount(first: PreparedSentence, second: PreparedSentence) {
  let count = 0;
  for (const token of first.content) if (second.content.has(token)) count += 1;
  return count;
}

function classify(
  submission: PreparedSentence,
  source: PreparedSentence,
  lexicalScore: number,
  semanticProxyScore: number,
): MatchKind | null {
  const submittedText = normalized(submission.tokens);
  const sourceText = normalized(source.tokens);
  if (
    submittedText.includes(sourceText) ||
    sourceText.includes(submittedText) ||
    jaccard(submission.fourgrams, source.fourgrams) >= 0.72
  ) return "verbatim";
  if (jaccard(submission.trigrams, source.trigrams) >= 0.34 || lexicalScore >= 0.52) {
    return "near-verbatim";
  }
  if (semanticProxyScore >= 0.57 && sharedContentCount(submission, source) >= 3) {
    return "possible-paraphrase";
  }
  return null;
}

function coveredWordCount(
  submission: PreparedSentence,
  source: PreparedSentence,
  kind: MatchKind,
) {
  const covered = new Set<number>();
  for (const size of [3, 2]) {
    const sourceNgrams = size === 3 ? source.trigrams : source.bigrams;
    for (let index = 0; index <= submission.tokens.length - size; index += 1) {
      const value = submission.tokens.slice(index, index + size).join(" ");
      if (sourceNgrams.has(value)) {
        for (let offset = 0; offset < size; offset += 1) covered.add(index + offset);
      }
    }
  }
  if (covered.size || kind !== "possible-paraphrase") return covered.size;

  const remaining = new Map<string, number>();
  for (const token of source.tokens) {
    if (!STOP.has(token)) remaining.set(token, (remaining.get(token) || 0) + 1);
  }
  for (let index = 0; index < submission.tokens.length; index += 1) {
    const token = submission.tokens[index];
    const available = remaining.get(token) || 0;
    if (!STOP.has(token) && available > 0) {
      covered.add(index);
      remaining.set(token, available - 1);
    }
  }
  return covered.size;
}

function stripReferences(text: string) {
  const match = /(?:^|\n)\s*(references|bibliography|works cited)\s*\n/i.exec(text);
  if (!match || match.index < 0) return { body: text, excluded: 0 };
  const references = text.slice(match.index);
  return { body: text.slice(0, match.index), excluded: words(references).length };
}

function stripQuotes(text: string) {
  let excluded = 0;
  const body = text.replace(/“([^”]{15,})”|"([^"]{15,})"/g, (match) => {
    excluded += words(match).length;
    return " ";
  });
  return { body, excluded };
}

function reviewBand(value: number): SimilarityReport["risk"] {
  return value < 10 ? "low" : value < 20 ? "moderate" : value < 35 ? "high" : "very-high";
}

function candidateIndexes(
  sentence: PreparedSentence,
  invertedIndex: Map<string, number[]>,
) {
  const counts = new Map<number, number>();
  for (const token of sentence.content) {
    for (const index of invertedIndex.get(token) || []) {
      counts.set(index, (counts.get(index) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2 || sentence.content.size <= 3)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 300)
    .map(([index]) => index);
}

export function compareAgainstCorpus(submission: string, sources: Source[]): SimilarityReport {
  const references = stripReferences(submission);
  const quotes = stripQuotes(references.body);
  const submittedSentences = sentenceTexts(quotes.body).map(prepareSentence);
  const totalWords = Math.max(1, words(quotes.body).length);
  const matches: SimilarityMatch[] = [];

  const corpus: CorpusSentence[] = sources.flatMap((source) =>
    sentenceTexts(source.text).map((text) => ({ ...prepareSentence(text), source })),
  );
  const invertedIndex = new Map<string, number[]>();
  corpus.forEach((sentence, index) => {
    for (const token of sentence.content) {
      const indexes = invertedIndex.get(token) || [];
      indexes.push(index);
      invertedIndex.set(token, indexes);
    }
  });

  for (const submitted of submittedSentences) {
    let best:
      | { candidate: CorpusSentence; score: number; lexical: number; semanticProxy: number; kind: MatchKind; matchedWords: number }
      | undefined;
    for (const index of candidateIndexes(submitted, invertedIndex)) {
      const candidate = corpus[index];
      const trigram = jaccard(submitted.trigrams, candidate.trigrams);
      const bigram = dice(submitted.bigrams, candidate.bigrams);
      const token = jaccard(submitted.content, candidate.content);
      const lexical = Math.max(trigram, bigram * 0.9);
      const semanticProxy = Math.max(token * 0.9, token * 0.65 + bigram * 0.35);
      const score = Math.max(lexical, lexical * 0.45 + semanticProxy * 0.55);
      if (score < 0.46) continue;
      const kind = classify(submitted, candidate, lexical, semanticProxy);
      if (!kind) continue;
      const matchedWords = coveredWordCount(submitted, candidate, kind);
      if (matchedWords < 3) continue;
      if (!best || score > best.score) {
        best = { candidate, score, lexical, semanticProxy, kind, matchedWords };
      }
    }
    if (!best) continue;
    matches.push({
      sourceId: best.candidate.source.id,
      sourceTitle: best.candidate.source.title,
      sourceUrl: best.candidate.source.url,
      submittedText: submitted.text,
      sourceText: best.candidate.text,
      score: Math.round(best.score * 100),
      lexicalScore: Math.round(best.lexical * 100),
      semanticScore: Math.round(best.semanticProxy * 100),
      matchedWords: best.matchedWords,
      kind: best.kind,
    });
  }

  const matchedWords = matches.reduce((sum, match) => sum + match.matchedWords, 0);
  const overallSimilarity = Math.min(100, Math.round((matchedWords / totalWords) * 100));
  const summaries = new Map<string, SourceSummary>();
  for (const match of matches) {
    const summary = summaries.get(match.sourceId) || {
      sourceId: match.sourceId,
      sourceTitle: match.sourceTitle,
      sourceUrl: match.sourceUrl,
      similarity: 0,
      matchedWords: 0,
      matches: 0,
    };
    summary.matchedWords += match.matchedWords;
    summary.matches += 1;
    summaries.set(match.sourceId, summary);
  }
  const sourceSummaries = [...summaries.values()]
    .map((summary) => ({
      ...summary,
      similarity: Math.min(100, Math.round((summary.matchedWords / totalWords) * 100)),
    }))
    .sort((first, second) => second.similarity - first.similarity);

  return {
    overallSimilarity,
    matchedWords,
    totalWords,
    matches: matches.sort((first, second) => second.score - first.score),
    sourceSummaries,
    risk: reviewBand(overallSimilarity),
    excludedQuotedWords: quotes.excluded,
    excludedBibliographyWords: references.excluded,
    methodology: [
      "Precomputed 2/3/4-word shingling and content-word overlap",
      "Candidate indexing to bound large-corpus comparisons",
      "Conservative word-level overlap coverage rather than whole-sentence counting",
      "Sentence-level best-source attribution and per-source contribution",
      "Quoted text and terminal bibliography exclusion",
    ],
    limitations: [
      "Independent Scholar similarity screening; it is not Turnitin and has no access to Turnitin's proprietary corpus.",
      "Coverage depends on the sources explicitly supplied or approved for comparison.",
      "Possible-paraphrase is a lexical proxy flag for human review, not proof of semantic copying or misconduct.",
      "Short fragments under five words are not assessed as standalone passages.",
      "The review bands are triage aids, not institutional misconduct thresholds.",
    ],
  };
}
