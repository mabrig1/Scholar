import Link from "next/link";
import AcademicPrintOrderForm from "../../components/AcademicPrintOrderForm";

export default function AcademicPrintingOrderPage() {
  return <>
    <header className="container nav">
      <Link className="brand" href="/">MABRIG RESEARCHER PRO</Link>
      <div className="actions"><Link className="btn secondary" href="/academic-printing">Service Details</Link><Link className="btn secondary" href="/track">Track Order</Link></div>
    </header>
    <main>
      <section className="section">
        <div className="container order">
          <AcademicPrintOrderForm />
        </div>
      </section>
    </main>
    <footer className="footer"><div className="container">Need help? WhatsApp 07065342818.</div></footer>
  </>;
}
