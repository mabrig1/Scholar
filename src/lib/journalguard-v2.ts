import { verifyJournal, type JournalCheck, type ArticleCheck } from "./journalguard";
type AgencyEvidence={agency:"Crossref"|"DataCite"|"Unknown";registered:boolean;title?:string;publisher?:string;url?:string;warnings:string[]};
const norm=(s:string)=>s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
function doiValue(raw:string){return raw.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"");}
export async function checkDOIAgency(raw:string):Promise<AgencyEvidence>{
 const doi=doiValue(raw);
 if(!/^10\.\d{4,9}\/\S+$/i.test(doi))return {agency:"Unknown",registered:false,warnings:["Invalid DOI syntax"]};
 const url="https://api.datacite.org/dois/"+encodeURIComponent(doi);
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(6500),headers:{"Accept":"application/vnd.api+json"}});
  if(r.status===404)return {agency:"Unknown",registered:false,warnings:["Not registered in DataCite; check Crossref or other DOI agencies"]};
  if(!r.ok)return {agency:"Unknown",registered:false,warnings:["DataCite lookup unavailable"]};
  const json=await r.json();const a=json?.data?.attributes;
  if(!a)return {agency:"Unknown",registered:false,warnings:["Unexpected DataCite response"]};
  const title=a.titles?.[0]?.title||"";
  return {agency:"DataCite",registered:true,title,publisher:a.publisher||"",url:"https://doi.org/"+doi,warnings:[]};
 }catch{return {agency:"Unknown",registered:false,warnings:["DataCite lookup timed out or failed"]};}
}
export async function verifyJournalV2(journal:JournalCheck,article?:ArticleCheck){
 const base=await verifyJournal(journal,article);
 if(!article?.doi)return {...base,doiAgency:null,identityWarnings:[]};
 const agency=await checkDOIAgency(article.doi);
 const identityWarnings:string[]=[];
 if(agency.registered){
  base.checks.push("DOI metadata registered with "+agency.agency+"; indexing and peer review are NOT implied");
  base.evidence.push({source:agency.agency,url:agency.url!,detail:"Registered title: "+(agency.title||"unknown")+"; publisher: "+(agency.publisher||"unknown"),checkedAt:new Date().toISOString()});
  if(article.title&&agency.title&&norm(article.title)!==norm(agency.title))identityWarnings.push("Supplied article title differs from registered DOI title; manually review possible punctuation or version differences");
  if(journal.publisher&&agency.publisher&&norm(journal.publisher)!==norm(agency.publisher))identityWarnings.push("Journal publisher differs from DOI metadata publisher; repository DOI deposits can legitimately have different publishers");
 }
 base.warnings.push(...agency.warnings,...identityWarnings);
 if(identityWarnings.length)base.status="warning";
 return {...base,doiAgency:agency,identityWarnings};
}
