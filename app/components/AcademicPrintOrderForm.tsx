"use client";

import { FormEvent, useEffect, useState } from "react";

const MAX_PAGES = 100;
const MAX_FILE_BYTES = 4_000_000;
const MAX_PASTED_CHARS = 500_000;

const services = [
  "Academic Document Printing",
  "Assignment & Term-Paper Support",
  "Article Rewriter & Humanizer",
  "UNN Undergraduate Project Formatting",
  "Project & Thesis Formatting",
  "Research Assistance",
  "Data Analysis Assistance",
  "Printing & Binding",
];

const locations = ["Nkrumah", "Franco", "Bello", "Okpara", "Mariere", "Balewa", "Eni Njoku", "Hilltop", "Odim", "Zik's Flat"];

export default function AcademicPrintOrderForm({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState("");
  const [printOption, setPrintOption] = useState("DIGITAL_AND_PRINT");
  const [pages, setPages] = useState(1);
  const [transformationMode, setTransformationMode] = useState("format");
  const [referralCode, setReferralCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (params.get("ref") || "").trim().slice(0, 64);
    const saved = window.sessionStorage.getItem("mabrig_referral_code") || "";
    const code = fromUrl || saved;
    if (code) {
      setReferralCode(code);
      window.sessionStorage.setItem("mabrig_referral_code", code);
    }
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    setSubmitting(true);
    setMessage("Submitting and preparing your document for conversion...");
    const form = new FormData(formElement);
    const uploadedFile = form.get("file");
    if (uploadedFile instanceof File && uploadedFile.size > MAX_FILE_BYTES) {
      setSubmitting(false);
      setMessage("Upload must be 4MB or smaller. Compress the file, split large attachments, or paste the text instead.");
      return;
    }
    const submittedWhatsapp = String(form.get("whatsapp") || "").trim();
    const response = await fetch("/api/orders/v2", { method: "POST", body: form });
    const data = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setMessage(data.error || "Unable to create your order.");
      return;
    }

    const conversionMessage = data.conversionReady
      ? " Your text is ready for Word formatting by the print shop."
      : data.conversionWarning
        ? ` ${data.conversionWarning}`
        : "";
    setMessage(`Order ${data.orderId} created. Quotation: ₦${Number(data.quotedAmount).toLocaleString()}.${conversionMessage} We will continue with you on WhatsApp.`);
    const submittedOrder = { orderNumber: String(data.orderId), whatsapp: submittedWhatsapp };
    window.localStorage.setItem("mabrig_latest_order", JSON.stringify(submittedOrder));
    window.dispatchEvent(new CustomEvent("mabrig-order-submitted", { detail: submittedOrder }));
    formElement.reset();
    setPrintOption("DIGITAL_AND_PRINT");
    setPages(1);
    setTransformationMode("format");
  }

  const humanizeMode = transformationMode === "rewrite-assignment";

  return <div className={compact ? "" : "card"}>
    {!compact && <>
      <span className="badge">Up to 100 pages • 4MB maximum upload</span>
      <h2>Academic Document Printing, Rewriting & Word Conversion</h2>
      <p>Upload your work or paste it directly. We can rewrite and humanize articles, clean text, apply academic formatting, generate a Word document and prepare it for printing.</p>
    </>}

    <form onSubmit={submit}>
      <div className="form-grid">
        <label className="field"><span>Name</span><input name="name" required placeholder="Your name" /></label>
        <label className="field"><span>WhatsApp number</span><input name="whatsapp" required inputMode="tel" placeholder="080..." /></label>

        <label className="field full"><span>Document title / assignment topic</span><input name="documentTitle" required={transformationMode === "write-assignment"} maxLength={200} placeholder="e.g. The Impact of E-Governance on Service Delivery" /></label>

        <label className="field"><span>Document / service</span>
          <select name="service" defaultValue="Academic Document Printing" required>
            {services.map(service => <option key={service}>{service}</option>)}
          </select>
        </label>

        <label className="field"><span>Preferred output</span>
          <select name="requestedFormat" defaultValue="DOCX">
            <option value="DOCX">Microsoft Word (.docx)</option>
            <option value="PDF">PDF</option>
            <option value="PPTX">PowerPoint</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label className="field"><span>Number of pages (max {MAX_PAGES})</span><input name="pages" type="number" min="1" max={MAX_PAGES} value={pages} onChange={e => setPages(Math.min(MAX_PAGES, Math.max(1, Number(e.target.value) || 1)))} required /></label>
        <label className="field"><span>Copies</span><input name="copies" type="number" min="1" max="100" defaultValue="1" /></label>

        <label className="field"><span>Spacing</span>
          <select name="spacing" defaultValue="2.0"><option value="1.0">1.0 — Single (custom only)</option><option value="1.5">1.5 lines (custom only)</option><option value="2.0">2.0 — Double (UNN preset)</option></select>
        </label>
        <label className="field"><span>Document format</span>
          <select name="formatPreset" defaultValue="unn"><option value="unn">UNN Undergraduate Project format — 2.0 double spacing</option><option value="custom">Custom academic format</option></select>
        </label>
        <label className="field"><span>Font</span>
          <select name="font" defaultValue="Times New Roman"><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Georgia</option></select>
        </label>

        <label className="field"><span>Font size</span><input name="fontSize" type="number" min="8" max="30" defaultValue="12" /></label>
        <label className="field"><span>Text treatment</span>
          <select name="transformationMode" value={transformationMode} onChange={event => setTransformationMode(event.target.value)}>
            <option value="format">Format only — reliable, no AI required</option>
            <option value="proofread">Proofread &amp; improve clarity (AI)</option>
            <option value="write-assignment">Write Assignment from topic &amp; instructions (AI)</option>
            <option value="rewrite-assignment">Article Rewriter &amp; Humanizer — natural rewrite (AI)</option>
          </select>
        </label>
        <label className="field"><span>Body alignment</span>
          <select name="bodyAlignment" defaultValue="justified">
            <option value="justified">Justified (academic)</option>
            <option value="left">Left aligned</option>
          </select>
        </label>
        <label className="field"><span>Paragraph indentation</span>
          <select name="paragraphIndentation" defaultValue="first-line">
            <option value="first-line">First line — 0.5 inch</option>
            <option value="first-line-wide">First line — 1 inch</option>
            <option value="none">No first-line indentation</option>
          </select>
        </label>
        <label className="field"><span>Heading style</span>
          <select name="headingPreset" defaultValue="academic">
            <option value="academic">Classic academic hierarchy</option>
            <option value="apa7">APA 7 heading hierarchy</option>
            <option value="compact">Compact report hierarchy</option>
          </select>
        </label>
        <label className="field"><span>Referencing style</span>
          <select name="referenceStyle" defaultValue="none">
            <option value="none">No prescribed style</option>
            <option value="apa7">APA 7 — References</option>
            <option value="mla9">MLA 9 — Works Cited</option>
          </select>
        </label>
        <label className="field"><span>Page numbers</span>
          <select name="pageNumberPosition" defaultValue="footer-center">
            <option value="footer-center">Footer — centred</option>
            <option value="footer-right">Footer — right</option>
            <option value="header-right">Header — right</option>
            <option value="none">No page numbers</option>
          </select>
        </label>
        <label className="field"><span>Header text (optional)</span><input name="headerText" maxLength={160} placeholder="Short title or department" /></label>
        <label className="field"><span>Footer text (optional)</span><input name="footerText" maxLength={160} placeholder="Student name, course or institution" /></label>
        <label className="field"><span>Production</span>
          <select name="printOption" value={printOption} onChange={e => setPrintOption(e.target.value)}>
            <option value="DIGITAL_ONLY">Word conversion / digital processing only</option>
            <option value="PRINT_ONLY">Print only</option>
            <option value="DIGITAL_AND_PRINT">Format + Word + print</option>
            <option value="DIGITAL_PRINT_DELIVERY">Format + Word + print + campus delivery</option>
          </select>
        </label>

        {printOption !== "DIGITAL_ONLY" && <>
          <label className="field"><span>Print type</span><select name="printType"><option value="BLACK_WHITE">Black & white — ₦30/page</option><option value="COLOUR">Colour — ₦100/page</option></select></label>
          <label className="field"><span>Binding</span><select name="binding"><option value="NONE">No binding</option><option value="SPIRAL">Spiral</option><option value="SOFT">Soft binding</option><option value="HARD">Hard binding</option></select></label>
        </>}

        {printOption === "DIGITAL_PRINT_DELIVERY" && <>
          <label className="field"><span>UNN delivery location</span><select name="deliveryLocation" required><option value="">Choose location</option>{locations.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="field"><span>Delivery note</span><input name="deliveryNote" placeholder="Hostel, block or meeting point" /></label>
        </>}

        <label className="field full"><span>{transformationMode === "write-assignment" ? "Optional source material (max 4MB)" : humanizeMode ? "Upload article or draft to rewrite (max 4MB)" : "Option 1 — Upload for conversion (max 4MB)"}</span><input name="file" type="file" accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" /></label>
        <div className="conversion-upload-note field full">⚡ Uploads are limited to 4MB. Instant text extraction for Word generation is available for pasted text, TXT/Markdown, DOCX and text-based PDFs. Complex layouts, scanned PDFs, PowerPoint and Excel may require manual printer review.</div>

        <div className="upload-divider field full"><span>OR</span></div>

        <label className="field full"><span>{transformationMode === "write-assignment" ? "Optional notes, outline or verified source material" : humanizeMode ? "Paste the article or draft to rewrite and humanize" : "Option 2 — Paste your assignment here"}</span><textarea name="pastedContent" rows={12} maxLength={MAX_PASTED_CHARS} placeholder={transformationMode === "write-assignment" ? "Paste an outline, lecturer's guide, notes or verified sources. The AI will not invent citations or references." : humanizeMode ? "Paste the complete article, assignment or draft. The rewrite preserves facts, citations, references, quotations and meaning while improving natural flow and readability." : "Paste the full assignment or document text to format, proofread or rewrite."} /></label>

        <div className="field full check-row">
          <input type="hidden" name="boldHeadings" value="off" />
          <input type="hidden" name="cleanSpecialCharacters" value="off" />
          <input type="hidden" name="automaticTableOfContents" value="off" />
          <input type="hidden" name="apaFormatting" value="off" />
          <input type="hidden" name="removeEmptyParagraphs" value="off" />
          <input type="hidden" name="widowOrphanControl" value="off" />
          <label><input name="boldHeadings" value="on" type="checkbox" defaultChecked /> Bold headings</label>
          <label><input name="cleanSpecialCharacters" value="on" type="checkbox" defaultChecked /> Remove stray special / Markdown characters</label>
          <label><input name="removeEmptyParagraphs" value="on" type="checkbox" defaultChecked /> Remove empty spaces / blank paragraphs</label>
          <label><input name="automaticTableOfContents" value="on" type="checkbox" /> Automatic contents page</label>
          <label><input name="widowOrphanControl" value="on" type="checkbox" defaultChecked /> Prevent widow / orphan lines</label>
          <label><input name="citations" type="checkbox" /> Citations</label>
          <label><input name="references" type="checkbox" /> References / hanging indent</label>
          <label><input name="coverPage" type="checkbox" /> Cover page</label>
          <label><input name="conversionRequested" type="checkbox" defaultChecked /> Convert / format into Word</label>
        </div>

        <label className="field full"><span>{transformationMode === "write-assignment" ? "Assignment question, requirements and deadline" : humanizeMode ? "Humanizing instructions / preferred tone / deadline" : "Instructions / deadline"}</span><textarea name="instructions" required placeholder={transformationMode === "write-assignment" ? "Enter the complete assignment question, lecturer's requirements, course context, deadline and any verified sources to use." : humanizeMode ? "Optional: tell us the preferred tone, audience and deadline. The service improves natural wording and flow without changing evidence or claiming to bypass AI detection." : "Tell us your deadline and any special formatting, conversion or printing instructions."} /></label>
        <input type="hidden" name="referralCode" value={referralCode} />
      </div>

      {humanizeMode && <div className="notice" style={{marginTop:16}}><strong>Article Rewriter & Humanizer:</strong> rewrites sentence structure and wording for smoother, more natural reading while preserving meaning, facts, figures, quotations, citations and references. It is an editing service, not a guarantee of any AI-detector result.</div>}
      <div className="notice" style={{marginTop:16}}><strong>UNN Undergraduate Project format:</strong> Times New Roman 12pt, <strong>2.0 double spacing</strong>, justified body paragraphs, academic heading hierarchy and hanging reference entries. To use 1.0 or 1.5 spacing, choose Custom academic format.</div>
      <div className="notice" style={{marginTop:10}}>Academic integrity: AI drafts and rewrites must be reviewed, fact-checked and adapted by the student or author. The system preserves supplied evidence and does not invent citations or references.</div>
      <button className="btn primary" style={{marginTop:16}} type="submit" disabled={submitting}>{submitting ? "Preparing conversion..." : humanizeMode ? "Rewrite, Humanize & Convert to Word" : "Submit, Format & Convert to Word"}</button>
      {message && <p className="form-message" aria-live="polite">{message}</p>}
      {message.includes("Order ") && <a className="btn whatsapp" style={{marginTop:8}} target="_blank" rel="noreferrer" href="https://wa.me/2347065342818?text=Hello%20Mabrig%20ICT%2C%20I%20have%20submitted%20an%20academic%20document%20conversion%20and%20printing%20order%20on%20the%20website.%20Please%20help%20me%20continue%20with%20the%20order.">Continue on WhatsApp</a>}
    </form>
  </div>;
}
