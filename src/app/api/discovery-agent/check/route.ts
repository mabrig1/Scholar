import {NextRequest,NextResponse} from "next/server";
import {inspectPublicationHtml,validatePublicUrl} from "../../../../lib/discovery-agent";
import {checkDOIAgency} from "../../../../lib/journalguard-v2";
export const runtime="nodejs";
export async function POST(req:NextRequest){try{const body=await req.json();const url=body?.url,doi=body?.doi;if(typeof url!=="string"||url.length>1500)return NextResponse.json({error:"Public HTTPS article URL required"},{status:400});const parsed=validatePublicUrl(url);if(typeof doi!=="undefined"&&(typeof doi!=="string"||doi.length>300))return NextResponse.json({error:"Invalid DOI"},{status:400});
 // Never fetch arbitrary supplied URLs server-side: prevents DNS-rebinding/SSRF.
 // Metadata extraction requires a trusted fetch proxy with redirect and DNS protections.
 const registration=doi?await checkDOIAgency(doi):null;
 return NextResponse.json({url:parsed.toString(),registration,discovery:{status:"requires_trusted_fetch",googleSearch:"not_verified",googleScholar:"not_verified"},recommendations:["Use Google Search Console URL Inspection for an owned domain","Ensure public HTML includes citation_title, citation_author, citation_publication_date and citation_pdf_url","Provide an accessible article landing page and PDF","Submit XML sitemap through Google Search Console","Check Google Scholar inclusion manually; there is no guaranteed indexing API"],note:"No DOI minted or Google indexing requested. Automated page inspection is disabled until a trusted fetch service is configured."},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid request"},{status:400});}}
