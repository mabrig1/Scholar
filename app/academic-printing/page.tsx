import Link from "next/link";
import SpecialServicePoster from "../components/SpecialServicePoster";

export default function AcademicPrintingPage() {
  return <>
    <header className="container nav">
      <Link className="brand" href="/">MABRIG RESEARCHER PRO</Link>
      <div className="actions"><Link className="btn secondary" href="/">Home</Link><Link className="btn primary" href="/academic-printing/order">Start Order</Link></div>
    </header>
    <main>
      <section className="hero compact-hero">
        <div className="container">
          <span className="badge">Dedicated Student Printing Service</span>
          <h1>Send Your Work. We Format It. We Print It.</h1>
          <p className="lead">For assignments, term papers, undergraduate projects and academic documents up to 100 pages. Upload a file up to 4MB or paste your work directly, choose your formatting and printing options, and send it to the print shop.</p>
          <div className="actions"><Link className="btn primary" href="/academic-printing/order">Upload or Paste My Work</Link><a className="btn whatsapp" href="https://wa.me/2347065342818?text=Hello%20Mabrig%20ICT%2C%20I%20want%20to%20use%20the%20Academic%20Document%20Printing%20service." target="_blank" rel="noreferrer">WhatsApp 07065342818</a></div>
        </div>
      </section>

      <SpecialServicePoster />

      <section className="section container">
        <div className="grid">
          <article className="card"><h3>1. Upload or Paste</h3><p>Send PDF, Word, PowerPoint or Excel up to 4MB, or paste your document text directly into the order form.</p></article>
          <article className="card"><h3>2. Choose Formatting</h3><p>Select the UNN Undergraduate Project preset or choose custom font, size, spacing, citations, references, cover page and conversion requirements.</p></article>
          <article className="card"><h3>3. We Review & Print</h3><p>The print shop reviews the production request, formats where necessary and prepares the document for printing.</p></article>
        </div>
      </section>

      <section className="section container cta-panel">
        <h2>Deadline close?</h2>
        <p>Send the document now instead of spending your last minutes fighting with formatting and printing.</p>
        <Link className="btn primary" href="/academic-printing/order">Start My Printing Order</Link>
      </section>
    </main>
    <footer className="footer"><div className="container">© {new Date().getFullYear()} Mabrig ICT & Academic Assistance.</div></footer>
  </>;
}
