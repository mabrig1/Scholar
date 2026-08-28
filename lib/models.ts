import mongoose, { Schema, model, models } from "mongoose";

const userSchema = new Schema({
  name: { type: String, required: true },
  whatsapp: { type: String, required: true, unique: true, index: true },
  email: { type: String, default: null },
  department: { type: String, default: null },
  level: { type: String, default: null },
  role: { type: String, enum: ["STUDENT", "ADMIN", "WORKER", "RIDER"], default: "STUDENT" },
  optedIn: { type: Boolean, default: true },
}, { timestamps: true });

const serviceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  active: { type: Boolean, default: true },
  basePrice: Number,
}, { timestamps: true });

const orderSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "MabrigUser", required: true },
  serviceId: { type: Schema.Types.ObjectId, ref: "MabrigService", required: true },
  referralCode: { type: String, default: null, index: true },
  status: { type: String, default: "NEW" },
  documentTitle: { type: String, default: null },
  instructions: { type: String, required: true },
  pastedContent: { type: String, default: null },
  conversionSource: { type: String, enum: ["PASTE", "PROMPT", "TEXT", "DOCX", "PDF", "UNSUPPORTED"], default: null },
  conversionWarning: { type: String, default: null },
  adminNote: { type: String, default: null },
  quotedAmount: { type: Number, default: null },
  currency: { type: String, default: "NGN" },
  deadline: { type: Date, default: null },
  printOption: { type: String, default: "DIGITAL_ONLY" },
  printType: { type: String, default: "BLACK_WHITE" },
  copies: { type: Number, default: 1 },
  pages: { type: Number, min: 1, max: 100, default: 1 },
  binding: { type: String, default: "NONE" },
  requestedFormat: { type: String, default: "DOCX" },
  spacing: { type: String, enum: ["1.0", "1.5", "2.0", "single", "1.15", "double"], default: "2.0" },
  formatPreset: { type: String, enum: ["unn", "custom"], default: "unn" },
  font: { type: String, default: "Times New Roman" },
  fontSize: { type: Number, default: 12 },
  citations: { type: Boolean, default: false },
  references: { type: Boolean, default: false },
  coverPage: { type: Boolean, default: false },
  conversionRequested: { type: Boolean, default: false },
  transformationMode: { type: String, enum: ["format", "proofread", "rewrite", "write-assignment", "rewrite-assignment"], default: "format" },
  bodyAlignment: { type: String, enum: ["left", "justified"], default: "justified" },
  paragraphIndentation: { type: String, enum: ["none", "first-line", "first-line-wide"], default: "first-line" },
  boldHeadings: { type: Boolean, default: true },
  cleanSpecialCharacters: { type: Boolean, default: true },
  pageNumberPosition: { type: String, enum: ["none", "header-right", "footer-center", "footer-right"], default: "footer-center" },
  headingPreset: { type: String, enum: ["academic", "apa7", "compact"], default: "academic" },
  headerText: { type: String, default: null },
  footerText: { type: String, default: null },
  automaticTableOfContents: { type: Boolean, default: false },
  apaFormatting: { type: Boolean, default: false },
  referenceStyle: { type: String, enum: ["none", "apa7", "mla9"], default: "none" },
  removeEmptyParagraphs: { type: Boolean, default: true },
  widowOrphanControl: { type: Boolean, default: true },
  adminNotifications: {
    whatsapp: { type: String, enum: ["pending", "sent", "failed", "not_configured"], default: "not_configured" },
    telegram: { type: String, enum: ["pending", "sent", "failed", "not_configured"], default: "not_configured" },
  },
  lastClientMessageAt: { type: Date, default: null },
}, { timestamps: true });

const orderMessageSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "MabrigOrder", required: true, index: true },
  sender: { type: String, enum: ["CLIENT", "ADMIN"], default: "CLIENT" },
  body: { type: String, required: true, maxlength: 2000 },
  notificationStatus: {
    whatsapp: { type: String, enum: ["pending", "sent", "failed", "not_configured"], default: "not_configured" },
    telegram: { type: String, enum: ["pending", "sent", "failed", "not_configured"], default: "not_configured" },
  },
}, { timestamps: true });

const orderFileSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "MabrigOrder", required: true },
  fileName: String,
  storageKey: String,
  mimeType: String,
  sizeBytes: Number,
  data: { type: Buffer, select: false },
}, { timestamps: true });

const paymentSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "MabrigOrder", unique: true, required: true },
  reference: { type: String, unique: true, required: true, index: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING" },
  paidAt: Date,
}, { timestamps: true });

const deliverySchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "MabrigOrder", unique: true, required: true },
  status: { type: String, default: "PENDING" },
  location: { type: String, required: true },
  addressNote: String,
  riderId: { type: Schema.Types.ObjectId, ref: "MabrigUser", default: null },
  pickedUpAt: Date,
  deliveredAt: Date,
}, { timestamps: true });

export const User = models.MabrigUser || model("MabrigUser", userSchema);
export const Service = models.MabrigService || model("MabrigService", serviceSchema);
export const Order = models.MabrigOrder || model("MabrigOrder", orderSchema);
export const OrderMessage = models.MabrigOrderMessage || model("MabrigOrderMessage", orderMessageSchema);
export const OrderFile = models.MabrigOrderFile || model("MabrigOrderFile", orderFileSchema);
export const Payment = models.MabrigPayment || model("MabrigPayment", paymentSchema);
export const Delivery = models.MabrigDelivery || model("MabrigDelivery", deliverySchema);

export type MabrigModels = { User: typeof User; Service: typeof Service; Order: typeof Order; OrderMessage: typeof OrderMessage; OrderFile: typeof OrderFile; Payment: typeof Payment; Delivery: typeof Delivery };
void mongoose;