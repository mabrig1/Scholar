"use client";

import { useMemo, useState } from "react";
import { assessGoogleScholarReadiness, type GoogleScholarInput } from "@/lib/lecturer-indexing-studios";
import styles from "../indexing-studios.module.css";

const initial: GoogleScholarInput = {
  publicProfile:false,
  institutionalEmailVerified:false,
  articleLandingPage:false,
  freeAbstractVisible:false,
  searchablePdf:false,
  oneArticlePerUrl:false,
  scholarMetaTags:false,
  robotsAllowed:false,
  titleAndAuthorsVisible:false,
  referencesPresent:false,
};

const labels: Array<[keyof GoogleScholarInput,string,string]> = [
  ["publicProfile","Public Google Scholar profile","The lecturer's Scholar profile is public."],
  ["institutionalEmailVerified","Verified institutional email","A university/institution email is verified on the profile."],
  ["articleLandingPage","Dedicated public article page","Published papers have crawlable HTML landing pages."],
  ["freeAbstractVisible","Complete abstract visible without login","Readers and crawlers can see the author-written abstract immediately."],
  ["searchablePdf","Searchable PDF","The full paper is text-searchable rather than image-only."],
  ["oneArticlePerUrl","One paper per URL","Each scholarly work has its own unique article URL."],
  ["scholarMetaTags","Scholar/Highwire metadata","citation_title, citation_author and related machine-readable tags are present."],
  ["robotsAllowed","Googlebot allowed","robots.txt/meta rules do not block the article pages or PDFs."],
  ["titleAndAuthorsVisible","Clear title and author placement","Title is prominent and authors appear directly below it."],
  ["referencesPresent","References/Bibliography section","The paper ends with a conventional references section."],
];

export default function GoogleScholarStudioClient(){
  const [input,setInput]=useState(initial);
  const [saved,setSaved]=useState(false);
  const result=useMemo(()=>assessGoogleScholarReadiness(input),[input]);

  function toggle(field:keyof GoogleScholarInput){setInput(v=>({...v,[field]:!v[field]}));setSaved(false)}
  function save(){localStorage.setItem("mabrig_google_scholar_studio",JSON.stringify({input,score:result.score,savedAt:new Date().toISOString()}));setSaved(true)}
  function reset(){setInput(initial);setSaved(false)}

  return <main className={styles.page}><div className={styles.shell}>
    <section className={styles.hero}>
      <div className={styles.heroMain}><span className={styles.eyebrow}>LECTURER VISIBILITY STUDIO</span><h1>Google Scholar Indexing & Visibility Studio</h1><p>Turn a lecturer's profile, article pages and repository presence into a concrete indexing-readiness plan. The studio focuses on the technical signals Google Scholar actually uses: public profile eligibility, crawlability, visible abstracts, searchable PDFs and scholarly metadata.</p><div className={styles.notice}>Google Scholar decides inclusion and timing. This studio improves eligibility and discoverability; it does not promise indexing.</div></div>
      <aside className={styles.heroAside}><strong>What this studio helps lecturers fix</strong><span>Author profile visibility</span><span>Institutional email verification</span><span>Repository/article crawlability</span><span>Highwire/Scholar metadata</span><span>PDF and reference structure</span></aside>
    </section>
    <section className={styles.grid}>
      <article className={styles.panel}><span className={styles.eyebrow}>READINESS CHECK</span><h2>Mark what is already true</h2><div className={styles.checks}>{labels.map(([field,label,help])=><label className={styles.checkRow} key={field}><input type="checkbox" checked={input[field]} onChange={()=>toggle(field)}/><span><strong>{label}</strong><small>{help}</small></span></label>)}</div><div className={styles.actions}><button className={styles.primary} onClick={save}>Save lecturer assessment</button><button className={styles.secondary} onClick={reset}>Reset</button></div>{saved&&<div className={styles.saved}>Assessment saved on this device.</div>}</article>
      <article className={styles.result}><div className={styles.scoreWrap}><div><span className={styles.eyebrow}>INDEXING READINESS</span><div className={styles.score}>{result.score}</div></div><div className={styles.scoreMeta}>/100<br/>{result.band.replace("-"," ")}</div></div><div className={styles.bar}><span style={{width:`${result.score}%`}}/></div><div className={styles.summary}>{result.label}</div><h3>Priority actions</h3><ol className={styles.priority}>{result.priorityActions.length?result.priorityActions.map(x=><li key={x}>{x}</li>):<li>No major readiness gaps remain. Run the live compatibility auditor on representative article pages.</li>}</ol><div className={styles.resultChecks}>{result.checks.map(c=><div key={c.id} className={`${styles.resultCheck} ${c.complete?styles.pass:styles.fail}`}><strong>{c.complete?"✓":"○"} {c.label}</strong><small>{c.evidence}</small></div>)}</div><div className={styles.links}>{result.nextLinks.map(link=><a href={link.url} key={link.url} target={link.url.startsWith("http")?"_blank":undefined} rel={link.url.startsWith("http")?"noreferrer":undefined}>{link.label}<span>→</span></a>)}</div><div className={styles.footerNote}>{result.notice}</div></article>
    </section>
  </div></main>
}