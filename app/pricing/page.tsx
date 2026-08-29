import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent self-service, human-assisted and institutional research support from Mabrig Researcher Pro.",
};

const plans = [
  {
    name: "Explore",
    price: "Free",
    note: "Self-service research tools",
    features: ["Private manuscript workspace", "Journal pathway directories", "Publishing readiness preview", "Format-only Word conversion", "No account required"],
    href: "/workspace",
    action: "Start free",
  },
  {
    name: "Assisted Researcher",
    price: "From ₦10,000",
    note: "Quoted per document or project",
    featured: true,
    features: ["Human document review", "Rewriting and clarity editing", "Institution-specific formatting", "Citation and reference cleanup", "Word/PDF output and tracked delivery"],
    href: "/academic-printing/order",
    action: "Submit for a quote",
  },
  {
    name: "Publishing Desk",
    price: "Custom",
    note: "Authors, teams and institutions",
    features: ["Submission-readiness decision", "Journal comparison matrix", "Citation and DOI integrity audit", "Reviewer-response support", "International invoices quoted in USD or GBP"],
    href: "/academic-printing/order",
    action: "Request publishing support",
  },
];

export default function PricingPage() {
  return (
    <main className="commercial-shell">
      <header className="container nav"><a className="brand researcher-brand" href="/"><span>MRP</span><strong>Mabrig Researcher Pro</strong></a><div className="actions"><a className="btn secondary" href="/trust">Trust centre</a><a className="btn primary" href="/workspace">My workspace</a></div></header>
      <section className="commercial-hero"><div className="container"><span className="badge">CLEAR PRICING • NO ACCEPTANCE PROMISES</span><h1>Begin free. Pay when you need human expertise.</h1><p className="lead">Use the research tools independently, or submit complex work for a transparent quotation. Publication fees charged by journals are always separate and must be verified on the official journal website.</p></div></section>
      <section className="section container pricing-grid">
        {plans.map((plan) => <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.name}>{plan.featured && <span className="pricing-popular">MOST PRACTICAL</span>}<h2>{plan.name}</h2><strong className="pricing-price">{plan.price}</strong><p>{plan.note}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><a className={`btn ${plan.featured ? "primary" : "secondary"}`} href={plan.href}>{plan.action}</a></article>)}
      </section>
      <section className="section container"><div className="notice"><strong>International clients:</strong> request a quotation before payment. Currency, payment method, delivery time and scope must be confirmed in the written order. Mabrig Researcher Pro never sells journal acceptance, indexing or fabricated research results.</div></section>
    </main>
  );
}
