import { Schema, model, models } from "mongoose";

const repositoryResearcherSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    affiliation: { type: String, required: true },
    department: { type: String, default: "" },
    contactEmail: { type: String, required: true, select: false },
    orcid: { type: String, default: "", index: true },
    bio: { type: String, default: "" },
    keywords: { type: [String], default: [] },
  },
  { timestamps: true, collection: "repository_researchers" },
);

const repositoryWorkSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    researcherId: { type: Schema.Types.ObjectId, ref: "RepositoryResearcher", required: true, index: true },
    title: { type: String, required: true },
    authors: {
      type: [{ name: { type: String, required: true }, orcid: { type: String, default: "" } }],
      required: true,
    },
    year: { type: Number, required: true, index: true },
    workType: {
      type: String,
      enum: ["ARTICLE", "THESIS", "PREPRINT", "CONFERENCE_PAPER", "BOOK_CHAPTER", "REPORT"],
      required: true,
      index: true,
    },
    abstract: { type: String, required: true },
    keywords: { type: [String], default: [] },
    journal: { type: String, default: "" },
    doi: { type: String, default: undefined },
    externalUrl: { type: String, default: "" },
    license: { type: String, default: "" },
    rightsStatement: { type: String, default: "" },
    rightsConfirmed: { type: Boolean, default: false },
    status: { type: String, enum: ["SUBMITTED", "APPROVED", "REJECTED"], default: "SUBMITTED", index: true },
    moderationNote: { type: String, default: "" },
    rightsReviewed: { type: Boolean, default: false },
    metadataReviewed: { type: Boolean, default: false },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    sizeBytes: { type: Number, default: 0 },
    fileData: { type: Buffer, select: false },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "repository_works" },
);

repositoryWorkSchema.index({ title: "text", abstract: "text", keywords: "text", journal: "text" });
repositoryWorkSchema.index({ doi: 1 }, { unique: true, sparse: true });

export const RepositoryResearcher =
  models.RepositoryResearcher || model("RepositoryResearcher", repositoryResearcherSchema);
export const RepositoryWork =
  models.RepositoryWork || model("RepositoryWork", repositoryWorkSchema);
