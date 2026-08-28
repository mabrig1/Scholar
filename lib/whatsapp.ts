export async function sendWhatsAppText(to: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp credentials are not configured");
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body: text } }),
  });
  if (!response.ok) throw new Error(`WhatsApp send failed: ${await response.text()}`);
}

export async function sendWhatsAppDocument(
  to: string,
  file: { data: Buffer; fileName: string; mimeType: string },
  caption: string,
) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp credentials are not configured");

  const upload = new FormData();
  upload.set("messaging_product", "whatsapp");
  upload.set("type", file.mimeType);
  upload.set("file", new Blob([new Uint8Array(file.data)], { type: file.mimeType }), file.fileName);
  const uploadResponse = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: upload,
  });
  if (!uploadResponse.ok) throw new Error(`WhatsApp media upload failed: ${await uploadResponse.text()}`);
  const media = await uploadResponse.json() as { id?: string };
  if (!media.id) throw new Error("WhatsApp media upload returned no media ID");

  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "document",
      document: { id: media.id, filename: file.fileName, caption: caption.slice(0, 1024) },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp document send failed: ${await response.text()}`);
}
