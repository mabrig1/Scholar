import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Mabrig Researcher Pro collects, uses, shares, retains and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="policy-shell">
      <article>
        <a className="brand" href="/">Mabrig Researcher Pro</a>
        <h1>Privacy Policy</h1>
        <p><strong>Effective date:</strong> 30 September 2026</p>
        <p>
          Mabrig Researcher Pro is operated under the MABRIG Technologies brand. This policy explains how
          personal information is handled when you use the website, research tools, repository, academic-support
          services, payment flows and related communications. It is intended to support transparent processing
          under the Nigeria Data Protection Act 2023 and applicable data-protection requirements.
        </p>

        <h2>1. Who is responsible for your information</h2>
        <p>
          For privacy enquiries, access, correction, deletion or objection requests, contact
          <a href="mailto:mabrig@mabrigkorie.org"> mabrig@mabrigkorie.org</a>.
          We may ask for reasonable information to verify that a request relates to you before acting on it.
        </p>

        <h2>2. Information we may collect</h2>
        <p>Depending on the feature you use, we may process:</p>
        <ul>
          <li>identity and contact details such as name, email, WhatsApp number, affiliation and department;</li>
          <li>research material such as titles, abstracts, manuscripts, datasets, citations, instructions and uploaded files;</li>
          <li>service and transaction records such as quotations, order numbers, payment references, delivery details and support messages;</li>
          <li>repository metadata such as author names, ORCID, affiliation, abstract, keywords, DOI, licence and rights statements;</li>
          <li>technical information such as request metadata, browser storage used by workspace features, security logs and attribution/referral tokens;</li>
          <li>optional integrity-corpus material only where retention permission is expressly recorded.</li>
        </ul>

        <h2>3. Why we process information</h2>
        <p>
          We use information to provide requested research tools and services, create and fulfil orders, process and
          verify payments, communicate about work, operate the moderated repository, prevent abuse, maintain security,
          improve reliability, meet legal/accounting obligations and protect the rights of users and the service.
        </p>

        <h2>4. Lawful bases</h2>
        <p>
          Depending on the activity, processing may rely on performance of a requested service or contract, your
          consent, compliance with a legal obligation, or legitimate interests such as platform security, fraud
          prevention and service administration. Optional marketing communications are not treated as a condition of
          receiving a service and require an affirmative choice.
        </p>

        <h2>5. Browser storage and workspace data</h2>
        <p>
          Some research-workspace settings and drafts can be stored locally in your browser so they remain available
          on your device. Local browser data is not automatically submitted to us. You can clear it using browser
          controls or the relevant workspace control.
        </p>

        <h2>6. AI-assisted features</h2>
        <p>
          When you deliberately choose an AI-assisted feature, relevant text or instructions may be sent to a
          configured AI provider to perform that operation. Do not submit confidential, restricted or third-party
          information unless you are authorized to do so. We do not represent AI output as verified evidence. You
          remain responsible for factual review, authorship, citations, disclosure and compliance with institutional
          rules. Provider processing is also subject to the provider's applicable terms and privacy practices.
        </p>

        <h2>7. Scholarly data and external research services</h2>
        <p>
          Research tools may query services such as Crossref, OpenAlex and other configured scholarly-data providers.
          Only information reasonably required for the selected operation should be transmitted. Availability,
          coverage and provider policies can change independently of Mabrig Researcher Pro.
        </p>

        <h2>8. Payments and communications</h2>
        <p>
          Payment processing may involve Paystack or another configured payment provider. We do not need to store your
          complete card details. Messaging and notification functions may involve WhatsApp, Telegram or email
          providers. Transaction and communication records may be retained where reasonably necessary for fulfilment,
          dispute handling, fraud prevention, accounting or legal compliance.
        </p>

        <h2>9. MABRIG service analytics and attribution</h2>
        <p>
          Where configured, limited conversion information such as an email address, product/service name, amount,
          order reference and attribution token may be reported to a MABRIG-operated growth system to understand
          referrals and service conversions. This does not authorize unrelated sale of manuscript content or research
          files.
        </p>

        <h2>10. Repository deposits and public information</h2>
        <p>
          A repository submission remains private during moderation. If approved, scholarly metadata and any
          rights-cleared file or external link approved for publication are intentionally made public. The private
          moderation email is not displayed publicly. Depositors must have authority to provide metadata and to share
          any uploaded or linked full text.
        </p>

        <h2>11. Integrity and similarity checks</h2>
        <p>
          Similarity checks may create a scan record containing a document hash, similarity statistics and evidence
          results when database persistence is configured. An ordinary scan does not automatically add the submitted
          manuscript to a future comparison corpus. Retaining full text for future authorized comparison requires a
          separate explicit permission. Public comparison requires an additional administrator-controlled permission.
          A similarity score is not, by itself, a finding of academic misconduct.
        </p>

        <h2>12. Service providers and international processing</h2>
        <p>
          We may use infrastructure, storage, database, payment, messaging, scholarly-data and AI providers. Some may
          process information outside Nigeria. We seek to limit disclosures to what is reasonably required for the
          selected service and to use appropriate contractual, technical or organizational safeguards where required.
        </p>

        <h2>13. Retention</h2>
        <p>
          We retain personal information only for as long as reasonably necessary for the purpose collected, to
          complete requested work, maintain transaction and security records, resolve disputes, operate an authorized
          repository/corpus, or satisfy applicable legal obligations. Repository records intended for permanent
          scholarly access may be retained for that purpose unless a lawful takedown or correction requires otherwise.
          Files and working copies should be deleted or de-identified when they are no longer reasonably needed.
        </p>

        <h2>14. Security</h2>
        <p>
          We use access controls, restricted administration routes, transport security, input and upload limits,
          security scanning and other technical measures appropriate to the service. No online system can guarantee
          absolute security. If a personal-data breach creates a notification duty, we will follow applicable legal
          requirements.
        </p>

        <h2>15. Your privacy rights</h2>
        <p>
          Subject to applicable law, you may request access to personal data, correction of inaccurate data, deletion,
          restriction or objection to certain processing, and withdrawal of consent where processing relies on
          consent. Withdrawal does not invalidate processing lawfully carried out before withdrawal. Some records may
          need to be retained where another lawful basis or legal obligation applies.
        </p>

        <h2>16. Complaints</h2>
        <p>
          Please contact us first at <a href="mailto:mabrig@mabrigkorie.org">mabrig@mabrigkorie.org</a> so we can
          investigate. Where applicable, you may also raise a complaint with the Nigeria Data Protection Commission
          or another competent supervisory authority.
        </p>

        <h2>17. Children</h2>
        <p>
          The commercial research and postgraduate services are intended for adults and users capable of giving valid
          consent. A person who cannot legally consent to the relevant processing should use the service only with
          appropriate parent, guardian or institutional authorization.
        </p>

        <h2>18. Changes to this policy</h2>
        <p>
          We may update this policy when services, providers or legal requirements change. The effective date on this
          page identifies the current public version. Material changes should be communicated through the website or
          another reasonable channel.
        </p>

        <div className="actions">
          <a className="btn secondary" href="/terms">Terms of Use</a>
          <a className="btn secondary" href="/trust">Trust Centre</a>
        </div>
      </article>
    </main>
  );
}
