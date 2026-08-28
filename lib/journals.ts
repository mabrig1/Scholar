export type Journal = {
  id: string;
  name: string;
  issn: string[];
  issnL?: string | null;
  publisher?: string | null;
  homepage?: string | null;
  country?: string | null;
  isOpenAccess: boolean;
  isInDoaj: boolean;
  apcUsd?: number | null;
  worksCount?: number | null;
  citedByCount?: number | null;
  hIndex?: number | null;
  twoYearMeanCitedness?: number | null;
  feeStatus: "no-apc-listed" | "apc-listed" | "unknown";
  impactSignal: "high" | "moderate" | "emerging";
};

type OpenAlexSource = {
  id?: string;
  display_name?: string;
  issn?: string[];
  issn_l?: string | null;
  host_organization_name?: string | null;
  homepage_url?: string | null;
  country_code?: string | null;
  is_oa?: boolean;
  is_in_doaj?: boolean;
  apc_usd?: number | null;
  works_count?: number | null;
  cited_by_count?: number | null;
  summary_stats?: {
    h_index?: number | null;
    "2yr_mean_citedness"?: number | null;
  } | null;
  type?: string;
};

export function normalizeOpenAlexSource(source: OpenAlexSource): Journal {
  const hIndex = source.summary_stats?.h_index ?? null;
  const twoYear = source.summary_stats?.["2yr_mean_citedness"] ?? null;
  const apc = typeof source.apc_usd === "number" ? source.apc_usd : null;

  let impactSignal: Journal["impactSignal"] = "emerging";
  if ((hIndex ?? 0) >= 50 || (twoYear ?? 0) >= 5) impactSignal = "high";
  else if ((hIndex ?? 0) >= 20 || (twoYear ?? 0) >= 2) impactSignal = "moderate";

  return {
    id: source.id ?? crypto.randomUUID(),
    name: source.display_name ?? "Unnamed journal",
    issn: source.issn ?? [],
    issnL: source.issn_l ?? null,
    publisher: source.host_organization_name ?? null,
    homepage: source.homepage_url ?? null,
    country: source.country_code ?? null,
    isOpenAccess: Boolean(source.is_oa),
    isInDoaj: Boolean(source.is_in_doaj),
    apcUsd: apc,
    worksCount: source.works_count ?? null,
    citedByCount: source.cited_by_count ?? null,
    hIndex,
    twoYearMeanCitedness: twoYear,
    feeStatus: apc === 0 ? "no-apc-listed" : apc && apc > 0 ? "apc-listed" : "unknown",
    impactSignal,
  };
}

export async function searchOpenAlexSources(query: string, perPage = 40): Promise<Journal[]> {
  const url = new URL("https://api.openalex.org/sources");
  if (query.trim()) url.searchParams.set("search", query.trim());
  url.searchParams.set("filter", "type:journal");
  url.searchParams.set("per-page", String(Math.min(Math.max(perPage, 1), 100)));

  const response = await fetch(url, {
    headers: { "User-Agent": "MabrigResearcherPro/0.1 (journal discovery app)" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) throw new Error(`OpenAlex request failed (${response.status})`);
  const data = await response.json();
  return (data.results ?? []).map(normalizeOpenAlexSource);
}

export async function verifyCrossrefIssn(issn: string) {
  const cleaned = issn.trim();
  if (!cleaned) return null;

  const response = await fetch(`https://api.crossref.org/journals/${encodeURIComponent(cleaned)}`, {
    headers: { "User-Agent": "MabrigResearcherPro/0.1 (mailto:admin@mabrigkorie.org)" },
    next: { revalidate: 86400 },
  });

  if (!response.ok) return null;
  const data = await response.json();
  const message = data.message ?? {};

  return {
    title: message.title ?? null,
    publisher: message.publisher ?? null,
    issn: message.ISSN ?? [],
    subjects: message.subjects ?? [],
    lastStatusCheckTime: message["last-status-check-time"] ?? null,
  };
}

export async function findCrossrefJournals(title: string) {
  if (!title.trim()) return [];
  const url = new URL("https://api.crossref.org/journals");
  url.searchParams.set("query", title.trim());
  url.searchParams.set("rows", "5");

  const response = await fetch(url, {
    headers: { "User-Agent": "MabrigResearcherPro/0.1 (mailto:admin@mabrigkorie.org)" },
    next: { revalidate: 86400 },
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.message?.items ?? [];
}

export function compactNumber(value?: number | null) {
  if (!value) return "0";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
