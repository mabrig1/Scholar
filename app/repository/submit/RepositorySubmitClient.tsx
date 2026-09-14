"use client";

import { FormEvent, useState } from "react";
import styles from "../repository.module.css";

export default function RepositorySubmitClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      form.set("rightsConfirmed", form.get("rightsConfirmed") ? "true" : "false");
      const response = await fetch("/api/repository/submit", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Submission failed.");
      setMessage(data.message + " Submission ID: " + data.submissionId + ". Keep this ID for your records.");
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.two}>
        <label>
          Publishing name
          <input name="fullName" required maxLength={140} />
        </label>
        <label>
          Private contact email
          <input name="contactEmail" type="email" required maxLength={180} />
          <span className={styles.help}>Used only for repository moderation; not displayed publicly.</span>
        </label>
      </div>

      <div className={styles.two}>
        <label>
          Institution / affiliation
          <input name="affiliation" required maxLength={180} placeholder="University, institute, or Independent Researcher" />
        </label>
        <label>
          Department
          <input name="department" maxLength={180} />
        </label>
      </div>

      <div className={styles.two}>
        <label>
          ORCID
          <input name="orcid" maxLength={40} placeholder="0000-0000-0000-0000" />
        </label>
        <label>
          Researcher bio
          <input name="bio" maxLength={500} placeholder="Optional short public research bio" />
        </label>
      </div>

      <label>
        Scholarly work title
        <input name="title" required maxLength={350} />
      </label>

      <label>
        Authors — one per line
        <textarea name="authors" rows={5} required placeholder={"Ada N. Okafor\nBello Musa"} />
      </label>

      <div className={styles.three}>
        <label>
          Year
          <input name="year" type="number" min="1500" max="2200" required />
        </label>
        <label>
          Work type
          <select name="workType" defaultValue="ARTICLE">
            <option value="ARTICLE">Journal article</option>
            <option value="THESIS">Thesis / dissertation</option>
            <option value="PREPRINT">Preprint</option>
            <option value="CONFERENCE_PAPER">Conference paper</option>
            <option value="BOOK_CHAPTER">Book chapter</option>
            <option value="REPORT">Research report</option>
          </select>
        </label>
        <label>
          Journal / source
          <input name="journal" maxLength={240} />
        </label>
      </div>

      <div className={styles.two}>
        <label>
          DOI, if assigned
          <input name="doi" maxLength={180} placeholder="10.xxxx/..." />
        </label>
        <label>
          Licence
          <input name="license" maxLength={180} placeholder="e.g. CC BY 4.0, publisher terms, rights reserved" />
        </label>
      </div>

      <label>
        Complete author-written abstract
        <textarea name="abstract" rows={8} required minLength={80} maxLength={8000} />
      </label>

      <label>
        Keywords — separate with semicolons or new lines
        <textarea name="keywords" rows={3} maxLength={1500} />
      </label>

      <label>
        Rights statement / self-archiving basis
        <textarea
          name="rightsStatement"
          rows={4}
          maxLength={1500}
          placeholder="State why this version may be shared: open licence, author accepted manuscript permitted by publisher, thesis repository deposit, preprint rights, etc."
        />
      </label>

      <div className={styles.two}>
        <label>
          Rights-cleared PDF
          <input name="file" type="file" accept="application/pdf,.pdf" />
          <span className={styles.help}>Direct PDF uploads are limited to 4 MB. Larger files can use the external URL field.</span>
        </label>
        <label>
          Stable public full-text URL
          <input name="externalUrl" type="url" maxLength={1000} placeholder="https://institutional-repository.edu/..." />
          <span className={styles.help}>Use this for a publisher, preprint or institutional-repository copy you are permitted to share.</span>
        </label>
      </div>

      <label className={styles.check}>
        <input name="rightsConfirmed" type="checkbox" required />
        <span>
          <strong>I confirm that I am authorized to deposit this metadata and the supplied file/link.</strong>
          <span className={styles.help}>
            Do not upload a publisher PDF where the publisher or licence prohibits repository sharing.
          </span>
        </span>
      </label>

      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit for repository review"}
        </button>
        <a className={styles.buttonSecondary} href="/repository">Back to repository</a>
      </div>

      {message ? <div className={styles.status}>{message}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
    </form>
  );
}
