import mongoose, { Schema } from "mongoose";

const CorpusSourceSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 500 },
  text: { type: String, required: true },
  sourceType: { type: String, enum: ["thesis","project","article","submission","institutional","web"], default: "institutional", index: true },
  institution: { type: String, trim: true, maxlength: 300, index: true },
  author: { type: String, trim: true, maxlength: 300 },
  year: Number,
  url: { type: String, maxlength: 1500 },
  fingerprint: { type: String, index: true, unique: true, sparse: true },
  publicComparisonAllowed: { type: Boolean, default: false, index: true },
  embedding: { type: [Number], select: false },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const IntegrityScanSchema = new Schema({
  fileName: { type: String, maxlength: 500 },
  documentHash: { type: String, index: true },
  overallSimilarity: Number,
  riskBand: String,
  matchedWords: Number,
  totalWords: Number,
  sourceCount: Number,
  matchCount: Number,
  report: { type: Schema.Types.Mixed },
}, { timestamps: true });

// Keep collection names explicit so application writes and Atlas Vector Search
// always target the same collections across environments.
export const CorpusSource = mongoose.models.CorpusSource || mongoose.model("CorpusSource", CorpusSourceSchema, "integrity_corpus");
export const IntegrityScan = mongoose.models.IntegrityScan || mongoose.model("IntegrityScan", IntegrityScanSchema, "integrity_scans");

export const VECTOR_INDEX_BLUEPRINT = {
  name: "scholar_integrity_vectors",
  field: "embedding",
  filterFields: ["institution", "publicComparisonAllowed"],
  note: "Create this Atlas Vector Search index only after an embedding provider/model is selected. Query and corpus embeddings must use the same model and dimensions. Add institution and publicComparisonAllowed as filter fields.",
};
