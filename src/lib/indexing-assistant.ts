export type PublicationMetadata={title:string;authors:string[];publicationDate:string;journal:string;doi?:string;pdfUrl?:string;landingUrl:string;issn?:string};
const esc=(v:string)=>v.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export function citationMetaTags(m:PublicationMetadata){
 const fields:[string,string|undefined][]=[["citation_title",m.title],...m.authors.map(a=>["citation_author",a] as [string,string]),["citation_publication_date",m.publicationDate],["citation_journal_title",m.journal],["citation_doi",m.doi],["citation_pdf_url",m.pdfUrl],["citation_issn",m.issn]];
 return fields.filter(([,v])=>Boolean(v)).map(([k,v])=>'<meta name="'+k+'" content="'+esc(v!)+'">').join("\n");
}
export function metadataIssues(m:PublicationMetadata){const issues:string[]=[];if(!m.title.trim())issues.push("Article title required");if(!m.authors.length||m.authors.some(a=>!a.trim()))issues.push("At least one valid author required");if(!/^\d{4}-\d{2}-\d{2}$/.test(m.publicationDate))issues.push("Use publication date YYYY-MM-DD");if(!m.journal.trim())issues.push("Journal name required");if(!/^https:\/\//.test(m.landingUrl))issues.push("Public HTTPS landing page required");if(m.pdfUrl&&!/^https:\/\//.test(m.pdfUrl))issues.push("PDF URL must be HTTPS");return issues;}
export function indexingSteps(m:PublicationMetadata){return [
"Confirm publisher or repository authorization before depositing metadata or registering a DOI",
"Register DOI through an authorized Crossref/DataCite member or sponsoring repository, if eligible",
"Publish a stable public landing page with accurate bibliographic metadata",
"Include Google Scholar Highwire citation meta tags in server-rendered HTML",
"Provide a readable article abstract and accessible PDF where rights permit",
"Check robots directives and canonical URLs; avoid noindex",
"Add the article to an XML sitemap on an owned website",
"Verify site ownership in Google Search Console and submit sitemap",
"Use Search Console URL Inspection to request indexing for an eligible owned URL",
"Check Google Scholar separately after discovery; no inclusion guarantee"
];}
