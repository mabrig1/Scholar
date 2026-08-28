import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminSession } from "@/lib/admin-auth";
import { generateWithAiFallback } from "@/lib/ai-provider";

export const runtime = "nodejs";

function cleanDoi(value: string) {
  return value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").trim();
}

export async function POST(request: NextRequest) {
  if (!requestHasAdminSession(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const clientName = String(body.clientName ?? "").trim();
    const title = String(body.title ?? "").trim();
    const abstract = String(body.abstract ?? "").trim();
    const keywords = String(body.keywords ?? "").trim();
    const journal = String(body.journal ?? "").trim();
    const doi = cleanDoi(String(body.doi ?? ""));
    const articleUrl = String(body.articleUrl ?? "").trim();
    const orcid = String(body.orcid ?? "").trim();
    const affiliation = String(body.affiliation ?? "").trim();

    if (!clientName || !title || abstract.length < 80) {
      return NextResponse.json({ error: "Provide the client name, article title and an abstract of at least 80 characters." }, { status: 400 });
    }

    const doiUrl = doi ? `https://doi.org/${doi}` : "";
    const canonical = articleUrl || doiUrl;
    const exactTitleQuery = `\"${title}\"`;
    const authorQuery = `${clientName} ${title.split(/\s+/).slice(0, 6).join(" ")}`;

    const prompt = `You are the post-publication research visibility strategist inside an ethical academic publishing-support business. Build a premium visibility pack that helps a legitimate scholarly article become easier to discover and understand. Do not promise citations, Google Scholar inclusion, rankings, media attention, or academic impact. Do not fabricate DOI, journal, indexing, authorship, findings or institutional facts. Use only the supplied article information.\n\nAUTHOR/CLIENT\nName: ${clientName}\nAffiliation: ${affiliation || "Not supplied"}\nORCID: ${orcid || "Not supplied"}\n\nARTICLE\nTitle: ${title}\nJournal: ${journal || "Not supplied"}\nDOI: ${doi || "Not supplied"}\nCanonical URL: ${canonical || "Not supplied"}\nExisting keywords: ${keywords || "Not supplied"}\nAbstract: ${abstract}\n\nProduce these sections:\n1. Research Visibility Positioning — a 2-3 sentence accurate description of why the work matters, without exaggeration.\n2. Discoverability Keywords — 10-15 topic phrases grounded in the supplied title/abstract.\n3. Plain-Language Summary — 120-180 words for non-specialist readers, preserving uncertainty.\n4. Institutional/Repository Metadata Pack — recommended title, author form, affiliation, abstract, keywords, DOI, canonical URL and rights/publisher-policy fields that must be verified.\n5. ORCID Update Checklist — exact fields to confirm when adding the work to ORCID; do not claim the app can write to ORCID.\n6. Google Scholar Monitoring Plan — exact-title and author/title searches, version/canonical checks, and troubleshooting steps without guaranteed timing.\n7. Ethical Promotion Copy — one LinkedIn post, one X/short social post, one WhatsApp/department announcement, all factual and non-spammy.\n8. 30-Day Dissemination Plan — weekly actions using legitimate scholarly/institutional channels; include repository deposit only where copyright/self-archiving policy permits.\n9. Citation Hygiene — provide a clean citation-data checklist, not a fabricated formatted citation style unless all required bibliographic fields are supplied.\n10. Metrics to Monitor — legitimate indicators such as repository downloads, article views when available, citations over time, Altmetric-like mentions if available, and profile consistency; state that metrics can be incomplete.\n\nMake this commercially useful as a publisher deliverable while maintaining scholarly integrity.`;

    const ai = await generateWithAiFallback(prompt);
    const fallback = [
      `RESEARCH VISIBILITY PACK — ${clientName}`,
      `Article: ${title}`,
      "",
      "CORE DISCOVERABILITY RECORD",
      `Author: ${clientName}`,
      `Affiliation: ${affiliation || "Verify with client"}`,
      `ORCID: ${orcid || "Capture/verify ORCID"}`,
      `Journal: ${journal || "Verify publication venue"}`,
      `DOI: ${doi || "Not supplied"}`,
      `Canonical URL: ${canonical || "Not supplied"}`,
      `Keywords: ${keywords || "Derive controlled topic keywords from the final article"}`,
      "",
      "GOOGLE SCHOLAR MONITORING",
      `Exact title: ${exactTitleQuery}`,
      `Author/title: ${authorQuery}`,
      canonical ? `Check the canonical record: ${canonical}` : "Capture the permanent publisher/DOI URL before monitoring.",
      "",
      "30-DAY CORE ACTIONS",
      "Week 1: normalize author name/affiliation/ORCID and verify DOI/canonical article metadata.",
      "Week 2: deposit an eligible manuscript in an appropriate institutional repository only if publisher policy permits.",
      "Week 3: update institutional profile and share a factual plain-language summary through professional channels.",
      "Week 4: run exact-title/author Scholar checks, verify canonical version grouping, and document any metadata/crawl issues.",
      "",
      "No AI provider returned a complete pack. The deterministic metadata and monitoring workflow above remains usable.",
    ].join("\n");

    return NextResponse.json({
      pack: ai?.text || fallback,
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
      generatedAt: new Date().toISOString(),
      metadata: { clientName, title, journal, doi, doiUrl, articleUrl, canonical, orcid, affiliation, keywords, exactTitleQuery, authorQuery },
      notice: "Visibility optimization improves the quality and consistency of legitimate scholarly records. It cannot guarantee Google Scholar inclusion, citations, rankings, downloads, acceptance, or academic impact.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Visibility pack generation failed." }, { status: 500 });
  }
}
