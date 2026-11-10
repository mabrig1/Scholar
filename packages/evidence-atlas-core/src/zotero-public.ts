/**
 * Public Zotero library preview adapter.
 * Strictly metadata-only and read-only. No keys, credentials, full-text or attachments.
 */
export type ZoteroPublicRequest = { libraryType: "users" | "groups"; libraryId: string; collectionKey?: string };
export type ZoteroPublicItem = {
  key: string;
  doi: string;
  title: string;
  creators: string[];
  date: string;
  itemType: string;
  zoteroUrl: string;
};
const types = new Set(["journalArticle", "conferencePaper", "report", "preprint", "bookSection", "thesis"]);
function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
export function normalizeZoteroDoi(value: unknown): string {
  const input = cleanText(value, 260).replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/[\s.,;]+$/g, "").toLowerCase();
  return /^10\.\d{4,9}\/[^\s?#<>]+$/i.test(input) ? input : "";
}
export function parseZoteroPublicRequest(params: URLSearchParams): ZoteroPublicRequest {
  const type = params.get("type");
  const id = params.get("id") || "";
  const collection = params.get("collection") || "";
  if (type !== "users" && type !== "groups") throw new Error("Select a public user or group library.");
  if (!/^[1-9]\d{0,11}$/.test(id)) throw new Error("Enter the numeric Zotero library ID, not a username.");
  if (collection && !/^[A-Z0-9]{8}$/.test(collection)) throw new Error("Collection key must have eight uppercase letters or digits.");
  return { libraryType: type, libraryId: id, ...(collection ? { collectionKey: collection } : {}) };
}
export function zoteroPublicItemsUrl(request: ZoteroPublicRequest): string {
  const base = new URL("https://api.zotero.org");
  const prefix = "/" + request.libraryType + "/" + request.libraryId;
  base.pathname = request.collectionKey
    ? prefix + "/collections/" + request.collectionKey + "/items/top"
    : prefix + "/items/top";
  base.searchParams.set("format", "json");
  base.searchParams.set("limit", "20");
  base.searchParams.set("start", "0");
  return base.toString();
}
export function parseZoteroPublicItems(raw: unknown): { items: ZoteroPublicItem[]; skipped: number } {
  if (!Array.isArray(raw)) throw new Error("Unexpected Zotero metadata response.");
  const items: ZoteroPublicItem[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const entry of raw.slice(0, 20)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { skipped++; continue; }
    const wrapper = entry as Record<string, unknown>;
    const data = wrapper.data && typeof wrapper.data === "object" && !Array.isArray(wrapper.data)
      ? wrapper.data as Record<string, unknown> : {};
    const key = cleanText(wrapper.key, 12);
    const title = cleanText(data.title, 400);
    const doi = normalizeZoteroDoi(data.DOI);
    const type = cleanText(data.itemType, 45);
    if (!/^[A-Z0-9]{8}$/.test(key) || !doi || !title || !types.has(type) || seen.has(doi)) { skipped++; continue; }
    seen.add(doi);
    const creators = Array.isArray(data.creators)
      ? data.creators.slice(0, 25).map((x) => {
        if (!x || typeof x !== "object" || Array.isArray(x)) return "";
        const record = x as Record<string, unknown>;
        return cleanText(record.name || [record.firstName, record.lastName].filter(Boolean).join(" "), 120);
      }).filter(Boolean)
      : [];
    const links = wrapper.links && typeof wrapper.links === "object" && !Array.isArray(wrapper.links) ? wrapper.links as Record<string, unknown> : {};
    const alt = links.alternate && typeof links.alternate === "object" && !Array.isArray(links.alternate) ? links.alternate as Record<string, unknown> : {};
    const candidate = cleanText(alt.href, 500);
    let zoteroUrl = "";
    try {
      const source = new URL(candidate);
      if (source.protocol === "https:" && source.hostname === "www.zotero.org") zoteroUrl = source.toString();
    } catch {
      // Missing or malformed source link: never invent a Zotero item URL.
    }
    items.push({
      key, doi, title, creators, date: cleanText(data.date, 60), itemType: type, zoteroUrl,
    });
  }
  return { items, skipped };
}
