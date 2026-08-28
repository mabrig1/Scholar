"use client";

import { FormEvent, useState } from "react";
import styles from "../high-impact/high-impact.module.css";

type Dimension={id:string;label:string;score:number;maxScore:number;status:"strong"|"developing"|"critical";actions:string[]};
type Result={baseline:{score:number;verdict:string;dimensions:Dimension[]};relatedWorks:{id:string;title:string;year:number|null;citedByCount:number;journal:string|null;doi:string|null}[];autopilotReport:string|null;aiProvider:string|null;aiModel:string|null;fallbackActions?:string[];generatedAt:string};

const blank={clientName:"",title:"",field:"",articleType:"Original research article",abstract:"",manuscriptText:"",targetGoal:"Selective reputable journal"};

export default function AutopilotClient(){
  const [form,setForm]=useState(blank);const [result,setResult]=useState<Result|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  async function run(e:FormEvent){e.preventDefault();setLoading(true);setError("");setResult(null);try{const r=await fetch("/api/admin/high-impact-autopilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const data=await r.json();if(!r.ok)throw new Error(data.error||"Autopilot failed.");setResult(data);}catch(err){setError(err instanceof Error?err.message:"Autopilot failed.");}finally{setLoading(false)}}
  const report=result?.autopilotReport||result?.fallbackActions?.join("\n")||"";
  function download(){if(!report)return;const blob=new Blob([report],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${form.clientName||"client"}-high-impact-autopilot.txt`.replace(/[^a-z0-9._-]+/gi,"-");a.click();URL.revokeObjectURL(url)}
  return <main className={styles.page}>
    <section className={styles.hero}><div><div className={styles.eyebrow}>HIGH-IMPACT AUTOPILOT</div><h1>Paste the manuscript. Let the publisher engine map the upgrade.</h1><p>Designed for busy lecturers: one intake creates an editor simulation, methods/statistics review, peer-review simulation, novelty map, title/abstract upgrade, journal ladder, cover-letter pitch and seven-day revision sprint.</p></div><div className={styles.heroBadge}>Effortless premium workflow</div></section>
    <div className={styles.grid}>
      <form className={styles.card} onSubmit={run}>
        <div className={styles.sectionTitle}>Minimum-input client intake</div>
        <label><span>Lecturer / client name *</span><input required value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})}/></label>
        <label><span>Manuscript title *</span><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
        <div className={styles.two}><label><span>Field</span><input value={form.field} onChange={e=>setForm({...form,field:e.target.value})} placeholder="e.g. Economics, Public Health"/></label><label><span>Article type</span><select value={form.articleType} onChange={e=>setForm({...form,articleType:e.target.value})}><option>Original research article</option><option>Systematic review</option><option>Review article</option><option>Case study</option><option>Short communication</option></select></label></div>
        <label><span>Target ambition</span><select value={form.targetGoal} onChange={e=>setForm({...form,targetGoal:e.target.value})}><option>Selective reputable journal</option><option>High-impact journal where realistically competitive</option><option>Strong international indexed journal</option><option>Best zero/low-APC reputable option</option></select></label>
        <label><span>Abstract *</span><textarea required value={form.abstract} onChange={e=>setForm({...form,abstract:e.target.value})} placeholder="Paste the complete abstract (80+ characters)."/></label>
        <label><span>Full manuscript or key sections</span><textarea className={styles.large} value={form.manuscriptText} onChange={e=>setForm({...form,manuscriptText:e.target.value})} placeholder="Paste introduction, methods, results, discussion and references where available. More text produces a stronger review."/></label>
        <button className={styles.primary} disabled={loading}>{loading?"Running editor + reviewer simulations…":"Run High-Impact Autopilot"}</button>{error&&<div className={styles.error}>{error}</div>}
        <div className={styles.notice}>Researcher Pro improves competitiveness; it does not invent results or guarantee acceptance, impact factor, quartile, Scopus/WoS status or publication.</div>
      </form>
      <section className={styles.result}>{!result?<div className={styles.empty}><div><strong>One-click upgrade strategy appears here</strong><p>Use this before the detailed accelerator when the lecturer has only a manuscript and wants the publisher to diagnose everything else.</p></div></div>:<>
        <div className={styles.scoreHead}><div className={styles.score}>{result.baseline.score}</div><div><div className={styles.eyebrow}>BASELINE READINESS</div><h2>{result.baseline.verdict}</h2><p>{result.aiProvider?`${result.aiProvider} / ${result.aiModel}`:"Structured fallback"} · {new Date(result.generatedAt).toLocaleString()}</p></div></div><div className={styles.progress}><span style={{width:`${result.baseline.score}%`}}/></div>
        <div className={styles.actions}><button onClick={()=>navigator.clipboard.writeText(report)}>Copy full plan</button><button onClick={download}>Download plan</button><button onClick={()=>location.href="/admin/high-impact"}>Open Detailed Accelerator</button></div>
        <div className={styles.sectionTitle}>Immediate readiness map</div><div className={styles.dimensions}>{result.baseline.dimensions.map(d=><article key={d.id} className={`${styles.dimension} ${styles[d.status]}`}><strong>{d.label} — {d.score}/{d.maxScore}</strong><span>{d.status}</span><ul>{d.actions.slice(0,2).map(a=><li key={a}>{a}</li>)}</ul></article>)}</div>
        <div className={styles.sectionTitle}>Related scholarly signals</div>{result.relatedWorks.slice(0,6).map(w=><div className={styles.work} key={w.id}><strong>{w.title}</strong><span>{w.year||"year unknown"} · {w.journal||"source unknown"} · {w.citedByCount} OpenAlex citations</span></div>)}
        <div className={styles.sectionTitle}>Autopilot publisher plan</div><pre className={styles.ai}>{report||"No AI provider returned a report. Use the readiness actions above and retry from System Health."}</pre>
      </>}</section>
    </div>
  </main>
}
