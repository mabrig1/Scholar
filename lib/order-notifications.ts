import { sendTelegramDocument, sendTelegramMessage } from "./telegram";
import { sendWhatsAppDocument, sendWhatsAppText } from "./whatsapp";

type SubmittedFile = {
  data: Buffer;
  fileName: string;
  mimeType: string;
};

type OrderNotification = {
  orderNumber: string;
  studentName: string;
  studentWhatsapp: string;
  documentTitle?: string | null;
  submittedFile?: SubmittedFile | null;
};

export async function notifyAdminOfOrder(input: OrderNotification) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org").replace(/\/$/, "");
  const adminUrl = `${appUrl}/admin?q=${encodeURIComponent(input.orderNumber)}`;
  const message = [
    "NEW ACADEMIC DOCUMENT SUBMISSION",
    `Order: ${input.orderNumber}`,
    `Student: ${input.studentName}`,
    `WhatsApp: ${input.studentWhatsapp}`,
    input.documentTitle ? `Document: ${input.documentTitle}` : null,
    input.submittedFile ? `File: ${input.submittedFile.fileName}` : "Submission: pasted text",
    `Open admin: ${adminUrl}`,
  ].filter(Boolean).join("\n");

  const status = {
    whatsapp: "not_configured" as "sent" | "failed" | "not_configured",
    telegram: "not_configured" as "sent" | "failed" | "not_configured",
  };
  const jobs: Promise<void>[] = [];
  const whatsappNumber = (process.env.ADMIN_WHATSAPP_NUMBER || "2347065342818").replace(/\D/g, "");
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && whatsappNumber) {
    jobs.push((input.submittedFile
      ? sendWhatsAppDocument(whatsappNumber, input.submittedFile, message)
      : sendWhatsAppText(whatsappNumber, message))
      .then(() => { status.whatsapp = "sent"; })
      .catch(error => { status.whatsapp = "failed"; console.error("WhatsApp admin notification failed", error); }));
  }

  const telegramChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (process.env.TELEGRAM_BOT_TOKEN && telegramChatId) {
    jobs.push((input.submittedFile
      ? sendTelegramDocument(telegramChatId, input.submittedFile, message)
      : sendTelegramMessage(telegramChatId, message))
      .then(() => { status.telegram = "sent"; })
      .catch(error => { status.telegram = "failed"; console.error("Telegram admin notification failed", error); }));
  }

  await Promise.all(jobs);
  return status;
}

type ClientMessageNotification = {
  orderNumber: string;
  studentName: string;
  studentWhatsapp: string;
  message: string;
};

export async function notifyAdminOfClientMessage(input: ClientMessageNotification) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://academic.mabrigkorie.org").replace(/\/$/, "");
  const adminUrl = `${appUrl}/admin?q=${encodeURIComponent(input.orderNumber)}`;
  const text = [
    "NEW CLIENT INSTRUCTION",
    `Order: ${input.orderNumber}`,
    `Student: ${input.studentName}`,
    `WhatsApp: ${input.studentWhatsapp}`,
    "",
    input.message,
    "",
    `Open order: ${adminUrl}`,
  ].join("\n");

  const status = {
    whatsapp: "not_configured" as "sent" | "failed" | "not_configured",
    telegram: "not_configured" as "sent" | "failed" | "not_configured",
  };
  const jobs: Promise<void>[] = [];
  const whatsappNumber = (process.env.ADMIN_WHATSAPP_NUMBER || "2347065342818").replace(/\D/g, "");

  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && whatsappNumber) {
    jobs.push(sendWhatsAppText(whatsappNumber, text)
      .then(() => { status.whatsapp = "sent"; })
      .catch(error => { status.whatsapp = "failed"; console.error("WhatsApp client-instruction notification failed", error); }));
  }

  const telegramChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (process.env.TELEGRAM_BOT_TOKEN && telegramChatId) {
    jobs.push(sendTelegramMessage(telegramChatId, text)
      .then(() => { status.telegram = "sent"; })
      .catch(error => { status.telegram = "failed"; console.error("Telegram client-instruction notification failed", error); }));
  }

  await Promise.all(jobs);
  return status;
}
