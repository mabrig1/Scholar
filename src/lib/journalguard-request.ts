/** Limit request parsing by bytes read, even when Content-Length is absent. */
const MAX_REQUEST_BYTES = 8192;
export type JournalGuardInputError = { code: 400 | 413; message: string };
export async function parseBoundedJson(request: Request): Promise<unknown> {
  const header = request.headers.get("content-length");
  if (header !== null && (!/^\d+$/.test(header) || Number(header) > MAX_REQUEST_BYTES)) {
    throw { code: 413, message: "JournalGuard request too large" } satisfies JournalGuardInputError;
  }
  const reader = request.body?.getReader();
  if (!reader) throw { code: 400, message: "Request body required" } satisfies JournalGuardInputError;
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        void reader.cancel();
        throw { code: 413, message: "JournalGuard request too large" } satisfies JournalGuardInputError;
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return JSON.parse(Buffer.concat(parts.map(part => Buffer.from(part))).toString("utf8"));
  } catch {
    throw { code: 400, message: "Invalid JSON request" } satisfies JournalGuardInputError;
  }
}
