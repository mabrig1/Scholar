import { after, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Delivery, Order, OrderFile, Service, User } from "@/lib/models";
import { calculateQuote } from "@/lib/pricing";
import { extractDocumentText } from "@/lib/extract-document-text";
import { parseDocumentTransformationMode } from "@/lib/ai-document-transform";
import { notifyAdminOfOrder } from "@/lib/order-notifications";
import {
  formToggleEnabled,
  parseBodyAlignment,
  parseDocumentLineSpacing,
  parseFormatPreset,
  parseHeadingPreset,
  parsePageNumberPosition,
  parseParagraphIndentation,
  parseReferenceStyle,
} from "@/lib/document-format-options";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAGES = 100;
const MAX_PASTED_CHARS = 500_000;
const MAX_CONVERTIBLE_CHARS = 600_000;
const MAX_FILE_BYTES = 4_000_000;

type PrintOption = "DIGITAL_ONLY" | "PRINT_ONLY" | "DIGITAL_AND_PRINT" | "DIGITAL_PRINT_DELIVERY";
type PrintType = "BLACK_WHITE" | "COLOUR";
type BindingType = "NONE" | "SPIRAL" | "SOFT" | "HARD";

const PRINT_OPTIONS: readonly PrintOption[] = ["DIGITAL_ONLY", "PRINT_ONLY", "DIGITAL_AND_PRINT", "DIGITAL_PRINT_DELIVERY"];
const PRINT_TYPES: readonly PrintType[] = ["BLACK_WHITE", "COLOUR"];
const BINDINGS: readonly BindingType[] = ["NONE", "SPIRAL", "SOFT", "HARD"];
const ALLOWED_FILE_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(request: Request) {
  try {
    await connectMongoDB();
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const whatsapp = String(form.get("whatsapp") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase() || null;
    const department = String(form.get("department") || "").trim() || null;
    const serviceName = String(form.get("service") || "").trim();
    const documentTitle = String(form.get("documentTitle") || "").trim().slice(0, 200) || null;
    const instructions = String(form.get("instructions") || "").trim();
    const pastedContent = String(form.get("pastedContent") || "").trim();
    const referralCode = String(form.get("referralCode") || "").trim().slice(0, 64) || null;
    const rawPrintOption = String(form.get("printOption") || "");
    const rawPrintType = String(form.get("printType") || "");
    const rawBinding = String(form.get("binding") || "");
    const printOption: PrintOption = PRINT_OPTIONS.includes(rawPrintOption as PrintOption) ? rawPrintOption as PrintOption : "DIGITAL_ONLY";
    const printType: PrintType = PRINT_TYPES.includes(rawPrintType as PrintType) ? rawPrintType as PrintType : "BLACK_WHITE";
    const copies = Math.max(1, Math.min(100, Number(form.get("copies") || 1)));
    const pages = Number(form.get("pages") || 0);
    const binding: BindingType = BINDINGS.includes(rawBinding as BindingType) ? rawBinding as BindingType : "NONE";
    const deliveryLocation = String(form.get("deliveryLocation") || "").trim();
    const deliveryNote = String(form.get("deliveryNote") || "").trim();
    const requestedFormat = String(form.get("requestedFormat") || "DOCX").trim();
    const formatPreset = parseFormatPreset(form.get("formatPreset"));
    const spacing = formatPreset === "unn" ? "2.0" : parseDocumentLineSpacing(form.get("spacing"));
    const font = String(form.get("font") || "Times New Roman").trim();
    const fontSize = Number(form.get("fontSize") || 12);
    const citations = form.get("citations") === "on";
    const references = form.get("references") === "on";
    const coverPage = form.get("coverPage") === "on";
    const conversionRequested = form.get("conversionRequested") === "on";
    const transformationMode = parseDocumentTransformationMode(form.get("transformationMode"));
    const bodyAlignment = parseBodyAlignment(form.get("bodyAlignment"));
    const paragraphIndentation = parseParagraphIndentation(form.get("paragraphIndentation"));
    const boldHeadings = formToggleEnabled(form, "boldHeadings");
    const cleanSpecialCharacters = formToggleEnabled(form, "cleanSpecialCharacters");
    const pageNumberPosition = parsePageNumberPosition(form.get("pageNumberPosition"));
    const headingPreset = parseHeadingPreset(form.get("headingPreset"));
    const headerText = String(form.get("headerText") || "").trim().slice(0, 160) || null;
    const footerText = String(form.get("footerText") || "").trim().slice(0, 160) || null;
    const automaticTableOfContents = formToggleEnabled(form, "automaticTableOfContents", false);
    const apaFormatting = formToggleEnabled(form, "apaFormatting", false);
    const referenceStyle = parseReferenceStyle(form.get("referenceStyle") || (apaFormatting ? "apa7" : "none"));
    const removeEmptyParagraphs = formToggleEnabled(form, "removeEmptyParagraphs");
    const widowOrphanControl = formToggleEnabled(form, "widowOrphanControl");
    const file = form.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const writeAssignmentRequested = transformationMode === "write-assignment";
    const assignmentBriefReady = Boolean(writeAssignmentRequested && documentTitle && instructions);

    if (!name || !whatsapp || !serviceName || !instructions) return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) return NextResponse.json({ error: `Page count must be between 1 and ${MAX_PAGES} pages.` }, { status: 400 });
    if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 30) return NextResponse.json({ error: "Font size must be between 8 and 30pt." }, { status: 400 });
    if (printOption === "DIGITAL_PRINT_DELIVERY" && !deliveryLocation) return NextResponse.json({ error: "Choose a delivery location." }, { status: 400 });
    if (writeAssignmentRequested && !documentTitle) return NextResponse.json({ error: "Add the assignment topic before using Write Assignment." }, { status: 400 });
    if (!hasFile && !pastedContent && !assignmentBriefReady) return NextResponse.json({ error: "Upload a file, paste your assignment, or choose Write Assignment and provide a topic and instructions." }, { status: 400 });
    if (pastedContent.length > MAX_PASTED_CHARS) return NextResponse.json({ error: "Pasted content is too long. Keep it within the 100-page submission limit." }, { status: 413 });

    if (hasFile) {
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Uploads must be 4MB or smaller. Compress the file, split large attachments, or paste the text instead." }, { status: 413 });
      if (file.type && !ALLOWED_FILE_TYPES.has(file.type)) return NextResponse.json({ error: "Unsupported file type. Upload TXT, PDF, Word, PowerPoint or Excel." }, { status: 400 });
    }

    let documentText = pastedContent;
    let conversionSource: "PASTE" | "PROMPT" | "TEXT" | "DOCX" | "PDF" | "UNSUPPORTED" | null = pastedContent
      ? "PASTE"
      : assignmentBriefReady ? "PROMPT" : null;
    let conversionWarning: string | null = null;

    if (hasFile && !documentText) {
      try {
        const extracted = await extractDocumentText(file);
        documentText = (extracted.text || "").slice(0, MAX_CONVERTIBLE_CHARS);
        conversionSource = extracted.source;
        conversionWarning = extracted.warning || null;
        if (extracted.text && extracted.text.length > MAX_CONVERTIBLE_CHARS) {
          conversionWarning = "Only the first part of this upload was retained for automatic Word conversion because it exceeded the conversion text limit.";
        }
      } catch (error) {
        console.error("Document text extraction failed", error);
        conversionSource = "UNSUPPORTED";
        conversionWarning = "Automatic text extraction failed. The print shop can still handle the order manually or the student can paste the text for instant Word conversion.";
      }
    }

    const service = await Service.findOneAndUpdate({ name: serviceName }, { $setOnInsert: { name: serviceName } }, { upsert: true, new: true });
    const userSet: Record<string, unknown> = { name, optedIn: true };
    if (email) userSet.email = email;
    if (department) userSet.department = department;
    const user = await User.findOneAndUpdate({ whatsapp }, { $set: userSet }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const orderNumber = `MAB-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.floor(10000 + Math.random() * 90000)}`;
    const quotedAmount = calculateQuote({ service: serviceName, printOption, printType, copies, pages, binding, delivery: printOption === "DIGITAL_PRINT_DELIVERY" });

    const order = await Order.create({
      orderNumber,
      userId: user._id,
      serviceId: service._id,
      referralCode,
      documentTitle,
      instructions,
      pastedContent: documentText || null,
      conversionSource,
      conversionWarning,
      quotedAmount,
      printOption,
      printType,
      copies,
      pages,
      binding,
      requestedFormat,
      spacing,
      formatPreset,
      font,
      fontSize,
      citations,
      references,
      coverPage,
      conversionRequested,
      transformationMode,
      bodyAlignment,
      paragraphIndentation,
      boldHeadings,
      cleanSpecialCharacters,
      pageNumberPosition,
      headingPreset,
      headerText,
      footerText,
      automaticTableOfContents,
      apaFormatting,
      referenceStyle,
      removeEmptyParagraphs,
      widowOrphanControl,
      adminNotifications: {
        whatsapp: process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID ? "pending" : "not_configured",
        telegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID ? "pending" : "not_configured",
      },
    });

    let submittedFile: { data: Buffer; fileName: string; mimeType: string } | null = null;
    if (hasFile) {
      submittedFile = {
        data: Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      };
      await OrderFile.create({
        orderId: order._id,
        fileName: submittedFile.fileName,
        storageKey: `mongodb/${orderNumber}/${submittedFile.fileName}`,
        mimeType: submittedFile.mimeType,
        sizeBytes: submittedFile.data.length,
        data: submittedFile.data,
      });
    }
    if (printOption === "DIGITAL_PRINT_DELIVERY") await Delivery.create({ orderId: order._id, location: deliveryLocation, addressNote: deliveryNote || null });

    after(async () => {
      try {
        const adminNotifications = await notifyAdminOfOrder({
          orderNumber,
          studentName: name,
          studentWhatsapp: whatsapp,
          documentTitle,
          submittedFile,
        });
        await Order.updateOne({ _id: order._id }, { $set: { adminNotifications } });
      } catch (error) {
        console.error("Unable to record admin notification status", error);
      }
    });

    return NextResponse.json({
      ok: true,
      orderId: order.orderNumber,
      quotedAmount,
      currency: "NGN",
      emailAvailable: Boolean(user.email),
      referralCode,
      status: order.status,
      maxPages: MAX_PAGES,
      maxFileBytes: MAX_FILE_BYTES,
      conversionReady: Boolean(documentText || assignmentBriefReady),
      conversionSource,
      conversionWarning,
      source: hasFile ? (pastedContent ? "FILE_AND_PASTE" : "FILE") : assignmentBriefReady ? "PROMPT" : "PASTE",
    });
  } catch (error) {
    console.error("MongoDB order creation failed", error);
    return NextResponse.json({ error: "We could not create the order. Check the service configuration and try again." }, { status: 500 });
  }
}
