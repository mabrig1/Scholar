import { NextResponse } from "next/server";
import { attachmentContentDisposition, safeAttachmentFilename } from "@/lib/download-filename";
import {
  generateNounThesis,
  NounThesisError,
  parseNounDegreeLevel,
  parseNounWriterMode,
  titleWordCount,
  type NounThesisInput,
} from "@/lib/noun-thesis";
import {
  generateExpertNounThesis,
  type ExpertCitationDensity,
  type ExpertMethodologyType,
  type NounExpertSettings,
} from "@/lib/noun-thesis-expert";
import { generateExpertNounChapterTwo } from "@/lib/noun-thesis-chapter2";
import { buildNounThesisWordDocument } from "@/lib/noun-thesis-word";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CONTEXT_CHARS = 120_000;

function field(form: FormData, name: string, max = 20_000) {
  return String(form.get(name) || "").trim().slice(0, max);
}

function toggle(form: FormData, name: string, fallback = false) {
  const values = form.getAll(name).map(value => String(value).toLowerCase());
  if (!values.length) return fallback;
  return values.some(value => value === "on" || value === "true" || value === "1");
}

function boundedNumber(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function parseMethodologyType(value: FormDataEntryValue | null): ExpertMethodologyType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "quantitative" || normalized === "qualitative" || normalized === "mixed" || normalized === "secondary") {
    return normalized;
  }
  return "unspecified";
}

function parseCitationDensity(value: FormDataEntryValue | null): ExpertCitationDensity {
  return String(value || "").trim().toLowerCase() === "intensive" ? "intensive" : "standard";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const mode = parseNounWriterMode(form.get("mode"));
    const degreeLevel = parseNounDegreeLevel(form.get("degreeLevel"));
    const title = field(form, "title", 300);
    const studentName = field(form, "studentName", 160);
    const matricNumber = field(form, "matricNumber", 80);
    const faculty = field(form, "faculty", 160);
    const department = field(form, "department", 160);
    const programme = field(form, "programme", 160);
    const award = field(form, "award", 200);
    const studyCentre = field(form, "studyCentre", 160);
    const supervisor = field(form, "supervisor", 160);
    const monthYear = field(form, "monthYear", 80);
    const targetPages = boundedNumber(form.get("targetPages"), 15, 4, 100);

    if (!title || !studentName || !matricNumber || !faculty || !department || !programme || !award || !monthYear) {
      return NextResponse.json({ error: "Complete the thesis title, student, matric number, faculty, department, programme, award and completion date." }, { status: 400 });
    }

    const educationFaculty = /education/i.test(faculty);
    if (educationFaculty && titleWordCount(title) > 23) {
      return NextResponse.json({ error: "The configured NOUN Faculty of Education baseline limits the project/dissertation/thesis title to 23 words. Shorten the title or use the faculty/supervisor instructions after confirming an approved exception." }, { status: 400 });
    }

    let input: NounThesisInput = {
      mode,
      degreeLevel,
      targetPages,
      title,
      studentName,
      matricNumber,
      faculty,
      department,
      programme,
      award,
      studyCentre,
      supervisor,
      monthYear,
      backgroundBrief: field(form, "backgroundBrief", MAX_CONTEXT_CHARS),
      problemStatement: field(form, "problemStatement", MAX_CONTEXT_CHARS),
      objectives: field(form, "objectives", MAX_CONTEXT_CHARS),
      researchQuestions: field(form, "researchQuestions", MAX_CONTEXT_CHARS),
      methodology: field(form, "methodology", MAX_CONTEXT_CHARS),
      findingsData: field(form, "findingsData", MAX_CONTEXT_CHARS),
      verifiedSources: field(form, "verifiedSources", MAX_CONTEXT_CHARS),
      dedication: field(form, "dedication", 5_000),
      acknowledgement: field(form, "acknowledgement", 12_000),
      appendices: field(form, "appendices", 60_000),
      facultyInstructions: field(form, "facultyInstructions", 30_000),
      automaticTableOfContents: toggle(form, "automaticTableOfContents", true),
    };

    const currentYear = new Date().getFullYear();
    const startYear = boundedNumber(form.get("referenceYearStart"), Math.max(2015, currentYear - 10), 1900, currentYear);
    const endYear = boundedNumber(form.get("referenceYearEnd"), currentYear, startYear, currentYear);
    const expertSettings: NounExpertSettings = {
      enabled: toggle(form, "expertMode", true),
      sectionFocus: field(form, "sectionFocus", 300),
      existingWork: field(form, "existingWork", MAX_CONTEXT_CHARS),
      supervisorCorrections: field(form, "supervisorCorrections", 40_000),
      methodologyType: parseMethodologyType(form.get("methodologyType")),
      citationDensity: parseCitationDensity(form.get("citationDensity")),
      paragraphTarget: String(form.get("paragraphTarget") || "") === "13-15-lines" ? "13-15-lines" : "balanced",
      empiricalStudyTarget: boundedNumber(form.get("empiricalStudyTarget"), 15, 13, 20),
      theoryCount: 3,
      minimumReferences: boundedNumber(form.get("minimumReferences"), degreeLevel === "masters" || degreeLevel === "phd" ? 50 : 30, 10, 150),
      referenceYearStart: startYear,
      referenceYearEnd: endYear,
      requireDoiOrUrl: toggle(form, "requireDoiOrUrl", true),
      includeQualityAudit: toggle(form, "includeQualityAudit", true),
      includeDefensePack: toggle(form, "includeDefensePack", false),
    };

    const generated = expertSettings.enabled
      ? mode === "chapter2"
        ? await generateExpertNounChapterTwo(input, expertSettings)
        : await generateExpertNounThesis(input, expertSettings)
      : await generateNounThesis(input);

    if (expertSettings.enabled) {
      const expertGenerated = generated as { qualityAudit?: string; defensePack?: string };
      const supplemental = [
        input.appendices,
        expertGenerated.qualityAudit ? `EXPERT QUALITY AUDIT\n\n${expertGenerated.qualityAudit}` : "",
        expertGenerated.defensePack ? `THESIS DEFENSE PREPARATION PACK\n\n${expertGenerated.defensePack}` : "",
      ].filter(Boolean).join("\n\n");
      input = { ...input, appendices: supplemental };
    }

    const buffer = await buildNounThesisWordDocument(input, generated);
    const filename = safeAttachmentFilename(`${studentName}-${mode === "full" ? "NOUN-Thesis" : `NOUN-${mode}`}${expertSettings.enabled ? "-Expert" : ""}`, {
      extension: ".docx",
      fallback: "NOUN-thesis-draft",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": attachmentContentDisposition(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-NOUN-Writer-Mode": mode,
        "X-NOUN-Degree-Level": degreeLevel,
        "X-NOUN-Expert-Mode": expertSettings.enabled ? "true" : "false",
        "X-NOUN-Chapter2-Staged": expertSettings.enabled && mode === "chapter2" ? "true" : "false",
        "X-AI-Used": "true",
      },
    });
  } catch (error) {
    if (error instanceof NounThesisError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("NOUN thesis writer failed", error);
    return NextResponse.json({ error: "Unable to generate the NOUN thesis document." }, { status: 500 });
  }
}
