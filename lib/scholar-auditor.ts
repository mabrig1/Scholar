import { lookup } from "dns/promises";
import { isIP } from "net";

export type AuditStatus = "pass" | "warn" | "fail";

export type ScholarAuditCheck = {
  id: string;
  label: string;
  status: AuditStatus;
  points: number;
  maxPoints: number;
  evidence: string;
  fix?: string;
};

export type ScholarAuditResult = {
  clientName: string;
  requestedUrl: string;
  finalUrl: string;
  auditedAt: string;
  httpStatus: number;
  contentType: string;
  score: number;
  grade: "strong" | "good" | "needs-work" | "poor";
  compatibilityLabel: string;
  guaranteeNotice: string;
  detected: {
    title: string | null;
    authors: string[];
    publicationDate: string | null;
    journalTitle: string | null;
    issn: string | null;
    volume: string | null;
    issue: string | null;
    firstPage: string | null;
    lastPage: string | null;
    doi: string | null;
    canonicalUrl: string | null;
    pdfUrl: string | null;
    abstractSource: string | null;
    robotsMeta: string | null;
    robotsTxt: string;
  };
  checks: ScholarAuditCheck[];
  priorityFixes: string[];
  suggestedMetaTags: string;
  manualChecks: string[];
};

const MAX_HTML_BYTES = 2_000_000;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "MabrigResearcherPro-ScholarAuditor/1.0";

function ipv4ToNumber(ip: string) {
  return ip.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function inIpv4Range(ip: string, start: string, end: string) {
  const value = ipv4ToNumber(ip);
  return value >= ipv4ToNumber(start) && value <= ipv4ToNumber(end);
}

function isBlockedIp(address: string) {
  const version = isIP(address);
  if (version === 4) {
    return (
      inIpv4Range(address, "0.0.0.0", "0.255.255.255") ||
      inIpv4Range(address, "10.0.0.0", "10.255.255.255") ||
      inIpv4Range(address, "100.64.0.0", "100.127.255.255") ||
      inIpv4Range(address, "127.0.0.0", "127.255.255.255") ||
      inIpv4Range(address, "169.254.0.0", "169.254.255.255") ||
      inIpv4Range(address, "172.16.0.0", "172.31.255.255") ||
      inIpv4Range(address, "192.0.0.0", "192.0.0.255") ||
      inIpv4Range(address, "192.168.0.0", "192.168.255.255") ||
      inIpv4Range(address, "198.18.0.0", "198.19.255.255") ||
      inIpv4Range(address, "224.0.0.0", "255.255.255.255")
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff")
    );
  }
  return true;
}

async function validatePublicUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid public article URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP/HTTPS article URLs are supported.");
  if (url.username || url.password) throw new Error("URLs containing embedded credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Only standard HTTP/HTTPS ports are allowed.");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("Private or internal network addresses are not allowed.");
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("Private or reserved IP addresses are not allowed.");
  } else {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length || addresses.some((item) => isBlockedIp(item.address))) {
      throw new Error("The supplied hostname resolves to a private or reserved network address.");
    }
  }

  return url;
}

async function safeFetch(rawUrl: string, init: RequestInit = {}, redirects = 0): Promise<{ response: Response; finalUrl: URL }> {
  if (redirects > 4) throw new Error("Too many redirects while auditing the article URL.");
  const url = await validatePublicUrl(rawUrl);
  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) return { response, finalUrl: url };
    const nextUrl = new URL(location, url).toString();
    return safeFetch(nextUrl, init, redirects + 1);
  }
  return { response, finalUrl: url };
}

async function readTextLimited(response: Response, maxBytes = MAX_HTML_BYTES) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Article HTML exceeds the ${Math.round(maxBytes / 1_000_000)} MB audit limit.`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const regex = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return attrs;
}

function extractMeta(html: string) {
  const map = new Map<string, string[]>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.name || attrs.property || attrs["http-equiv"] || "").toLowerCase();
    const value = attrs.content || "";
    if (!key || !value) continue;
    map.set(key, [...(map.get(key) ?? []), value]);
  }
  return map;
}

function firstMeta(meta: Map<string, string[]>, keys: string[]) {
  for (const key of keys) {
    const value = meta.get(key.toLowerCase())?.find(Boolean);
    if (value) return value;
  }
  return null;
}

function allMeta(meta: Map<string, string[]>, keys: string[]) {
  for (const key of keys) {
    const values = meta.get(key.toLowerCase())?.filter(Boolean);
    if (values?.length) return values;
  }
  return [];
}

function extractLink(html: string, rel: string) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const rels = (attrs.rel || "").toLowerCase().split(/\s+/);
    if (rels.includes(rel.toLowerCase()) && attrs.href) return attrs.href;
  }
  return null;
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeDoi(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

function absoluteUrl(value: string | null, base: URL) {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function robotsAllows(text: string, pathname: string) {
  if (!text.trim()) return { allowed: true, detail: "No blocking robots.txt rule detected." };
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*$/, "").trim()).filter(Boolean);
  type Group = { agents: string[]; rules: { type: "allow" | "disallow"; path: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let collectingAgents = false;

  for (const line of lines) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key === "user-agent") {
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      collectingAgents = true;
    } else if (key === "allow" || key === "disallow") {
      if (!current) continue;
      current.rules.push({ type: key, path: value });
      collectingAgents = false;
    }
  }

  const googleGroups = groups.filter((group) => group.agents.some((agent) => agent === "googlebot" || agent === "*"));
  const rules = googleGroups.flatMap((group) => group.rules).filter((rule) => rule.path && pathname.startsWith(rule.path));
  if (!rules.length) return { allowed: true, detail: "robots.txt does not block this article path for Googlebot." };
  rules.sort((a, b) => b.path.length - a.path.length);
  const winningRule = rules[0];
  return winningRule.type === "allow"
    ? { allowed: true, detail: `robots.txt explicitly allows ${winningRule.path}.` }
    : { allowed: false, detail: `robots.txt blocks this path via Disallow: ${winningRule.path}.` };
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSuggestedMeta(input: {
  title: string | null;
  authors: string[];
  publicationDate: string | null;
  journalTitle: string | null;
  issn: string | null;
  volume: string | null;
  issue: string | null;
  firstPage: string | null;
  lastPage: string | null;
  doi: string | null;
  pdfUrl: string | null;
}) {
  const tags: string[] = [];
  if (input.title) tags.push(`<meta name="citation_title" content="${escapeHtmlAttribute(input.title)}">`);
  for (const author of input.authors) tags.push(`<meta name="citation_author" content="${escapeHtmlAttribute(author)}">`);
  if (input.publicationDate) tags.push(`<meta name="citation_publication_date" content="${escapeHtmlAttribute(input.publicationDate)}">`);
  if (input.journalTitle) tags.push(`<meta name="citation_journal_title" content="${escapeHtmlAttribute(input.journalTitle)}">`);
  if (input.issn) tags.push(`<meta name="citation_issn" content="${escapeHtmlAttribute(input.issn)}">`);
  if (input.volume) tags.push(`<meta name="citation_volume" content="${escapeHtmlAttribute(input.volume)}">`);
  if (input.issue) tags.push(`<meta name="citation_issue" content="${escapeHtmlAttribute(input.issue)}">`);
  if (input.firstPage) tags.push(`<meta name="citation_firstpage" content="${escapeHtmlAttribute(input.firstPage)}">`);
  if (input.lastPage) tags.push(`<meta name="citation_lastpage" content="${escapeHtmlAttribute(input.lastPage)}">`);
  if (input.doi) tags.push(`<meta name="citation_doi" content="${escapeHtmlAttribute(input.doi)}">`);
  if (input.pdfUrl) tags.push(`<meta name="citation_pdf_url" content="${escapeHtmlAttribute(input.pdfUrl)}">`);
  return tags.join("\n");
}

export async function auditScholarCompatibility(input: {
  clientName?: string;
  articleUrl: string;
  expectedTitle?: string;
  expectedDoi?: string;
}): Promise<ScholarAuditResult> {
  const requestedUrl = input.articleUrl.trim();
  const clientName = input.clientName?.trim() || "Client";
  const { response, finalUrl } = await safeFetch(requestedUrl);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) throw new Error(`Article URL returned HTTP ${response.status}.`);
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("Audit the article landing page (HTML), not a direct PDF. The auditor checks page metadata and links to the full text.");
  }

  const html = await readTextLimited(response);
  const meta = extractMeta(html);
  const visibleText = stripHtml(html);

  const title = firstMeta(meta, ["citation_title", "bepress_citation_title", "prism.title", "dc.title"]);
  const authors = allMeta(meta, ["citation_author", "bepress_citation_author", "prism.creator", "dc.creator"]);
  const publicationDate = firstMeta(meta, ["citation_publication_date", "bepress_citation_date", "prism.publicationdate", "dc.issued"]);
  const journalTitle = firstMeta(meta, ["citation_journal_title", "bepress_citation_journal_title", "prism.publicationname", "dc.relation.ispartof"]);
  const issn = firstMeta(meta, ["citation_issn", "prism.issn"]);
  const volume = firstMeta(meta, ["citation_volume", "prism.volume", "dc.citation.volume"]);
  const issue = firstMeta(meta, ["citation_issue", "prism.number", "dc.citation.issue"]);
  const firstPage = firstMeta(meta, ["citation_firstpage", "prism.startingpage", "dc.citation.spage"]);
  const lastPage = firstMeta(meta, ["citation_lastpage", "prism.endingpage", "dc.citation.epage"]);
  const doi = firstMeta(meta, ["citation_doi", "prism.doi", "dc.identifier"]);
  const canonicalRaw = extractLink(html, "canonical");
  const canonicalUrl = absoluteUrl(canonicalRaw, finalUrl);
  const citationPdf = firstMeta(meta, ["citation_pdf_url"]);
  const genericPdfMatch = html.match(/href\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/i)?.[1] ?? null;
  const pdfUrl = absoluteUrl(citationPdf || genericPdfMatch, finalUrl);
  const robotsMeta = [...(meta.get("robots") ?? []), ...(meta.get("googlebot") ?? [])].join(", ") || null;
  const abstractMeta = firstMeta(meta, ["citation_abstract", "bepress_citation_abstract", "prism.abstract", "dc.description", "description"]);
  const hasAbstractHeading = /<h[1-6][^>]*>\s*(?:<[^>]+>\s*)*abstract\b/i.test(html) || /\babstract\b/i.test(visibleText.slice(0, 20_000));
  const abstractSource = abstractMeta && abstractMeta.trim().length >= 100
    ? "metadata/description"
    : hasAbstractHeading && visibleText.length >= 500
      ? "visible article page"
      : null;

  let robotsTxt = "Not checked";
  try {
    const robotsUrl = new URL("/robots.txt", finalUrl.origin).toString();
    const robotsFetch = await safeFetch(robotsUrl, { headers: { Accept: "text/plain,*/*;q=0.5" } });
    if (robotsFetch.response.status === 404) robotsTxt = "No robots.txt file (not blocked by robots.txt)";
    else if (robotsFetch.response.ok) {
      const text = await readTextLimited(robotsFetch.response, 250_000);
      const evaluation = robotsAllows(text, finalUrl.pathname);
      robotsTxt = evaluation.detail;
    } else robotsTxt = `robots.txt returned HTTP ${robotsFetch.response.status}`;
  } catch {
    robotsTxt = "robots.txt could not be verified";
  }

  let pdfStatus: { reachable: boolean; contentType: string; size: number | null; status: number | null } = {
    reachable: false,
    contentType: "",
    size: null,
    status: null,
  };
  if (pdfUrl) {
    try {
      let pdfFetch = await safeFetch(pdfUrl, { method: "HEAD", headers: { Accept: "application/pdf,*/*;q=0.5" } });
      if ([405, 501].includes(pdfFetch.response.status)) {
        pdfFetch = await safeFetch(pdfUrl, { headers: { Range: "bytes=0-2047", Accept: "application/pdf,*/*;q=0.5" } });
      }
      const length = Number(pdfFetch.response.headers.get("content-length"));
      pdfStatus = {
        reachable: pdfFetch.response.ok || pdfFetch.response.status === 206,
        contentType: pdfFetch.response.headers.get("content-type") || "",
        size: Number.isFinite(length) && length > 0 ? length : null,
        status: pdfFetch.response.status,
      };
      try { await pdfFetch.response.body?.cancel(); } catch { /* no-op */ }
    } catch {
      // Keep the PDF check as unreachable/unknown.
    }
  }

  const checks: ScholarAuditCheck[] = [];
  const add = (check: ScholarAuditCheck) => checks.push(check);

  add({ id: "http", label: "Article page availability", status: "pass", points: 8, maxPoints: 8, evidence: `HTTP ${response.status}; final URL ${finalUrl.toString()}` });
  add({ id: "html", label: "Scholar-supported HTML landing page", status: "pass", points: 5, maxPoints: 5, evidence: `Content-Type: ${contentType}` });

  if (!title) {
    add({ id: "title", label: "Machine-readable article title", status: "fail", points: 0, maxPoints: 12, evidence: "No supported article-title meta tag found.", fix: "Add citation_title (preferred) with the article title only." });
  } else if (input.expectedTitle && normalizeComparable(title) !== normalizeComparable(input.expectedTitle)) {
    add({ id: "title", label: "Machine-readable article title", status: "warn", points: 6, maxPoints: 12, evidence: `Detected “${title}”, which differs from the expected title.`, fix: "Make citation_title exactly match the authoritative article title and DOI metadata." });
  } else {
    add({ id: "title", label: "Machine-readable article title", status: "pass", points: 12, maxPoints: 12, evidence: title });
  }

  add(authors.length
    ? { id: "authors", label: "Machine-readable author metadata", status: "pass", points: 12, maxPoints: 12, evidence: `${authors.length} author tag(s): ${authors.slice(0, 4).join("; ")}${authors.length > 4 ? "…" : ""}` }
    : { id: "authors", label: "Machine-readable author metadata", status: "fail", points: 0, maxPoints: 12, evidence: "No supported author meta tags found.", fix: "Add one citation_author meta tag for each actual paper author, without affiliations or degrees." });

  add(publicationDate
    ? { id: "date", label: "Publication date metadata", status: "pass", points: 10, maxPoints: 10, evidence: publicationDate }
    : { id: "date", label: "Publication date metadata", status: "fail", points: 0, maxPoints: 10, evidence: "No supported publication-date meta tag found.", fix: "Add citation_publication_date using the date normally cited for the article." });

  const venuePieces = [journalTitle, volume, issue, firstPage].filter(Boolean);
  add(venuePieces.length >= 2
    ? { id: "venue", label: "Journal citation metadata", status: "pass", points: 6, maxPoints: 6, evidence: venuePieces.join(" · ") }
    : journalTitle
      ? { id: "venue", label: "Journal citation metadata", status: "warn", points: 3, maxPoints: 6, evidence: `Journal title found (${journalTitle}) but volume/issue/page or equivalent metadata is incomplete.`, fix: "Add citation_volume, citation_issue and citation_firstpage/article identifier where applicable." }
      : { id: "venue", label: "Journal citation metadata", status: "fail", points: 0, maxPoints: 6, evidence: "Journal/conference title metadata was not detected.", fix: "Add citation_journal_title (or citation_conference_title) and the applicable citation fields." });

  const expectedDoi = input.expectedDoi ? normalizeDoi(input.expectedDoi) : "";
  const detectedDoi = doi ? normalizeDoi(doi) : "";
  add(detectedDoi
    ? expectedDoi && detectedDoi !== expectedDoi
      ? { id: "doi", label: "DOI metadata consistency", status: "warn", points: 2, maxPoints: 6, evidence: `Detected DOI ${doi}; expected ${input.expectedDoi}.`, fix: "Align the DOI on the article page, Crossref record, PDF and repository versions." }
      : { id: "doi", label: "DOI metadata consistency", status: "pass", points: 6, maxPoints: 6, evidence: doi || detectedDoi }
    : { id: "doi", label: "DOI metadata consistency", status: "warn", points: 0, maxPoints: 6, evidence: "No DOI meta value was detected.", fix: "If the article has a DOI, expose it in page metadata and keep it identical across all scholarly records." });

  add(canonicalUrl
    ? { id: "canonical", label: "Canonical article URL", status: "pass", points: 6, maxPoints: 6, evidence: canonicalUrl }
    : { id: "canonical", label: "Canonical article URL", status: "warn", points: 0, maxPoints: 6, evidence: "No rel=canonical link was detected.", fix: "Add one canonical URL for the authoritative article landing page." });

  add(abstractSource
    ? { id: "abstract", label: "Freely visible complete abstract/full-text signal", status: "pass", points: 10, maxPoints: 10, evidence: `Abstract evidence detected from ${abstractSource}.` }
    : { id: "abstract", label: "Freely visible complete abstract/full-text signal", status: "fail", points: 0, maxPoints: 10, evidence: "A complete, clearly visible abstract could not be confirmed automatically.", fix: "Show the complete author-written abstract directly on the article URL without login, buttons, interstitials or hidden content." });

  add(citationPdf
    ? { id: "pdf-link", label: "Full-text PDF linked with citation_pdf_url", status: "pass", points: 7, maxPoints: 7, evidence: pdfUrl || citationPdf }
    : genericPdfMatch
      ? { id: "pdf-link", label: "Full-text PDF linked with citation_pdf_url", status: "warn", points: 4, maxPoints: 7, evidence: `A PDF link was found (${pdfUrl}) but citation_pdf_url is missing.`, fix: "Add citation_pdf_url on the article landing page so Scholar can associate the PDF with its bibliographic metadata." }
      : { id: "pdf-link", label: "Full-text PDF linked with citation_pdf_url", status: "warn", points: 0, maxPoints: 7, evidence: "No article PDF link was detected.", fix: "Where a legally accessible PDF exists, link it with citation_pdf_url from the article page." });

  const noIndex = /\bnoindex\b|\bnone\b/i.test(robotsMeta || "");
  add(noIndex
    ? { id: "robots-meta", label: "Page-level crawler permission", status: "fail", points: 0, maxPoints: 5, evidence: `Robots meta: ${robotsMeta}`, fix: "Remove noindex/none from the scholarly article page if it is intended for public indexing." }
    : { id: "robots-meta", label: "Page-level crawler permission", status: "pass", points: 5, maxPoints: 5, evidence: robotsMeta ? `Robots meta: ${robotsMeta}` : "No page-level noindex directive detected." });

  const robotsBlocked = /blocks this path/i.test(robotsTxt);
  const robotsUnknown = /could not|HTTP/i.test(robotsTxt);
  add(robotsBlocked
    ? { id: "robots-txt", label: "robots.txt crawler permission", status: "fail", points: 0, maxPoints: 5, evidence: robotsTxt, fix: "Allow Googlebot to fetch the article and browse URLs in robots.txt." }
    : robotsUnknown
      ? { id: "robots-txt", label: "robots.txt crawler permission", status: "warn", points: 2, maxPoints: 5, evidence: robotsTxt, fix: "Manually verify that robots.txt does not block Googlebot from the article or browse path." }
      : { id: "robots-txt", label: "robots.txt crawler permission", status: "pass", points: 5, maxPoints: 5, evidence: robotsTxt });

  if (!pdfUrl) {
    add({ id: "pdf", label: "PDF accessibility & Scholar file limit", status: "warn", points: 0, maxPoints: 5, evidence: "No PDF URL available for a live accessibility/size check.", fix: "Provide a searchable PDF where permitted; Google Scholar documents a 5 MB file-size limit for indexed files." });
  } else if (!pdfStatus.reachable) {
    add({ id: "pdf", label: "PDF accessibility & Scholar file limit", status: "fail", points: 0, maxPoints: 5, evidence: `PDF could not be fetched${pdfStatus.status ? ` (HTTP ${pdfStatus.status})` : ""}.`, fix: "Make the PDF publicly fetchable without login or broken redirects." });
  } else if (pdfStatus.size && pdfStatus.size > MAX_PDF_BYTES) {
    add({ id: "pdf", label: "PDF accessibility & Scholar file limit", status: "warn", points: 1, maxPoints: 5, evidence: `PDF is reachable but Content-Length is ${(pdfStatus.size / 1024 / 1024).toFixed(2)} MB.`, fix: "Google Scholar documents a 5 MB limit; provide an eligible smaller scholarly file or appropriate repository route." });
  } else if (!/application\/pdf/i.test(pdfStatus.contentType)) {
    add({ id: "pdf", label: "PDF accessibility & Scholar file limit", status: "warn", points: 3, maxPoints: 5, evidence: `PDF URL is reachable but reports Content-Type ${pdfStatus.contentType || "unknown"}.`, fix: "Serve the PDF with a correct application/pdf Content-Type and verify that its text is searchable." });
  } else {
    add({ id: "pdf", label: "PDF accessibility & Scholar file limit", status: "pass", points: 5, maxPoints: 5, evidence: `PDF reachable${pdfStatus.size ? `; ${(pdfStatus.size / 1024 / 1024).toFixed(2)} MB` : ""}. Searchable text still requires a manual check.` });
  }

  const citationTitleCount = meta.get("citation_title")?.length ?? 0;
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  add(citationTitleCount === 1
    ? { id: "isolation", label: "One article per scholarly landing page", status: "pass", points: 3, maxPoints: 3, evidence: "One citation_title was detected on this URL." }
    : citationTitleCount > 1
      ? { id: "isolation", label: "One article per scholarly landing page", status: "fail", points: 0, maxPoints: 3, evidence: `${citationTitleCount} citation_title tags were detected.`, fix: "Give each article/abstract its own unique URL with one bibliographic record." }
      : { id: "isolation", label: "One article per scholarly landing page", status: h1Count === 1 ? "warn" : "fail", points: h1Count === 1 ? 1 : 0, maxPoints: 3, evidence: citationTitleCount === 0 ? "No citation_title was present to confirm a single scholarly record." : "Article isolation could not be confirmed.", fix: "Use one article per URL and expose exactly one authoritative citation_title." });

  const score = Math.max(0, Math.min(100, checks.reduce((sum, check) => sum + check.points, 0)));
  const grade: ScholarAuditResult["grade"] = score >= 85 ? "strong" : score >= 70 ? "good" : score >= 50 ? "needs-work" : "poor";
  const priorityFixes = checks
    .filter((check) => check.status !== "pass" && check.fix)
    .sort((a, b) => (a.status === b.status ? b.maxPoints - a.maxPoints : a.status === "fail" ? -1 : 1))
    .map((check) => check.fix as string)
    .filter((value, index, array) => array.indexOf(value) === index);

  return {
    clientName,
    requestedUrl,
    finalUrl: finalUrl.toString(),
    auditedAt: new Date().toISOString(),
    httpStatus: response.status,
    contentType,
    score,
    grade,
    compatibilityLabel: score >= 85 ? "Strong Scholar technical compatibility" : score >= 70 ? "Good foundation with fixes required" : score >= 50 ? "Material compatibility work required" : "High risk of Scholar parsing/crawl problems",
    guaranteeNotice: "This is a technical compatibility audit, not proof of Google Scholar indexing. Google controls inclusion, refresh timing, version grouping and ranking through automated systems.",
    detected: {
      title,
      authors,
      publicationDate,
      journalTitle,
      issn,
      volume,
      issue,
      firstPage,
      lastPage,
      doi,
      canonicalUrl,
      pdfUrl,
      abstractSource,
      robotsMeta,
      robotsTxt,
    },
    checks,
    priorityFixes,
    suggestedMetaTags: buildSuggestedMeta({ title: title || input.expectedTitle?.trim() || null, authors, publicationDate, journalTitle, issn, volume, issue, firstPage, lastPage, doi: doi || input.expectedDoi?.trim() || null, pdfUrl }),
    manualChecks: [
      "Open the article while signed out and confirm the complete author-written abstract is visible without clicking, accepting a disclaimer or dismissing an interstitial.",
      "Open the PDF in a PDF reader and verify that words can be selected/searched; this cannot be established reliably from HTTP metadata alone.",
      "Confirm the title is the largest prominent text near the top of the PDF and the authors appear directly below/near it.",
      "Confirm the PDF has a clearly labelled References or Bibliography section when applicable.",
      "Search Google Scholar by the exact article title to check actual inclusion; do not use this compatibility score as an indexing guarantee.",
      "Verify copyright/self-archiving rights before placing a publisher PDF or accepted manuscript in an external repository.",
    ],
  };
}
