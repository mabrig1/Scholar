import mammoth from "mammoth";

export type ExtractedDocumentText = {
  text: string | null;
  source: "TEXT" | "DOCX" | "PDF" | "UNSUPPORTED";
  warning?: string;
};

function extension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function normalize(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function extractDocumentText(file: File): Promise<ExtractedDocumentText> {
  const ext = extension(file.name || "");
  const mime = file.type || "";

  if (mime.startsWith("text/") || ext === ".txt" || ext === ".md") {
    return { text: normalize(await file.text()), source: "TEXT" };
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    return {
      text: normalize(result.value || ""),
      source: "DOCX",
      warning: result.messages.length ? "Some complex Word formatting may not be preserved during text extraction." : undefined,
    };
  }

  if (mime === "application/pdf" || ext === ".pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
    try {
      const result = await parser.getText();
      return {
        text: normalize(result.text || ""),
        source: "PDF",
        warning: "PDF conversion extracts readable text; complex tables, images and page layout may need printer review.",
      };
    } finally {
      await parser.destroy();
    }
  }

  return {
    text: null,
    source: "UNSUPPORTED",
    warning: "Automatic Word conversion is available for pasted text, TXT/Markdown, DOCX and text-based PDF uploads. Other file types still remain attached to the order metadata for manual handling.",
  };
}
