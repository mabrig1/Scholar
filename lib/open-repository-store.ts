import { connectMongoDB } from "@/lib/mongodb";
import { RepositoryResearcher, RepositoryWork } from "@/lib/open-repository-models";
import type { RepositorySubmissionInput } from "@/lib/open-repository";
import { normalizeDoi, normalizeOrcid, researcherSlug, workSlug } from "@/lib/open-repository";

export async function upsertRepositoryResearcher(input: RepositorySubmissionInput) {
  await connectMongoDB();
  const slug = researcherSlug(input.fullName, input.orcid);
  const orcid = normalizeOrcid(input.orcid);
  const existing = await RepositoryResearcher.findOne({ slug });
  if (existing) {
    existing.fullName = input.fullName.trim();
    existing.affiliation = input.affiliation.trim();
    existing.department = (input.department || "").trim();
    existing.contactEmail = input.contactEmail.trim().toLowerCase();
    existing.orcid = orcid;
    existing.bio = (input.bio || "").trim();
    await existing.save();
    return existing;
  }
  return RepositoryResearcher.create({
    slug,
    fullName: input.fullName.trim(),
    affiliation: input.affiliation.trim(),
    department: (input.department || "").trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    orcid,
    bio: (input.bio || "").trim(),
  });
}

export async function createRepositorySubmission(
  input: RepositorySubmissionInput,
  file?: { name: string; type: string; size: number; data: Buffer },
) {
  const researcher = await upsertRepositoryResearcher(input);
  const slug = workSlug(input);
  const doi = normalizeDoi(input.doi);
  const existing = await RepositoryWork.findOne({
    $or: [{ slug }, ...(doi ? [{ doi }] : [])],
  }).lean();
  if (existing) throw new Error("This scholarly work already exists in the repository queue.");

  return RepositoryWork.create({
    slug,
    researcherId: researcher._id,
    title: input.title.trim(),
    authors: input.authors.map((name, index) => ({
      name: name.trim(),
      orcid: index === 0 ? normalizeOrcid(input.orcid) : "",
    })),
    year: input.year,
    workType: input.workType,
    abstract: input.abstract.trim(),
    keywords: input.keywords,
    journal: (input.journal || "").trim(),
    doi,
    externalUrl: (input.externalUrl || "").trim(),
    license: (input.license || "").trim(),
    rightsStatement: (input.rightsStatement || "").trim(),
    rightsConfirmed: input.rightsConfirmed,
    fileName: file?.name || "",
    mimeType: file?.type || "",
    sizeBytes: file?.size || 0,
    fileData: file?.data,
  });
}

export async function listPublishedWorks(query = "", limit = 50) {
  await connectMongoDB();
  const filter: Record<string, unknown> = { status: "APPROVED" };
  const trimmed = query.trim();
  if (trimmed) filter.$text = { $search: trimmed };
  const works = await RepositoryWork.find(filter)
    .sort({ approvedAt: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .populate("researcherId", "slug fullName affiliation department orcid bio")
    .lean();
  return JSON.parse(JSON.stringify(works));
}

export async function getPublishedWork(slug: string) {
  await connectMongoDB();
  const work = await RepositoryWork.findOne({ slug, status: "APPROVED" })
    .populate("researcherId", "slug fullName affiliation department orcid bio")
    .lean();
  return work ? JSON.parse(JSON.stringify(work)) : null;
}

export async function getPublishedResearcher(slug: string) {
  await connectMongoDB();
  const researcher = await RepositoryResearcher.findOne({ slug }).lean();
  if (!researcher) return null;
  const works = await RepositoryWork.find({ researcherId: researcher._id, status: "APPROVED" })
    .sort({ year: -1, approvedAt: -1 })
    .lean();
  if (!works.length) return null;
  return JSON.parse(JSON.stringify({ researcher, works }));
}

export async function getPublishedPdf(slug: string) {
  await connectMongoDB();
  return RepositoryWork.findOne({ slug, status: "APPROVED", mimeType: "application/pdf" })
    .select("+fileData fileName mimeType sizeBytes")
    .lean();
}

export async function listPendingRepositoryWorks(limit = 100) {
  await connectMongoDB();
  const works = await RepositoryWork.find({ status: "SUBMITTED" })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .populate("researcherId", "+contactEmail slug fullName affiliation department orcid")
    .lean();
  return JSON.parse(JSON.stringify(works));
}

export async function moderateRepositoryWork(input: {
  id: string;
  action: "approve" | "reject";
  note?: string;
  rightsReviewed?: boolean;
  metadataReviewed?: boolean;
}) {
  await connectMongoDB();
  const work = await RepositoryWork.findById(input.id);
  if (!work) throw new Error("Repository submission not found.");

  if (input.action === "approve") {
    if (!input.rightsReviewed || !input.metadataReviewed) {
      throw new Error("Rights and metadata must both be reviewed before approval.");
    }
    work.status = "APPROVED";
    work.rightsReviewed = true;
    work.metadataReviewed = true;
    work.approvedAt = new Date();
    work.moderationNote = (input.note || "").trim();
  } else {
    work.status = "REJECTED";
    work.moderationNote = (input.note || "").trim();
  }
  await work.save();
  return work;
}

export async function getPendingRepositoryPdf(id: string) {
  await connectMongoDB();
  return RepositoryWork.findOne({ _id: id, status: "SUBMITTED", mimeType: "application/pdf" })
    .select("+fileData fileName mimeType sizeBytes")
    .lean();
}

export async function getRepositorySitemapEntries() {
  if (!process.env.MONGODB_URI?.trim()) return [];
  try {
    await connectMongoDB();
    const [works, researchers] = await Promise.all([
      RepositoryWork.find({ status: "APPROVED" }).select("slug updatedAt").lean(),
      RepositoryResearcher.aggregate([
        {
          $lookup: {
            from: "repository_works",
            localField: "_id",
            foreignField: "researcherId",
            as: "works",
          },
        },
        { $match: { "works.status": "APPROVED" } },
        { $project: { slug: 1, updatedAt: 1 } },
      ]),
    ]);
    return {
      works: works.map((item) => ({ slug: item.slug, updatedAt: item.updatedAt })),
      researchers: researchers.map((item) => ({ slug: item.slug, updatedAt: item.updatedAt })),
    };
  } catch {
    return { works: [], researchers: [] };
  }
}
