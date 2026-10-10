import {verifyJournalV2} from "./journalguard-v2";
import type {JournalCheck,ArticleCheck} from "./journalguard";
export type ProvenanceFinding={code:string;severity:"info"|"review";message:string;source?:string};
const domain=(s:string)=>{try{const u=new URL(s);return u.hostname.toLowerCase().replace(/^www\./,"");}catch{return null;}};
export function assessPublisherProvenance(journal:JournalCheck, trustedPublisherDomains:string[]=[]):ProvenanceFinding[]{
 const out:ProvenanceFinding[]=[];
 const host=journal.website?domain(journal.website):null;
 if(journal.website&&!host)out.push({code:"INVALID_DOMAIN",severity:"review",message:"Journal URL is invalid"});
 if(host&&trustedPublisherDomains.length){
  const allowed=trustedPublisherDomains.some(d=>host===d.toLowerCase()||host.endsWith("."+d.toLowerCase()));
  if(!allowed)out.push({code:"DOMAIN_MISMATCH",severity:"review",message:"Journal website is not on the independently supplied publisher-domain allowlist. Authorization must be confirmed."});
 }else if(host)out.push({code:"OWNERSHIP_UNVERIFIED",severity:"info",message:"Publisher-domain authorization has not been independently verified"});
 if(journal.issn&&journal.website)out.push({code:"ISSN_NOT_OWNERSHIP",severity:"info",message:"An ISSN does not prove that this website is authorized by the journal publisher"});
 return out;
}
export async function verifyJournalV3(journal:JournalCheck,article?:ArticleCheck,domains:string[]=[]){
 const base=await verifyJournalV2(journal,article);
 const provenance=assessPublisherProvenance(journal,domains);
 base.warnings.push(...provenance.filter(x=>x.severity==="review").map(x=>x.message));
 return {...base,provenance,scopusVerification:{journal:"unverified",article:"unverified",reason:"Requires authoritative Scopus source/document records; no indexing assertion is made."},checkedAt:new Date().toISOString()};
}
