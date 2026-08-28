export type ParagraphIndentation = "none" | "first-line" | "first-line-wide";
export type BodyAlignment = "left" | "justified";
export type DocumentLineSpacing = "1.0" | "1.5" | "2.0";
export type HeadingPreset = "academic" | "apa7" | "compact";
export type PageNumberPosition = "none" | "header-right" | "footer-center" | "footer-right";
export type ReferenceStyle = "none" | "apa7" | "mla9";
export type FormatPreset = "unn" | "custom";

export function parseParagraphIndentation(value: unknown): ParagraphIndentation {
  return value === "none" || value === "first-line-wide" ? value : "first-line";
}

export function parseBodyAlignment(value: unknown): BodyAlignment {
  return value === "left" ? "left" : "justified";
}

export function parseDocumentLineSpacing(value: unknown): DocumentLineSpacing {
  if (value === "1.0" || value === "single") return "1.0";
  if (value === "2.0" || value === "double") return "2.0";
  return "1.5";
}

export function parseFormatPreset(value: unknown): FormatPreset {
  return value === "custom" ? "custom" : "unn";
}

export function parseHeadingPreset(value: unknown): HeadingPreset {
  return value === "apa7" || value === "compact" ? value : "academic";
}

export function parsePageNumberPosition(value: unknown): PageNumberPosition {
  return value === "none" || value === "header-right" || value === "footer-right"
    ? value
    : "footer-center";
}

export function parseReferenceStyle(value: unknown): ReferenceStyle {
  return value === "apa7" || value === "mla9" ? value : "none";
}

export function formToggleEnabled(form: FormData, name: string, fallback = true) {
  const values = form.getAll(name).map(value => String(value).toLowerCase());
  if (!values.length) return fallback;
  return values.some(value => value === "on" || value === "true" || value === "1");
}
