import mongoose, { Schema } from "mongoose";

const CorpusSourceSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 500 },
  text: { type: String, required: true },
  sourceType: { type: String, enum: ["thesis","project","article","submission","institutional","web"], default: "institutional", index: true },
  institution: { type: String, trim: true, maxlength: 300, index: true },
  author: { type: String, trim: true, maxlength: 300 },
  year: Number,
  url: { type: String, maxlength: 1500 },
  fingerprint: { type: String, index: true },
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

export const CorpusSource = mongoose.models.CorpusSource || mongoose.model("CorpusSource", CorpusSourceSchema);
export const IntegrityScan = mongoose.models.IntegrityScan || mongoose.model("IntegrityScan", IntegrityScanSchema);

export const VECTOR_INDEX_BLUEPRINT = {
  name: "scholar_integrity_vectors",
  field: "embedding",
  note: "Create this Atlas Vector Search index only after an embedding provider/model is selected. Query and corpus embeddings must use the same model and dimensions.",
};
