export type ArticleAuthor = {
  given: string;
  family: string;
  orcid?: string;
};

export type ScholarlyArticle = {
  doi: string;
  title: string;
  authors: ArticleAuthor[];
  year: number;
  journal: string;
  publisher: string;
  url: string;
  abstract: string;
  volume: string;
  issue: string;
  pages: string;
  citationCount: number;
  openAccess: boolean | null;
  openAlexId: string | null;
  retracted: boolean;
  verification: "crossref" | "crossref-openalex";
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function firstString(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

export function stripMarkup(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex: string, decimal: string) => String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDoi(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/[\s.,;]+$/g, "")
    .toLowerCase();
}

function publicationYear(item: UnknownRecord) {
  for (const field of ["published-print", "published-online", "published", "issued", "created"]) {
    const dateParts = record(item[field])["date-parts"];
    const year = Number(Array.isArray(dateParts) && Array.isArray(dateParts[0]) ? dateParts[0][0] : 0);
    if (year >= 1000 && year <= 9999) return year;
  }
  return 0;
}

export function crossrefItemToArticle(value: unknown): ScholarlyArticle | null {
  const item = record(value);
  const doi = normalizeDoi(item.DOI);
  const title = stripMarkup(firstString(item.title));
  const year = publicationYear(item);
  if (!doi || !title || !year) return null;
  const authors = Array.isArray(item.author)
    ? item.author.map((entry) => {
      const author = record(entry);
      return {
        given: stripMarkup(author.given),
        family: stripMarkup(author.family || author.name),
        orcid: firstString(author.ORCID).replace(/^https?:\/\/orcid\.org\//i, "") || undefined,
      };
    }).filter((author) => author.family)
    : [];
  return {
    doi,
    title,
    authors,
    year,
    journal: stripMarkup(firstString(item["container-title"])) || "Journal title unavailable",
    publisher: stripMarkup(item.publisher),
    url: `https://doi.org/${doi}`,
    abstract: stripMarkup(item.abstract).slice(0, 4_000),
    volume: stripMarkup(item.volume),
    issue: stripMarkup(item.issue),
    pages: stripMarkup(item.page || item.article_number),
    citationCount: Math.max(0, Number(item["is-referenced-by-count"]) || 0),
    openAccess: null,
    openAlexId: null,
    retracted: false,
    verification: "crossref",
  };
}

function initials(given: string) {
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(" ");
}

export function authorYearLabel(article: Pick<ScholarlyArticle, "authors" | "year">) {
  if (!article.authors.length) return `Unknown author (${article.year})`;
  if (article.authors.length === 1) return `${article.authors[0].family} (${article.year})`;
  if (article.authors.length === 2) return `${article.authors[0].family} and ${article.authors[1].family} (${article.year})`;
  return `${article.authors[0].family} et al. (${article.year})`;
}

export function parentheticalCitation(article: Pick<ScholarlyArticle, "authors" | "year">) {
  if (!article.authors.length) return `(Unknown author, ${article.year})`;
  if (article.authors.length === 1) return `(${article.authors[0].family}, ${article.year})`;
  if (article.authors.length === 2) return `(${article.authors[0].family} & ${article.authors[1].family}, ${article.year})`;
  return `(${article.authors[0].family} et al., ${article.year})`;
}

export function apa7Reference(article: ScholarlyArticle) {
  const formattedAuthors = article.authors.map((author) => `${author.family}, ${initials(author.given)}`);
  let authorText = "Unknown author";
  if (formattedAuthors.length === 1) authorText = formattedAuthors[0];
  else if (formattedAuthors.length > 1 && formattedAuthors.length <= 20) authorText = `${formattedAuthors.slice(0, -1).join(", ")}, & ${formattedAuthors.at(-1)}`;
  else if (formattedAuthors.length > 20) authorText = `${formattedAuthors.slice(0, 19).join(", ")}, … ${formattedAuthors.at(-1)}`;
  const issue = article.issue ? `(${article.issue})` : "";
  const volumeIssue = article.volume ? `, ${article.volume}${issue}` : "";
  const pages = article.pages ? `, ${article.pages}` : "";
  return `${authorText} (${article.year}). ${article.title}. ${article.journal}${volumeIssue}${pages}. https://doi.org/${article.doi}`;
}

export function reconstructOpenAlexAbstract(value: unknown) {
  const index = record(value);
  const words: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      const numericPosition = Number(position);
      if (Number.isInteger(numericPosition) && numericPosition >= 0) words.push({ word, position: numericPosition });
    }
  }
  return words.sort((left, right) => left.position - right.position).map(({ word }) => word).join(" ").slice(0, 4_000);
}

export function deduplicateArticlesByTitle(articles: ScholarlyArticle[], limit = articles.length) {
  const unique = new Map<string, ScholarlyArticle>();
  for (const article of articles) {
    const key = article.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!unique.has(key)) unique.set(key, article);
  }
  return [...unique.values()].slice(0, Math.max(0, limit));
}

export function buildChapterTwoOutline(input: {
  topic: string;
  concepts: string;
  theories: string;
  objectives: string;
}, articles: ScholarlyArticle[]) {
  const concepts = input.concepts.split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean);
  const theories = input.theories.split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean);
  const studyReviews = articles.map((article, index) => `${index + 1}. ${authorYearLabel(article)} — ${article.title}\n   Purpose/design/findings: Extract and verify from the full article.\n   Relevance to the present study: Connect the evidence explicitly to ${input.topic}.\n   DOI: https://doi.org/${article.doi}`).join("\n\n");
  return `# CHAPTER TWO\n# REVIEW OF RELATED LITERATURE\n\n## 2.1 Introduction\nThis chapter reviews literature relevant to ${input.topic}. It is organized around the conceptual framework, theoretical framework, previous empirical studies, identified research gaps, and a summary of the reviewed literature.\n\n## 2.2 Conceptual Framework\n${concepts.length ? concepts.map((concept, index) => `### 2.2.${index + 1} ${concept}\nDefine ${concept} using multiple selected sources, compare areas of agreement and disagreement, explain its dimensions or indicators, and connect it to the present study. Do not rely on dictionary definitions alone.`).join("\n\n") : "Identify the central concepts in the study title and objectives. Define, compare and operationalize each concept with evidence from the selected literature."}\n\n## 2.3 Theoretical Framework\n${theories.length ? theories.map((theory, index) => `### 2.3.${index + 1} ${theory}\nState the originator and year only after checking a primary or authoritative source. Explain the theory's assumptions, major propositions, strengths, limitations, empirical applications and relevance to the present study.`).join("\n\n") : "Select one or more theories that explain the relationship among the study variables. Verify the originator, date and propositions using primary or authoritative sources before drafting."}\n\n### 2.3.${Math.max(1, theories.length) + 1} Application of the Theory to the Study\nExplain how the selected theory connects the independent and dependent variables, research objectives and expected relationships. Justify the preferred theory instead of merely describing it.\n\n## 2.4 Review of Previous Empirical Studies\n${studyReviews || "Select verified empirical articles before drafting this section."}\n\n## 2.5 Gap in the Literature\nCompare the reviewed studies by setting, population, variables, method and period. Identify a genuine contextual, methodological, theoretical or empirical gap that the present study can address.\n\n## 2.6 Summary of Reviewed Literature\nSynthesize the dominant findings, unresolved debates, theoretical position and specific contribution expected from the present study.\n\n## References\n${articles.map(apa7Reference).sort().join("\n")}`;
}
