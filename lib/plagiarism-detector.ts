export type MatchKind = "verbatim" | "near-verbatim" | "paraphrase";

export type SimilarityMatch = {
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  submittedText: string;
  sourceText: string;
  score: number;
  kind: MatchKind;
};

export type SimilarityReport = {
  overallSimilarity: number;
  matchedWords: number;
  totalWords: number;
  matches: SimilarityMatch[];
  excludedQuotedWords: number;
  excludedBibliographyWords: number;
  methodology: string[];
  limitations: string[];
};

type Source = { id: string; title: string; text: string; url?: string };

const STOP = new Set("a an and are as at be been but by for from had has have he her hers him his i in into is it its of on or our she that the their them they this to was we were will with you your".split(" "));

function words(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}

function normalize(text: string) { return words(text).join(" "); }
function contentWords(text: string) { return words(text).filter(w => !STOP.has(w)); }

function sentences(text: string) {
  return text.replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => words(s).length >= 5);
}

function shingles(text: string, n = 5) {
  const ws = words(text); const out = new Set<string>();
  for (let i = 0; i <= ws.length - n; i++) out.add(ws.slice(i, i + n).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let common = 0; for (const x of a) if (b.has(x)) common++;
  return common / (a.size + b.size - common);
}

function tokenSimilarity(a: string, b: string) {
  const aa = new Set(contentWords(a)); const bb = new Set(contentWords(b));
  return jaccard(aa, bb);
}

function classify(a: string, b: string, score: number): MatchKind {
  const na = normalize(a), nb = normalize(b);
  if (na.includes(nb) || nb.includes(na) || jaccard(shingles(a, 4), shingles(b, 4)) >= .72) return "verbatim";
  if (jaccard(shingles(a, 3), shingles(b, 3)) >= .38) return "near-verbatim";
  return score >= .58 ? "paraphrase" : "near-verbatim";
}

function stripReferences(text: string) {
  const marker = /\n\s*(references|bibliography|works cited)\s*\n/i.exec(text);
  if (!marker?.index) return { body: text, excluded: 0 };
  const removed = text.slice(marker.index);
  return { body: text.slice(0, marker.index), excluded: words(removed).length };
}

function stripQuotes(text: string) {
  let excluded = 0;
  const body = text.replace(/[“\"]([^”\"]{15,})[”\"]/g, m => { excluded += words(m).length; return " "; });
  return { body, excluded };
}

export function compareAgainstCorpus(submission: string, sources: Source[]): SimilarityReport {
  const refs = stripReferences(submission);
  const quotes = stripQuotes(refs.body);
  const submittedSentences = sentences(quotes.body);
  const totalWords = Math.max(1, words(quotes.body).length);
  const matches: SimilarityMatch[] = [];
  const matchedSentenceIndexes = new Set<number>();

  const sourceSentences = sources.flatMap(source => sentences(source.text).map(text => ({ source, text })));
  submittedSentences.forEach((sentence, index) => {
    let best: { source: Source; text: string; score: number } | undefined;
    for (const candidate of sourceSentences) {
      const lexical = jaccard(shingles(sentence, 3), shingles(candidate.text, 3));
      const semanticProxy = tokenSimilarity(sentence, candidate.text);
      const score = Math.max(lexical, semanticProxy * .88);
      if (score >= .48 && (!best || score > best.score)) best = { source: candidate.source, text: candidate.text, score };
    }
    if (best) {
      matchedSentenceIndexes.add(index);
      matches.push({ sourceId: best.source.id, sourceTitle: best.source.title, sourceUrl: best.source.url, submittedText: sentence, sourceText: best.text, score: Math.round(best.score * 100), kind: classify(sentence, best.text, best.score) });
    }
  });

  const matchedWords = submittedSentences.reduce((sum, s, i) => sum + (matchedSentenceIndexes.has(i) ? words(s).length : 0), 0);
  return {
    overallSimilarity: Math.min(100, Math.round(matchedWords / totalWords * 100)),
    matchedWords, totalWords, matches: matches.sort((a,b) => b.score-a.score),
    excludedQuotedWords: quotes.excluded, excludedBibliographyWords: refs.excluded,
    methodology: ["5/4/3-word shingling and fingerprint-style overlap", "sentence-level candidate matching", "content-word similarity for lightly paraphrased passages", "source-attributed passage reporting", "quoted text and bibliography exclusion"],
    limitations: ["This is an independent similarity checker, not Turnitin and it does not access Turnitin's private student-paper or publisher corpus.", "Detection quality depends on the corpus supplied to Scholar.", "The built-in paraphrase layer is conservative; production semantic embeddings/vector search can improve recall."],
  };
}
