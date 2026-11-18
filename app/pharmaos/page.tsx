"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RESEARCH_WORKSPACE_STORAGE_KEY,
  normalizeResearchWorkspace,
} from "@/lib/research-workspace";

type Handoff = {
  schemaVersion: "discovery-1.0";
  researchOnly: true;
  clinicalUse: false;
  source: { name: string; sha256: string; type: string };
  compounds: Array<{ name: string; mentions: number; pubchem?: { cid: number; sourceUrl: string } | null }>;
  agents: Array<{ id: number; status: string }>;
  summary: {
    candidatesMentioned: number;
    executedAgentTasks: number;
    molecularDockingPerformed: false;
    admetPredictionPerformed: false;
  };
};

function validImport(value: unknown): value is Handoff {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  const src = d.source as Record<string, unknown> | undefined;
  const summary = d.summary as Record<string, unknown> | undefined;
  return d.schemaVersion === "discovery-1.0" && d.researchOnly === true &&
    d.clinicalUse === false && !!src && typeof src.name === "string" &&
    src.name.length <= 150 && typeof src.sha256 === "string" &&
    /^[a-f0-9]{64}$/i.test(src.sha256) &&
    !!summary && summary.molecularDockingPerformed === false &&
    summary.admetPredictionPerformed === false &&
    Array.isArray(d.compounds) && d.compounds.length <= 50 &&
    d.compounds.every((c) => c && typeof c.name === "string" && c.name.length <= 80) &&
    Array.isArray(d.agents) && d.agents.length <= 50;
}

export default function PharmaOSScholarHandoff() {
  const [data, setData] = useState<Handoff | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [abstract, setAbstract] = useState("");

  async function importFile(file?: File) {
    setError(""); setSaved(false); setData(null);
    if (!file) return;
    try {
      if (file.size > 300_000) throw new Error("Use a PharmaOS report JSON smaller than 300 KB.");
      const parsed: unknown = JSON.parse(await file.text());
      if (!validImport(parsed)) throw new Error("This is not a supported research-only PharmaOS discovery report.");
      setData(parsed);
      setArticleTitle(parsed.source.name.replace(/\.(docx|txt|md|csv|json)$/i, "").replaceAll("_", " ").slice(0, 150));
      setAbstract("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import the PharmaOS report.");
    }
  }

  function preparePublishingWorkspace() {
    if (!data) return;
    if (articleTitle.trim().length < 12) {
      setError("Enter the actual manuscript title (at least 12 characters)."); return;
    }
    try {
      const names = [...new Set(data.compounds.map((c) => c.name.trim()).filter(Boolean))].slice(0, 6);
      const workspace = normalizeResearchWorkspace({
        title: articleTitle,
        field: "Pharmaceutical Sciences",
        articleType: "Original research article",
        studyStage: "draft",
        abstract,
        keywords: names.join(", "),
        target: "verified",
        institution: "",
        budget: "zero",
        updatedAt: new Date().toISOString(),
      });
      // Explicit, browser-local handoff. Never copy the underlying manuscript or raw patient data.
      window.localStorage.setItem(RESEARCH_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
      setSaved(true); setError("");
    } catch {
      setError("Browser-local saving is unavailable. Check your storage settings.");
    }
  }

  return <main style={{maxWidth:980,margin:"auto",padding:"28px 18px",fontFamily:"system-ui",lineHeight:1.55}}>
    <nav style={{display:"flex",flexWrap:"wrap",gap:18,fontSize:14}}>
      <Link href="/">Scholar home</Link><a href="https://nchesent.mabrigkorie.org/pharmaos">PharmaOS research hub</a>
      <Link href="/research-agent">Evidence research agent</Link><Link href="/publishing-agent">Publishing agent</Link>
    </nav>
    <header style={{borderRadius:20,background:"#123c37",color:"white",padding:"30px",marginTop:22}}>
      <p style={{fontSize:12,letterSpacing:2,fontWeight:700}}>MABRIG PHARMAOS × SCHOLAR</p>
      <h1 style={{fontSize:36,lineHeight:1.2,margin:"10px 0"}}>Publish your computational research responsibly</h1>
      <p>Import a NcheSent PharmaOS report, check which scientific steps actually ran, then prepare an evidence-based article for the MABRIG Scholar Research Agent and Publishing Agent.</p>
    </header>

    <section style={{padding:24,background:"#f1f8f5",borderRadius:18,marginTop:20}}>
      <h2>1. Import research report</h2>
      <p>NcheSent exports a portable JSON with chemical source links, reproducibility information and clear limitations. Import happens in this browser, without automatic server transfer.</p>
      <input type="file" accept=".json,application/json" onChange={(e) => void importFile(e.target.files?.[0])} aria-label="Import PharmaOS report" />
      {error && <p role="alert" style={{color:"#9c372a"}}>{error}</p>}
    </section>
    {data && <>
      <section style={{marginTop:20,padding:24,border:"1px solid #c8dbd2",borderRadius:18}}>
        <h2>2. Check the evidence before publishing</h2>
        <p><strong>Source:</strong> {data.source.name}</p>
        <p><strong>Source fingerprint:</strong> <span style={{overflowWrap:"anywhere",fontSize:12}}>{data.source.sha256}</span></p>
        <p><strong>Compounds mentioned:</strong> {data.compounds.length}</p>
        <p><strong>Executed research tasks:</strong> {data.agents.filter((a) => a.status === "completed").length} of {data.agents.length} defined roles.</p>
        <p><strong>Docking:</strong> Not performed. <strong>ADMET prediction:</strong> Not performed.</p>
        <h3>Extracted research candidates</h3>
        <ul>{data.compounds.map((compound, index) => <li key={index}>{compound.name} — {compound.pubchem && Number.isInteger(compound.pubchem.cid)
          ? <a target="_blank" rel="noreferrer" href={"https://pubchem.ncbi.nlm.nih.gov/compound/" + compound.pubchem.cid}>PubChem CID {compound.pubchem.cid}</a>
          : "identity not verified"}</li>)}</ul>
        <p>Scientific evidence remains subject to source verification and human review. Import does not constitute publication, peer review, DOI registration or Scopus indexing.</p>
      </section>
      <section style={{marginTop:20,padding:24,background:"#f1f8f5",borderRadius:18}}>
        <h2>3. Prepare article workspace</h2>
        <label htmlFor="article-title">Actual manuscript title</label>
        <input id="article-title" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} style={{display:"block",padding:12,width:"100%",maxWidth:700,margin:"8px 0 18px"}} />
        <label htmlFor="article-abstract">Your evidence-based abstract (write actual findings; no invention)</label>
        <textarea id="article-abstract" value={abstract} onChange={(e) => setAbstract(e.target.value.slice(0,12000))}
          rows={6} style={{display:"block",padding:12,width:"100%",maxWidth:700,margin:"8px 0 18px"}} />
        <button type="button" onClick={preparePublishingWorkspace} style={{padding:"12px 18px",background:"#075e4c",color:"white",border:0,borderRadius:10}}>
          Save browser-local Scholar workspace
        </button>
        {saved && <div role="status" style={{marginTop:14}}>
          <p>Research metadata saved in this browser for Scholar. Source files were not transferred.</p>
          <p><Link href="/research-agent">Continue to DOI evidence verification</Link> · <Link href="/publishing-agent">Prepare publication pathway</Link></p>
        </div>}
      </section>
    </>}
    <footer style={{padding:"28px 0",color:"#456",fontSize:13}}>MABRIG PharmaOS Research Network · No drug discovery or publication claims are automatically verified by this handoff.</footer>
  </main>;
}
