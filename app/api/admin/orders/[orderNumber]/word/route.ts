import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { Order, Service, User } from "@/lib/models";
import { buildAcademicWordDocument } from "@/lib/word-document";
import {
  DocumentTransformationError,
  parseDocumentTransformationMode,
  transformAcademicText,
} from "@/lib/ai-document-transform";
import {
  parseBodyAlignment,
  parseDocumentLineSpacing,
  parseFormatPreset,
  parseHeadingPreset,
  parsePageNumberPosition,
  parseParagraphIndentation,
  parseReferenceStyle,
} from "@/lib/document-format-options";
import { attachmentContentDisposition, safeAttachmentFilename } from "@/lib/download-filename";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

type OrderDoc = {
  orderNumber?: string;
  documentTitle?: string | null;
  userId?: unknown;
  serviceId?: unknown;
  pastedContent?: string | null;
  instructions?: string;
  font?: string;
  fontSize?: number;
  spacing?: string;
  formatPreset?: string;
  pages?: number;
  citations?: boolean;
  coverPage?: boolean;
  references?: boolean;
  transformationMode?: string;
  bodyAlignment?: string;
  paragraphIndentation?: string;
  boldHeadings?: boolean;
  cleanSpecialCharacters?: boolean;
  pageNumberPosition?: string;
  headingPreset?: string;
  headerText?: string | null;
  footerText?: string | null;
  automaticTableOfContents?: boolean;
  apaFormatting?: boolean;
  referenceStyle?: string;
  removeEmptyParagraphs?: boolean;
  widowOrphanControl?: boolean;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber || "").trim();
    if (!orderNumber) return NextResponse.json({ error: "Order number is required." }, { status: 400 });

    await connectMongoDB();
    const result = await Order.findOne({ orderNumber }).lean().exec();
    const order = result as OrderDoc | null;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const text = order.pastedContent?.trim() || "";

    const [userResult, serviceResult] = await Promise.all([
      User.findById(order.userId).lean().exec(),
      Service.findById(order.serviceId).lean().exec(),
    ]);

    const user = userResult as { name?: string } | null;
    const service = serviceResult as { name?: string } | null;
    const title = order.documentTitle || service?.name || "Academic Document";
    const requestedMode = new URL(request.url).searchParams.get("mode");
    const transformationMode = requestedMode === "ai"
      ? parseDocumentTransformationMode(order.transformationMode)
      : "format";
    const writingAssignment = transformationMode === "write-assignment";
    if (!text && !writingAssignment) {
      return NextResponse.json(
        { error: "This order has no stored convertible text. Ask the student to paste the text or submit a new supported upload." },
        { status: 409 },
      );
    }
    if (writingAssignment && !order.documentTitle?.trim() && !order.instructions?.trim()) {
      return NextResponse.json({ error: "This assignment order has no topic or writing brief." }, { status: 409 });
    }
    const transformed = await transformAcademicText({
      text,
      title,
      mode: transformationMode,
      instructions: order.instructions || "",
      targetPages: order.pages || 3,
      citationsRequested: Boolean(order.citations),
      referencesRequested: Boolean(order.references),
    });

    const formatPreset = parseFormatPreset(order.formatPreset);
    const spacing = formatPreset === "unn" ? "2.0" : parseDocumentLineSpacing(order.spacing);
    const buffer = await buildAcademicWordDocument({
      text: transformed.text,
      title,
      studentName: user?.name || "",
      orderNumber: order.orderNumber || orderNumber,
      font: order.font || "Times New Roman",
      fontSize: order.fontSize || 12,
      spacing,
      formatPreset,
      coverPage: Boolean(order.coverPage),
      references: Boolean(order.references),
      bodyAlignment: parseBodyAlignment(order.bodyAlignment),
      paragraphIndentation: parseParagraphIndentation(order.paragraphIndentation),
      boldHeadings: order.boldHeadings !== false,
      cleanSpecialCharacters: order.cleanSpecialCharacters !== false,
      pageNumberPosition: parsePageNumberPosition(order.pageNumberPosition),
      headingPreset: parseHeadingPreset(order.headingPreset),
      headerText: order.headerText || "",
      footerText: order.footerText || "",
      automaticTableOfContents: Boolean(order.automaticTableOfContents),
      apaFormatting: Boolean(order.apaFormatting),
      referenceStyle: parseReferenceStyle(order.referenceStyle || (order.apaFormatting ? "apa7" : "none")),
      removeEmptyParagraphs: order.removeEmptyParagraphs !== false,
      widowOrphanControl: order.widowOrphanControl !== false,
    });

    const outputLabel = transformationMode === "format" ? "formatted" : transformationMode;
    const filename = safeAttachmentFilename(
      `${title}-${user?.name || "student"}-${order.orderNumber || orderNumber}-${outputLabel}`,
      { extension: ".docx", fallback: "formatted-academic-document" },
    );
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": attachmentContentDisposition(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Text-Transformation": transformationMode,
        "X-Text-Changed": transformed.changed ? "true" : "false",
        "X-AI-Used": transformationMode === "format" ? "false" : "true",
      },
    });
  } catch (error) {
    if (error instanceof DocumentTransformationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Order Word generation failed", error);
    return NextResponse.json({ error: "Unable to generate the Word document." }, { status: 500 });
  }
}
