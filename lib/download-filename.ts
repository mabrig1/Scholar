const DEFAULT_MAX_FILENAME_LENGTH = 120;

function safeExtension(value: string) {
  if (!value) return "";
  const withDot = value.startsWith(".") ? value : `.${value}`;
  return withDot.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
}

export function safeAttachmentFilename(
  value: string,
  options: { extension?: string; fallback?: string; maxLength?: number } = {},
) {
  const extension = safeExtension(options.extension || "");
  const fallback = options.fallback || "download";
  const maxLength = Math.max(extension.length + 8, options.maxLength || DEFAULT_MAX_FILENAME_LENGTH);
  const withoutKnownExtension = extension && value.toLowerCase().endsWith(extension.toLowerCase())
    ? value.slice(0, -extension.length)
    : value;
  const safeBase = withoutKnownExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const safeFallback = fallback
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || "download";
  const availableBaseLength = maxLength - extension.length;
  const base = (safeBase || safeFallback)
    .slice(0, availableBaseLength)
    .replace(/^[-.]+|[-.]+$/g, "") || safeFallback.slice(0, availableBaseLength);

  return `${base}${extension}`;
}

export function safeOriginalAttachmentFilename(value: string, fallback = "submitted-file") {
  const extension = value.match(/(\.[a-zA-Z0-9]{1,10})$/)?.[1] || "";
  return safeAttachmentFilename(value, { extension, fallback, maxLength: 140 });
}

export function attachmentContentDisposition(filename: string) {
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
