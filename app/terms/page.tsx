import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms governing Mabrig Researcher Pro research tools, repository and academic-support services.",
};

export default function TermsPage() {
  return (
    <main className="policy-shell">
      <article>
        <a className="brand" href="/">Mabrig Researcher Pro</a>
        <h1>Terms of Use</h1>
        <p><strong>Effective date:</strong> 30 September 2026</p>
        <p>
          These terms govern use of Mabrig Researcher Pro, operated under the MABRIG Technologies brand. By submitting
          an order, using a paid service, depositing repository material, or expressly accepting these terms, you agree
          to the provisions that apply to that activity.
        </p>

        <h2>1. Permitted use</h2>
        <p>
          The platform supports legitimate research planning, literature discovery, editing, proofreading, formatting,
          data-analysis assistance, citation review, journal investigation, publication preparation, repository
          deposit and related professional services.
        </p>

        <h2>2. Academic integrity and user responsibility</h2>
        <p>
          You remain responsible for authorship, factual accuracy, source verification, research ethics, approvals,
          data integrity, citations, AI-use disclosure and compliance with your institution, journal, funder or
          professional body. Do not use the service to fabricate data or citations, impersonate an author, conceal
          misconduct, falsify approvals, or submit generated work as your own where doing so violates applicable rules.
        </p>

        <h2>3. No outcome guarantee</h2>
        <p>
          Research suggestions, similarity results, journal matches, readiness scores, citation checks, grant or
          publication guidance and AI outputs are decision-support tools. We do not guarantee grades, degree outcomes,
          plagiarism or AI-detector results, journal acceptance, indexing, citations, peer-review speed, grant awards,
          funding decisions, scholarship awards or institutional approval.
        </p>

        <h2>4. User warranties for submitted material</h2>
        <p>
          You confirm that you are authorized to submit the files, text, data, names, contact details and other
          materials you provide, and that our processing of those materials for the requested service will not
          knowingly violate another person's confidentiality, privacy, copyright or contractual rights. Do not upload
          restricted research data, examination materials, confidential records or third-party manuscripts without
          appropriate authorization.
        </p>

        <h2>5. AI-assisted processing</h2>
        <p>
          AI features are optional unless clearly included in a selected service. When you select an AI-assisted
          operation, relevant submitted content may be transmitted to a configured AI provider. AI can make errors,
          omit context or generate unsuitable wording. You must review output before relying on or submitting it.
        </p>

        <h2>6. Repository licence and takedown</h2>
        <p>
          If you submit a work for repository publication, you retain ownership of your content. You grant Mabrig
          Researcher Pro a non-exclusive, worldwide, royalty-free licence to store, reproduce, index, make technical
          copies of, and publicly display approved metadata and rights-cleared files solely for repository, discovery,
          preservation and related scholarly-access functions. Approval remains subject to human moderation. We may
          reject, suspend or remove a deposit where rights, identity, metadata, safety or legal concerns arise.
        </p>

        <h2>7. Third-party rights and notices</h2>
        <p>
          Publisher policies, licences and self-archiving rules can change. A repository or journal tool does not grant
          you rights that you do not already possess. Rights holders may contact
          <a href="mailto:mabrig@mabrigkorie.org"> mabrig@mabrigkorie.org</a> with a supported correction or takedown
          request.
        </p>

        <h2>8. Quotations, payments and service scope</h2>
        <p>
          Human-assisted work is governed by the scope, price, currency, deliverables and turnaround communicated for
          the specific engagement. Third-party fees such as journal charges, data-provider charges, payment fees or
          external services are separate unless expressly included. A service-specific written quotation may add terms
          for that engagement; it does not override mandatory law.
        </p>

        <h2>9. Refunds and cancellation</h2>
        <p>
          Where a paid service is cancelled, any refund depends on the work already performed, irreversible third-party
          costs, digital deliverables already supplied and applicable consumer law. We do not charge for an outcome
          that only an external journal, funder, university or other independent decision-maker can control.
        </p>

        <h2>10. Service availability</h2>
        <p>
          We may change, suspend or discontinue features for maintenance, security, provider changes, legal compliance
          or product development. Third-party APIs, databases and payment or messaging services may become unavailable
          or change their terms. Reduced-function fallbacks may be used where available.
        </p>

        <h2>11. Intellectual property</h2>
        <p>
          Except for user content and third-party materials, the platform interface, software, workflows, branding and
          original service materials are owned by or licensed to MABRIG Technologies. You may use generated or edited
          deliverables for the agreed purpose, subject to third-party rights and the academic-integrity obligations
          above.
        </p>

        <h2>12. Security and misuse</h2>
        <p>
          You must not probe, bypass, overload or interfere with access controls; attempt unauthorized access to
          administrative areas or another person's order; upload malware; abuse APIs; scrape protected data; or use the
          service for unlawful activity. We may restrict access, preserve relevant logs and cooperate with lawful
          investigations where reasonably necessary.
        </p>

        <h2>13. Privacy</h2>
        <p>
          Personal information is handled under the <a href="/privacy">Privacy Policy</a>. Optional marketing consent
          is separate from acceptance of these terms and from the processing required to provide a requested service.
        </p>

        <h2>14. Independent third parties and no institutional affiliation</h2>
        <p>
          References to universities, journals, Scopus, Google Scholar, Crossref, OpenAlex, Paystack or other external
          organizations identify third-party institutions or services. Unless expressly stated in writing, they do not
          imply sponsorship, endorsement, partnership or agency.
        </p>

        <h2>15. Disclaimers and limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law, the service is provided without a promise that every
          feature will be uninterrupted or error-free. We are not responsible for independent decisions by journals,
          funders, institutions or third-party providers. For a paid engagement, and except where law does not permit
          limitation, aggregate liability arising directly from that engagement will not exceed the amount actually
          paid to us for the specific affected service. Nothing in these terms excludes liability that cannot lawfully
          be excluded.
        </p>

        <h2>16. Governing law and disputes</h2>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, subject to any mandatory rights that
          apply to you. Before commencing formal proceedings, the parties should first attempt in good faith to resolve
          a dispute through written notice and reasonable discussion. Unresolved disputes may be brought before a court
          of competent jurisdiction in Nigeria.
        </p>

        <h2>17. Changes and severability</h2>
        <p>
          We may update these terms as the platform or applicable requirements change. If a provision is found
          unenforceable, the remaining provisions continue to apply to the extent permitted by law. The effective date
          identifies the current public version.
        </p>

        <h2>18. Contact</h2>
        <p>
          Legal, privacy, rights and service enquiries: <a href="mailto:mabrig@mabrigkorie.org">mabrig@mabrigkorie.org</a>.
        </p>

        <div className="actions">
          <a className="btn secondary" href="/privacy">Privacy Policy</a>
          <a className="btn secondary" href="/trust">Trust Centre</a>
        </div>
      </article>
    </main>
  );
}
