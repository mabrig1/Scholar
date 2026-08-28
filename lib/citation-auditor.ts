export type CitationAuditItem = {
  lineNumber: number;
  reference: string;
  doi: string | null;
  status: "verified" | "warning" | "failed" | "unverified";
  crossrefFound: boolean;
  openAlexFound: boolean;
  title: string | null;
  publisher: string | null;
  publishedYear: number | null;
  isRetracted: boolean | null;
  citedByCount: number | null;
  issues: string[];
};

export type CitationAuditResult = {
  auditedAt: string;
  totalReferences: number;
  doiReferences: number;
  verifiedDois: number;
  failedDois: number;
  duplicateDois: string[];
  possibleMalformedDois: string[];
  retractionFlags: number;
  score: number;
  grade: "strong" | "good" | "needs-work" | "poor";
  items: CitationAuditItem[];
  priorityFixes: string[];
  notice: string;
};

const DOI_RE = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
const DOI_LIKE_RE = /\b10\.\d{3,9}\/[A-Za-z0-9._;()/:+-]+/gi;

function cleanDoi(value: string) {
  return value
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[\s.,;:)\]}]+$/g, "")
    .trim()
    .toLowerCase();
}

function yearFromCrossref(message: any): number | null {
  const parts = message?.published?.["date-parts"]?.[0]
    ?? message?.published_print?.["date-parts"]?.[0]
    ?? message?.published_online?.["date-parts"]?.[0]
    ?? message?.issued?.["date-parts"]?.[0];
  const year = Number(parts?.[0]);
  return Number.isFinite(year) ? year : null;
}

async function crossrefByDoi(doi: string) {
  try {
    const headers: Record<string, string> = {
      "User-Agent": `MabrigResearcherPro/0.6 (${process.env.CROSSREF_MAILTO || "publisher citation audit"})`,
    };
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers,
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json())?.message ?? null;
  } catch {
    return null;
  }
}

async function openAlexByDoi(doi: string) {
  try {
    const url = new URL(`https://api.openalex.org/works/https://doi.org/${doi}`);
    if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
    const response = await fetch(url, {
      headers: { "User-Agent": "MabrigResearcherPro/0.6 (citation integrity audit)" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function grade(score: number): CitationAuditResult["grade"] {
  if (score >= 90) return "strong";
  if (score >= 75) return "good";
  if (score >= 55) return "needs-work";
  return "poor";
}

export async function auditCitations(referenceText: string): Promise<CitationAuditResult> {
  const lines = referenceText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60);

  if (!lines.length) throw new Error("Paste a reference list with at least one reference.");

  const doiCounts = new Map<string, number>();
  const possibleMalformedDois = new Set<string>();
  const prepared = lines.map((reference, index) => {
    const matches = [...reference.matchAll(DOI_RE)].map((match) => cleanDoi(match[0]));
    const doi = matches[0] || null;
    if (doi) doiCounts.set(doi, (doiCounts.get(doi) || 0) + 1);

    for (const match of reference.match(DOI_LIKE_RE) || []) {
      const candidate = cleanDoi(match);
      if (!/^10\.\d{4,9}\/.+/i.test(candidate)) possibleMalformedDois.add(candidate);
    }

    return { reference, lineNumber: index + 1, doi };
  });

  const uniqueDois = [...new Set(prepared.map((item) => item.doi).filter(Boolean) as string[])];
  const lookup = new Map<string, { crossref: any; openalex: any }>();

  for (let i = 0; i < uniqueDois.length; i += 5) {
    const batch = uniqueDois.slice(i, i + 5);
    const results = await Promise.all(batch.map(async (doi) => ({
      doi,
      crossref: await crossrefByDoi(doi),
      openalex: await openAlexByDoi(doi),
    })));
    for (const result of results) lookup.set(result.doi, { crossref: result.crossref, openalex: result.openalex });
  }

  const items: CitationAuditItem[] = prepared.map((item) => {
    if (!item.doi) {
      return {
        ...item,
        status: "unverified",
        crossrefFound: false,
        openAlexFound: false,
        title: null,
        publisher: null,
        publishedYear: null,
        isRetracted: null,
        citedByCount: null,
        issues: ["No DOI was detected. This may be valid, but the reference could not be automatically DOI-verified."],
      };
    }

    const record = lookup.get(item.doi);
    const crossref = record?.crossref;
    const openalex = record?.openalex;
    const issues: string[] = [];
    const duplicate = (doiCounts.get(item.doi) || 0) > 1;
    if (!crossref && !openalex) issues.push("The DOI did not resolve in Crossref or OpenAlex during this audit.");
    if (duplicate) issues.push("This DOI appears more than once in the pasted reference list.");
    if (openalex?.is_retracted === true) issues.push("OpenAlex currently flags this work as retracted. Manually verify the retraction status before citing it.");

    const title = Array.isArray(crossref?.title) ? crossref.title[0] : openalex?.display_name;
    const status: CitationAuditItem["status"] = openalex?.is_retracted === true
      ? "failed"
      : !crossref && !openalex
        ? "failed"
        : issues.length
          ? "warning"
          : "verified";

    return {
      ...item,
      status,
      crossrefFound: Boolean(crossref),
      openAlexFound: Boolean(openalex),
      title: typeof title === "string" ? title : null,
      publisher: typeof crossref?.publisher === "string" ? crossref.publisher : (openalex?.primary_location?.source?.host_organization_name || null),
      publishedYear: yearFromCrossref(crossref) || (Number(openalex?.publication_year) || null),
      isRetracted: typeof openalex?.is_retracted === "boolean" ? openalex.is_retracted : null,
      citedByCount: Number.isFinite(Number(openalex?.cited_by_count)) ? Number(openalex.cited_by_count) : null,
      issues,
    };
  });

  const duplicateDois = [...doiCounts.entries()].filter(([, count]) => count > 1).map(([doi]) => doi);
  const doiItems = items.filter((item) => item.doi);
  const verifiedDois = doiItems.filter((item) => item.crossrefFound || item.openAlexFound).length;
  const failedDois = doiItems.filter((item) => item.status === "failed").length;
  const retractionFlags = items.filter((item) => item.isRetracted === true).length;

  let score = 100;
  score -= failedDois * 18;
  score -= duplicateDois.length * 6;
  score -= retractionFlags * 25;
  score -= Math.min(15, possibleMalformedDois.size * 5);
  if (doiItems.length && verifiedDois < doiItems.length) score -= 8;
  score = Math.max(0, Math.min(100, score));

  const priorityFixes: string[] = [];
  if (retractionFlags) priorityFixes.push("Resolve every retraction flag before submission. Confirm the current status from the publisher/retraction notice and replace or contextualize affected citations where necessary.");
  if (failedDois) priorityFixes.push("Correct or replace DOI references that fail both Crossref and OpenAlex verification.");
  if (duplicateDois.length) priorityFixes.push(`Remove or justify duplicate DOI references: ${duplicateDois.join(", ")}.`);
  if (possibleMalformedDois.size) priorityFixes.push("Repair DOI-like strings that do not match the standard DOI pattern.");
  if (!doiItems.length) priorityFixes.push("No DOI-bearing references were detected. Use title/author/manual checks for sources that legitimately lack DOIs.");
  if (!priorityFixes.length) priorityFixes.push("No major DOI-integrity failures were found. Complete manual reference-style, author, title, year, page and source checks before submission.");

  return {
    auditedAt: new Date().toISOString(),
    totalReferences: items.length,
    doiReferences: doiItems.length,
    verifiedDois,
    failedDois,
    duplicateDois,
    possibleMalformedDois: [...possibleMalformedDois],
    retractionFlags,
    score,
    grade: grade(score),
    items,
    priorityFixes,
    notice: "This is a DOI/metadata integrity screen, not a substitute for scholarly judgment. A resolvable DOI does not prove that a source is appropriate, unretracted, or correctly represented in the manuscript; retraction and editorial-status signals must be confirmed on authoritative sources.",
  };
}
