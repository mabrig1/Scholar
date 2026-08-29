"use client";

import { useState } from "react";

type Report = { overallSimilarity:number; matchedWords:number; totalWords:number; excludedQuotedWords:number; excludedBibliographyWords:number; matches:Array<{sourceTitle:string;sourceUrl?:string;submittedText:string;sourceText:string;score:number;kind:string}>; limitations:string[] };

export default function PlagiarismCheckerPage() {
  const [text,setText]=useState(""); const [sources,setSources]=useState(""); const [report,setReport]=useState<Report|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function run(){ setBusy(true);setError("");setReport(null); try { const parsed=sources.split(/\n---SOURCE---\n/i).map((block,i)=>{const lines=block.trim().split("\n");return {id:String(i+1),title:(lines.shift()||`Reference ${i+1}`).replace(/^TITLE:\s*/i,""),text:lines.join("\n")}}).filter(s=>s.text.length>=50); const res=await fetch("/api/plagiarism-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,sources:parsed})}); const data=await res.json(); if(!res.ok) throw new Error(data.error||"Check failed");setReport(data);} catch(e){setError(e instanceof Error?e.message:"Check failed")} finally{setBusy(false)} }
  return <main style={{maxWidth:1100,margin:"0 auto",padding:"32px 20px"}}>
    <h1>Scholar Similarity & Plagiarism Checker</h1>
    <p>Independent academic-integrity screening for copied, near-copied and lightly paraphrased passages. It produces source-attributed evidence rather than an unsupported “plagiarism” verdict.</p>
    <div style={{padding:14,border:"1px solid #ddd",borderRadius:12,margin:"18px 0"}}><strong>Important:</strong> This is not Turnitin and cannot access Turnitin’s private student-paper/publisher database. Similarity coverage grows as you add institutional papers, theses, articles and permitted web/academic sources to Scholar’s corpus.</div>
    <label><strong>Document to check</strong></label><textarea value={text} onChange={e=>setText(e.target.value)} rows={14} style={{width:"100%",margin:"8px 0 18px",padding:12}} placeholder="Paste thesis, assignment or article text…" />
    <label><strong>Reference corpus</strong></label><p style={{fontSize:14}}>Paste each source as a title followed by its text. Separate sources with a line containing <code>---SOURCE---</code>.</p><textarea value={sources} onChange={e=>setSources(e.target.value)} rows={12} style={{width:"100%",margin:"8px 0 18px",padding:12}} placeholder={'TITLE: Source one\nSource text…\n---SOURCE---\nTITLE: Source two\nSource text…'} />
    <button onClick={run} disabled={busy} style={{padding:"12px 20px",fontWeight:700}}>{busy?"Checking…":"Run Similarity Check"}</button>{error&&<p style={{fontWeight:700}}>{error}</p>}
    {report&&<section style={{marginTop:30}}><h2>Similarity report: {report.overallSimilarity}%</h2><p>{report.matchedWords.toLocaleString()} of {report.totalWords.toLocaleString()} assessed words matched. Excluded: {report.excludedQuotedWords} quoted words and {report.excludedBibliographyWords} bibliography words.</p><h3>Matched passages</h3>{report.matches.length===0?<p>No evidence-backed matches were found in the supplied corpus.</p>:report.matches.slice(0,100).map((m,i)=><article key={i} style={{padding:14,border:"1px solid #ddd",borderRadius:10,margin:"10px 0"}}><strong>{m.score}% · {m.kind} · {m.sourceTitle}</strong><p><b>Submission:</b> {m.submittedText}</p><p><b>Source:</b> {m.sourceText}</p></article>)}<h3>Limits</h3><ul>{report.limitations.map(x=><li key={x}>{x}</li>)}</ul></section>}
  </main>
}
