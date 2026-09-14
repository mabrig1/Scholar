"use client";

import { useMemo, useState } from "react";
import { assessScopusLecturerReadiness, type ScopusLecturerInput } from "@/lib/lecturer-indexing-studios";
import styles from "../indexing-studios.module.css";

const initial: ScopusLecturerInput = {
  hasScopusProfile:false,
  profileHasCorrectName:false,
  profileHasCorrectAffiliation:false,
  duplicateProfilesResolved:false,
  missingIndexedDocumentsResolved:false,
  orcidConnected:false,
  targetJournalCurrentlyCovered:false,
  targetJournalScopeFit:false,
  manuscriptHasEnglishTitleAbstract:false,
  ethicsAndResearchIntegrityReady:false,
};

const labels: Array<[keyof ScopusLecturerInput,string,string]> = [
  ["hasScopusProfile","Scopus Author Profile found","Search the lecturer by name, affiliation and ORCID."],
  ["profileHasCorrectName","Preferred name is correct","The profile consistently represents the lecturer's publishing name."],
  ["profileHasCorrectAffiliation","Primary affiliation is correct","Current institutional affiliation is represented correctly."],
  ["duplicateProfilesResolved","Duplicate profiles resolved","No known duplicate Scopus Author IDs remain fragmented."],
  ["missingIndexedDocumentsResolved","Missing indexed papers reviewed","Known Scopus-indexed publications are attached to the right author record."],
  ["orcidConnected","ORCID identity aligned","ORCID, publishing name and affiliation are consistent."],
  ["targetJournalCurrentlyCovered","Target journal currently covered","The intended journal has been checked in the live Scopus Sources list."],
  ["targetJournalScopeFit","Strong journal scope fit","The manuscript matches the journal's current aims and recent content."],
  ["manuscriptHasEnglishTitleAbstract","Publication-ready English title/abstract","Title, abstract and keywords support international discovery."],
  ["ethicsAndResearchIntegrityReady","Ethics/integrity package ready","Authorship, ethics, conflicts, data and citation checks are complete."],
];

export default function ScopusStudioClient(){
  const [input,setInput]=useState(initial);
  const [saved,setSaved]=useState(false);
  const result=useMemo(()=>assessScopusLecturerReadiness(input),[input]);

  function toggle(field:keyof ScopusLecturerInput){setInput(v=>({...v,[field]:!v[field]}));setSaved(false)}
  function save(){localStorage.setItem("mabrig_scopus_lecturer_studio",JSON.stringify({input,score:result.score,savedAt:new Date().toISOString()}));setSaved(true)}
  function reset(){setInput(initial);setSaved(false)}

  return <main className={styles.page}><div className={styles.shell}>
    <section className={styles.hero}>
      <div className={styles.heroMain}><span className={styles.eyebrow}>LECTURER PUBLICATION STUDIO</span><h1>Scopus Visibility & Publication Studio</h1><p>Help lecturers move from “I want Scopus indexing” to the actions that actually matter: verify covered journals, protect journal fit, correct author-profile fragmentation, align ORCID and prepare a submission that meets research-integrity expectations.</p><div className={styles.notice}>Scopus indexes content from selected sources and then builds author profiles from that indexed content. An author cannot manually force an ordinary paper into Scopus.</div></div>
      <aside className={styles.heroAside}><strong>What this studio coordinates</strong><span>Scopus Author Profile cleanup</span><span>Duplicate profile merging</span><span>Missing indexed documents</span><span>Covered-journal verification</span><span>Publication-readiness handoff</span></aside>
    </section>
    <section className={styles.grid}>
      <article className={styles.panel}><span className={styles.eyebrow}>SCOPUS READINESS CHECK</span><h2>Assess the lecturer and target manuscript</h2><div className={styles.checks}>{labels.map(([field,label,help])=><label className={styles.checkRow} key={field}><input type="checkbox" checked={input[field]} onChange={()=>toggle(field)}/><span><strong>{label}</strong><small>{help}</small></span></label>)}</div><div className={styles.actions}><button className={styles.primary} onClick={save}>Save lecturer assessment</button><button className={styles.secondary} onClick={reset}>Reset</button></div>{saved&&<div className={styles.saved}>Assessment saved on this device.</div>}</article>
      <article className={styles.result}><div className={styles.scoreWrap}><div><span className={styles.eyebrow}>SCOPUS READINESS</span><div className={styles.score}>{result.score}</div></div><div className={styles.scoreMeta}>/100<br/>{result.band.replace("-"," ")}</div></div><div className={styles.bar}><span style={{width:`${result.score}%`}}/></div><div className={styles.summary}>{result.label}</div><h3>Priority actions</h3><ol className={styles.priority}>{result.priorityActions.length?result.priorityActions.map(x=><li key={x}>{x}</li>):<li>No major readiness gaps remain. Re-verify the journal's current Scopus coverage immediately before submission.</li>}</ol><div className={styles.resultChecks}>{result.checks.map(c=><div key={c.id} className={`${styles.resultCheck} ${c.complete?styles.pass:styles.fail}`}><strong>{c.complete?"✓":"○"} {c.label}</strong><small>{c.evidence}</small></div>)}</div><div className={styles.links}>{result.nextLinks.map(link=><a href={link.url} key={link.url} target={link.url.startsWith("http")?"_blank":undefined} rel={link.url.startsWith("http")?"noreferrer":undefined}>{link.label}<span>→</span></a>)}</div><div className={styles.footerNote}>{result.notice}</div></article>
    </section>
  </div></main>
}