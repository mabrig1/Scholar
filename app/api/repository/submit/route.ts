import { NextRequest, NextResponse } from "next/server";
import {
  assessRepositorySubmission,
  parseList,
  type RepositorySubmissionInput,
  type RepositoryWorkType,
} from "@/lib/open-repository";
import { createRepositorySubmission } from "@/lib/open-repository-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const TYPES = new Set<RepositoryWorkType>([
  "ARTICLE",
  "THESIS",
  "PREPRINT",
  "CONFERENCE_PAPER",
  "BOOK_CHAPTER",
  "REPORT",
]);

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const workType = field(form, "workType") as RepositoryWorkType;

    if (!TYPES.has(workType)) {
      return NextResponse.json({ error: "Select a valid scholarly work type." }, { status: 400 });
    }

    const input: RepositorySubmissionInput = {
      fullName: field(form, "fullName"),
      affiliation: field(form, "affiliation"),
      department: field(form, "department"),
      contactEmail: field(form, "contactEmail"),
      orcid: field(form, "orcid"),
      bio: field(form, "bio"),
      title: field(form, "title"),
      authors: parseList(form.get("authors"), 30),
      year: Number(field(form, "year")),
      workType,
      abstract: field(form, "abstract"),
      keywords: parseList(form.get("keywords"), 20),
      journal: field(form, "journal"),
      doi: field(form, "doi"),
      externalUrl: field(form, "externalUrl"),
      license: field(form, "license"),
      rightsStatement: field(form, "rightsStatement"),
      rightsConfirmed: field(form, "rightsConfirmed") === "true",
    };

    const readiness = assessRepositorySubmission(input);
    if (!readiness.readyForReview) {
      return NextResponse.json(
        { error: readiness.blockers.join(" "), readiness },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const uploaded = form.get("file");
    let file: { name: string; type: string; size: number; data: Buffer } | undefined;

    if (uploaded instanceof File && uploaded.size > 0) {
      if (uploaded.type !== "application/pdf") {
        return NextResponse.json({ error: "Repository uploads currently accept PDF files only." }, { status: 400 });
      }
      if (uploaded.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "PDF exceeds the 4 MB direct-upload limit. Use a stable public repository/full-text URL for larger files." },
          { status: 413 },
        );
      }
      file = {
        name: uploaded.name.slice(0, 180),
        type: uploaded.type,
        size: uploaded.size,
        data: Buffer.from(await uploaded.arrayBuffer()),
      };
    }

    if (!file && !input.externalUrl) {
      return NextResponse.json(
        { error: "Upload a rights-cleared PDF or provide a stable public full-text/repository URL." },
        { status: 400 },
      );
    }

    if (input.externalUrl) {
      try {
        const url = new URL(input.externalUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        return NextResponse.json({ error: "External full-text URL must be a valid HTTP/HTTPS URL." }, { status: 400 });
      }
    }

    const work = await createRepositorySubmission(input, file);
    return NextResponse.json(
      {
        ok: true,
        submissionId: String(work._id),
        slug: work.slug,
        status: work.status,
        readiness,
        message:
          "Submission received for human moderation. It will remain private until rights and scholarly metadata are reviewed.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repository submission failed.";
    const duplicate = /duplicate|already exists/i.test(message);
    return NextResponse.json({ error: message }, { status: duplicate ? 409 : 500 });
  }
}
