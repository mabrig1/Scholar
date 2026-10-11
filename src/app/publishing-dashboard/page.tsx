import Link from "next/link";

const tools = [
  {title:"Journal discovery",href:"/publication-gateway",status:"Available",description:"Find candidate journals, inspect author guidelines, and verify indexing and fees with the publisher."},
  {title:"Submission preparation",href:"/submission-workspace",status:"Available",description:"Complete authorship, ethics, indexing and fee checks; copy an author-controlled submission checklist."},
  {title:"Journal integrity",href:"/journalguard",status:"Available",description:"Review journal credibility before submitting or paying any fees."},
  {title:"DOI and indexing assistant",href:"/doi-indexing",status:"Check availability",description:"Prepare metadata and DOI/indexing workflows. A DOI requires an authorized registration agency."},
  {title:"Publication sitemap",href:"/indexing-sitemap",status:"Check availability",description:"Prepare discovery metadata and sitemaps for sites you control."},
  {title:"Google Search Console",href:"/search-console",status:"Integration pending",description:"OAuth authorization and server-side user sessions are required before sitemap submission can be enabled."}
];
export default function PublishingDashboard(){
 return <main style={{maxWidth:1100,margin:"0 auto",padding:"32px 20px",fontFamily:"system-ui"}}>
 <header><p style={{letterSpacing:2,textTransform:"uppercase",fontSize:12}}>Scholar research platform</p><h1>Article Publishing Dashboard</h1><p>One workspace for journal discovery, manuscript readiness, publication integrity and indexing preparation.</p></header>
 <section style={{background:"#eef4ff",color:"#13294b",borderRadius:12,padding:20,margin:"24px 0"}}><h2 style={{marginTop:0}}>Publication status</h2><p><strong>Preparation tools available.</strong> Direct journal submission, DOI registration, Google indexing and automatic publication are not enabled by this dashboard. Publication decisions belong to journals and publishers.</p><Link href="/submission-workspace">Start manuscript preparation →</Link></section>
 <section aria-label="Publishing tools" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16}}>
 {tools.map(t=><article key={t.href} style={{border:"1px solid #d8dee9",borderRadius:12,padding:20}}><p style={{fontSize:12,fontWeight:700,color:"#385c91"}}>{t.status}</p><h2 style={{fontSize:20}}>{t.title}</h2><p>{t.description}</p><Link href={t.href}>Open tool →</Link></article>)}
 </section>
 <section style={{marginTop:32}}><h2>Recommended publication pathway</h2><ol><li>Verify manuscript originality, research ethics and all co-author approvals.</li><li>Match the journal and verify its current scope, indexing, APCs and waiver rules.</li><li>Prepare the manuscript, declarations, cover letter and required supporting files.</li><li>Submit through the journal’s official editorial system with explicit author authorization.</li><li>Record the journal’s submission ID and monitor editorial decisions.</li><li>After legitimate publication, prepare metadata, DOI links and discoverability checks.</li></ol><p>Never interpret a prepared checklist or sitemap as evidence of acceptance, DOI assignment or publication.</p></section>
 </main>;
}
