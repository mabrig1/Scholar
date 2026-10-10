import {metadataIssues,type PublicationMetadata} from "./indexing-assistant";
export type SitemapEntry={url:string;lastModified?:string};
const xml=(v:string)=>v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
export function buildSitemap(entries:SitemapEntry[],origin:string){
 const site=new URL(origin);if(site.protocol!=="https:")throw Error("HTTPS site origin required");
 if(entries.length>50000)throw Error("Sitemap exceeds 50,000 URL limit");
 const unique=new Set<string>();const items=entries.map(entry=>{const u=new URL(entry.url);if(u.protocol!=="https:"||u.origin!==site.origin||u.username||u.password||u.hash)throw Error("Sitemap URL must be HTTPS and same-origin");if(unique.has(u.href))return "";unique.add(u.href);if(entry.lastModified&&(!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastModified)||Number.isNaN(Date.parse(entry.lastModified))))throw Error("Invalid lastmod");return "<url><loc>"+xml(u.href)+"</loc>"+(entry.lastModified?"<lastmod>"+xml(entry.lastModified)+"</lastmod>":"")+"</url>";}).join("");
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+items+"</urlset>";
}
export function auditMetadata(m:PublicationMetadata){const issues=metadataIssues(m);if(!m.doi)issues.push("DOI not supplied: confirm whether a DOI was registered by an authorized agency");if(!m.pdfUrl)issues.push("No public PDF URL supplied; ensure full text is discoverable when permitted");return {readyForManualReview:issues.length===0,issues,googleSearch:"not_verified" as const,googleScholar:"not_verified" as const};}
