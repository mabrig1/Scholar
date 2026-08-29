export type AcademicSourceCandidate = {
  id: string;
  title: string;
  url?: string;
  doi?: string;
  year?: number;
  provider: "OpenAlex" | "Crossref";
  abstract?: string;
};

function cleanQuery(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

function reconstructOpenAlexAbstract(index?: Record<string, number[]> | null) {
  if (!index) return undefined;
  const positions: Array<[number, string]> = [];
  for (const [word, indexes] of Object.entries(index)) for (const i of indexes) positions.push([i, word]);
  return positions.sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(" ").slice(0, 12_000) || undefined;
}

export async function discoverAcademicSources(query: string, limit = 8): Promise<AcademicSourceCandidate[]> {
  const q = cleanQuery(query);
  if (q.length < 12) return [];
  const perProvider = Math.max(2, Math.min(10, limit));
  const results: AcademicSourceCandidate[] = [];

  const [openAlex, crossref] = await Promise.allSettled([
    fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${perProvider}`, { headers: { "User-Agent": "MabrigScholar/1.0 academic-integrity-source-discovery" }, cache: "no-store" }),
    fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=${perProvider}&select=DOI,title,URL,published,abstract`, { headers: { "User-Agent": "MabrigScholar/1.0 (academic source discovery)" }, cache: "no-store" }),
  ]);

  if (openAlex.status === "fulfilled" && openAlex.value.ok) {
    const data = await openAlex.value.json() as { results?: Array<{id?:string;display_name?:string;doi?:string;publication_year?:number;abstract_inverted_index?:Record<string,number[]>;primary_location?:{landing_page_url?:string}}> };
    for (const item of data.results || []) if (item.display_name) results.push({ id:item.id || `openalex-${results.length}`, title:item.display_name, url:item.primary_location?.landing_page_url || item.doi, doi:item.doi?.replace(/^https?:\/\/doi.org\//i,""), year:item.publication_year, provider:"OpenAlex", abstract:reconstructOpenAlexAbstract(item.abstract_inverted_index) });
  }

  if (crossref.status === "fulfilled" && crossref.value.ok) {
    const data = await crossref.value.json() as { message?: { items?: Array<{DOI?:string;title?:string[];URL?:string;abstract?:string;published?:{"date-parts"?:number[][]}}> } };
    for (const item of data.message?.items || []) if (item.title?.[0]) results.push({ id:`crossref:${item.DOI || results.length}`, title:item.title[0], url:item.URL, doi:item.DOI, year:item.published?.["date-parts"]?.[0]?.[0], provider:"Crossref", abstract:item.abstract?.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,12_000) });
  }

  const seen = new Set<string>();
  return results.filter(item => { const key=(item.doi || item.title).toLowerCase(); if(seen.has(key)) return false; seen.add(key); return true; }).slice(0, limit * 2);
}
