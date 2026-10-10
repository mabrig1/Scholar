export type VerificationStatus = "verified" | "unverified" | "warning";
export interface JournalCheck { title?: string; issn?: string; website?: string; publisher?: string }
export interface ArticleCheck { doi?: string; title?: string }
export interface Evidence { source: string; url: string; detail: string; checkedAt: string }
export interface VerificationResult { status: VerificationStatus; checks: string[]; warnings: string[]; evidence: Evidence[]; journal: JournalCheck; article?: ArticleCheck; articleIndexedInScopus: "unverified"; scopusJournalCoverage: "unverified" }
const now = () => new Date().toISOString();
export function isISSN(value: string): boolean {
 const compact=value.replace(/-/g,"").toUpperCase();
 if(!/^\d{7}[\dX]$/.test(compact)) return false;
 const sum=[...compact].reduce((acc,c,i)=>acc+(c==="X"?10:Number(c))*(8-i),0);
 return sum%11===0;
}
export async function verifyJournal(journal:JournalCheck,article?:ArticleCheck):Promise<VerificationResult>{
 const checks:string[]=[],warnings:string[]=[],evidence:Evidence[]=[];
 if(journal.issn){if(isISSN(journal.issn)) checks.push("ISSN checksum valid; registration and ownership not independently verified");else warnings.push("Invalid ISSN checksum");}
 if(journal.website){try{const u=new URL(journal.website);if(u.protocol!=="https:") warnings.push("Journal website is not HTTPS");}catch{warnings.push("Invalid journal website URL");}}
 if(article?.doi){
 const doi=article.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i,"");
 if(!/^10\.\d{4,9}\/\S+$/i.test(doi)){warnings.push("Invalid DOI format");}
 else{
  try{
   const res=await fetch("https://api.crossref.org/works/"+encodeURIComponent(doi),{signal:AbortSignal.timeout(7000),headers:{"User-Agent":"Scholar-JournalGuard/1.0 (research verification)"}});
   if(res.ok){const data=await res.json();const m=data.message;checks.push("DOI found in Crossref; this does not prove Scopus indexing");evidence.push({source:"Crossref",url:"https://doi.org/"+doi,detail:"Registered title: "+(m.title?.[0]||"unknown")+"; publisher: "+(m.publisher||"unknown"),checkedAt:now()});if(journal.title&&m["container-title"]?.[0]&&!m["container-title"][0].toLowerCase().includes(journal.title.toLowerCase()))warnings.push("DOI container title differs from supplied journal title");}
   else warnings.push("DOI not found in Crossref; it may be registered with another DOI agency");
  }catch{warnings.push("Crossref lookup unavailable; no conclusion drawn");}
 }
 }
 warnings.push("Scopus journal coverage requires authoritative Scopus source-list verification");
 if(article) warnings.push("Article-level Scopus indexing requires an authoritative document record");
 if(journal.website)warnings.push("Website ownership and publisher authorization have not been independently established");
 return {status:warnings.some(x=>x.startsWith("Invalid"))?"warning":"unverified",checks,warnings,evidence,journal,article,articleIndexedInScopus:"unverified",scopusJournalCoverage:"unverified"};
}
