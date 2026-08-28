"use client";

import { useState } from "react";

const SITE_URL = "https://academic.mabrigkorie.org/academic-printing";
const ORDER_URL = "/academic-printing/order";
const WHATSAPP_NUMBER = "2347065342818";
const SHARE_TEXT = "🎓 Rewrite and humanize articles, format UNN projects, or upload up to 100 pages for printing, binding and campus delivery with Mabrig Researcher Pro.";

const shareUrl = encodeURIComponent(SITE_URL);
const shareText = encodeURIComponent(SHARE_TEXT);
const contactText = encodeURIComponent("Hello Mabrig Researcher Pro. I want to use the Article Rewriter & Humanizer / Academic Document service.");

export default function SpecialServicePoster() {
  const [shareMessage, setShareMessage] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setShareMessage("Link copied — share it with a student or author who needs it.");
    } catch {
      setShareMessage(`Copy this link: ${SITE_URL}`);
    }
  }

  return (
    <section id="special-service" className="special-service-section">
      <div className="container">
        <article className="poster-ad" aria-labelledby="special-service-title">
          <div className="poster-copy">
            <span className="poster-kicker">🔥 SPECIAL STUDENT & AUTHOR SERVICES • UNN</span>
            <h2 id="special-service-title">Rewrite. Humanize. Format. Print. Submit With Confidence.</h2>
            <p className="poster-lead">
              Upload an article, assignment, project or academic document <strong>or paste it directly</strong>. Use our <strong>Article Rewriter & Humanizer</strong> for smoother, more natural wording while preserving meaning, facts and citations, or send documents up to <strong>100 pages</strong> with a <strong>4MB maximum file upload</strong> into our formatting and print workflow.
            </p>
            <p className="poster-punch">From rough draft to clear, polished, submission-ready document.</p>

            <div className="poster-features" aria-label="Service features">
              <span>Article Rewriter & Humanizer</span>
              <span>Upload or Paste</span>
              <span>UNN Undergraduate Project Format</span>
              <span>Times New Roman • 12pt</span>
              <span>UNN • 2.0 Double Spacing</span>
              <span>Citations & References Preserved</span>
              <span>Binding & Campus Delivery</span>
            </div>

            <div className="poster-actions">
              <a className="poster-btn poster-btn-primary" href={ORDER_URL}>✍️ Rewrite, Humanize or Format My Work</a>
              <a
                className="poster-btn poster-btn-whatsapp"
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${contactText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 WhatsApp 07065342818
              </a>
            </div>
          </div>

          <aside className="poster-offer" aria-label="Printing prices and sharing">
            <div className="poster-limit">UP TO <strong>100 PAGES</strong> • <strong>4MB MAX FILE</strong></div>
            <div className="poster-price-card">
              <span>BLACK & WHITE</span>
              <strong>₦30</strong>
              <small>per page</small>
            </div>
            <div className="poster-price-card">
              <span>COLOUR</span>
              <strong>₦100</strong>
              <small>per page</small>
            </div>
            <p className="poster-note">Rewriting, humanizing, formatting, binding and delivery charges depend on the service selected.</p>

            <div className="poster-share">
              <strong>Know someone with a draft or deadline?</strong>
              <span>Share this service:</span>
              <div className="share-links">
                <a href={`https://wa.me/?text=${shareText}%20${shareUrl}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer">Facebook</a>
                <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noopener noreferrer">X</a>
                <button type="button" onClick={copyLink}>Copy Link</button>
              </div>
              {shareMessage && <small className="share-message" aria-live="polite">{shareMessage}</small>}
            </div>
          </aside>
        </article>
      </div>
    </section>
  );
}
