import { revalidatePath } from "next/cache";
import { connectMongoDB } from "@/lib/mongodb";
import { Delivery, Order, OrderFile, OrderMessage, Payment, Service, User } from "@/lib/models";
import { formToggleEnabled, parseReferenceStyle } from "@/lib/document-format-options";

export const dynamic = "force-dynamic";

const WORKFLOW_STATUSES = [
  "NEW",
  "REVIEW",
  "FORMAT_REQUIRED",
  "READY_TO_PRINT",
  "PRINTING",
  "READY",
  "COLLECTED",
  "CANCELLED",
] as const;

const ALL_STATUSES = new Set<string>([
  ...WORKFLOW_STATUSES,
  "AWAITING_PAYMENT",
  "PAID",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
]);

type OrderRow = {
  _id: unknown;
  orderNumber?: string;
  status?: string;
  userId?: unknown;
  serviceId?: unknown;
  referralCode?: string | null;
  documentTitle?: string | null;
  instructions?: string;
  pastedContent?: string | null;
  conversionSource?: string | null;
  conversionWarning?: string | null;
  adminNote?: string | null;
  quotedAmount?: number | null;
  currency?: string;
  printOption?: string;
  printType?: string;
  copies?: number;
  pages?: number;
  binding?: string;
  requestedFormat?: string;
  spacing?: string;
  formatPreset?: string;
  font?: string;
  fontSize?: number;
  citations?: boolean;
  references?: boolean;
  coverPage?: boolean;
  conversionRequested?: boolean;
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
  adminNotifications?: { whatsapp?: string; telegram?: string };
  createdAt?: Date | string;
};

type UserRow = { _id?: unknown; name?: string; whatsapp?: string } | null;
type ServiceRow = { _id?: unknown; name?: string } | null;
type PaymentRow = { orderId?: unknown; status?: string; amount?: number; reference?: string; paidAt?: Date | string } | null;
type FileRow = { orderId?: unknown; fileName?: string; storageKey?: string; mimeType?: string; sizeBytes?: number } | null;
type DeliveryRow = { orderId?: unknown; status?: string; location?: string; addressNote?: string } | null;
type OrderMessageRow = { _id?: unknown; orderId?: unknown; sender?: string; body?: string; createdAt?: Date | string; notificationStatus?: { whatsapp?: string; telegram?: string } };

function formatMoney(value?: number | null) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function whatsappLink(value?: string) {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : "";
}

function label(value?: string) {
  return (value || "—").replaceAll("_", " ").replaceAll("-", " ");
}

function aiActionLabel(mode?: string) {
  if (mode === "write-assignment") return "Write Assignment";
  if (mode === "rewrite" || mode === "rewrite-assignment") return "Rewrite Assignment";
  return "Proofread Assignment";
}

async function updateOrder(formData: FormData) {
  "use server";
  await connectMongoDB();

  const orderNumber = String(formData.get("orderNumber") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const adminNote = String(formData.get("adminNote") || "").trim().slice(0, 3000);
  const referenceStyle = parseReferenceStyle(formData.get("referenceStyle"));
  const removeEmptyParagraphs = formToggleEnabled(formData, "removeEmptyParagraphs");

  if (!orderNumber || !ALL_STATUSES.has(status)) return;

  await Order.updateOne(
    { orderNumber },
    { $set: {
      status,
      adminNote: adminNote || null,
      referenceStyle,
      apaFormatting: referenceStyle === "apa7",
      references: referenceStyle !== "none",
      removeEmptyParagraphs,
    } },
  );
  revalidatePath("/admin");
}

type AdminPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await connectMongoDB();
  const params = await searchParams;
  const search = String(params.q || "").trim().toLowerCase();
  const requestedStatus = String(params.status || "").trim().toUpperCase();
  const statusFilter = ALL_STATUSES.has(requestedStatus) ? requestedStatus : "";
  const whatsappNotificationsReady = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const telegramNotificationsReady = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID);
  const aiConfigured = Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL);

  const [total, students, rawOrders] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments({ role: "STUDENT" }),
    Order.find().sort({ createdAt: -1 }).limit(100).lean(),
  ]);

  const orders = rawOrders as unknown as OrderRow[];
  const counts = await Promise.all(WORKFLOW_STATUSES.map(status => Order.countDocuments({ status })));
  const countByStatus = new Map(WORKFLOW_STATUSES.map((status, index) => [status, counts[index]]));

  const orderIds = orders.map(order => order._id);
  const [userResults, serviceResults, paymentResults, fileResults, deliveryResults, messageResults] = await Promise.all([
    User.find({ _id: { $in: orders.map(order => order.userId).filter(Boolean) } }).lean().exec(),
    Service.find({ _id: { $in: orders.map(order => order.serviceId).filter(Boolean) } }).lean().exec(),
    Payment.find({ orderId: { $in: orderIds } }).lean().exec(),
    OrderFile.find({ orderId: { $in: orderIds } }).lean().exec(),
    Delivery.find({ orderId: { $in: orderIds } }).lean().exec(),
    OrderMessage.find({ orderId: { $in: orderIds }, sender: "CLIENT" }).sort({ createdAt: -1 }).lean().exec(),
  ]);
  const usersById = new Map((userResults as unknown as Exclude<UserRow, null>[]).map(item => [String(item._id), item]));
  const servicesById = new Map((serviceResults as unknown as Exclude<ServiceRow, null>[]).map(item => [String(item._id), item]));
  const paymentsByOrder = new Map((paymentResults as unknown as Exclude<PaymentRow, null>[]).map(item => [String(item.orderId), item]));
  const filesByOrder = new Map((fileResults as unknown as Exclude<FileRow, null>[]).map(item => [String(item.orderId), item]));
  const deliveriesByOrder = new Map((deliveryResults as unknown as Exclude<DeliveryRow, null>[]).map(item => [String(item.orderId), item]));
  const messagesByOrder = new Map<string, OrderMessageRow[]>();
  for (const message of messageResults as unknown as OrderMessageRow[]) {
    const key = String(message.orderId);
    messagesByOrder.set(key, [...(messagesByOrder.get(key) || []), message]);
  }

  const enriched = orders.map(order => ({
    ...order,
    user: usersById.get(String(order.userId)) || null,
    service: servicesById.get(String(order.serviceId)) || null,
    payment: paymentsByOrder.get(String(order._id)) || null,
    file: filesByOrder.get(String(order._id)) || null,
    delivery: deliveriesByOrder.get(String(order._id)) || null,
    clientMessages: messagesByOrder.get(String(order._id)) || [],
  }));

  const visibleOrders = enriched.filter(order => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (!search) return true;
    return [
      order.orderNumber,
      order.documentTitle,
      order.user?.name,
      order.user?.whatsapp,
      order.service?.name,
      order.file?.fileName,
    ].some(value => String(value || "").toLowerCase().includes(search));
  });

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <span className="badge">MABRIG PRINT SHOP • PRIVATE ADMIN</span>
          <h1>Printing Operations Dashboard</h1>
          <p>Review student documents, convert text to Word, manage formatting requests, payment details and production status.</p>
        </div>
        <div className="actions">
          <a className="btn conversion-btn" href="/admin/converter">⚡ Word Conversion Studio</a>
          <a className="btn secondary" href="/">Student Site</a>
          <a className="btn secondary" href="/academic-printing">Printing Service</a>
        </div>
      </header>

      <section className="admin-metrics">
        <article className="metric-card"><span>Total Orders</span><strong>{total}</strong></article>
        <article className="metric-card"><span>Students</span><strong>{students}</strong></article>
        <article className="metric-card metric-attention"><span>New</span><strong>{countByStatus.get("NEW") || 0}</strong><small>Needs first review</small></article>
        <article className="metric-card"><span>Ready to print</span><strong>{countByStatus.get("READY_TO_PRINT") || 0}</strong></article>
        <article className="metric-card metric-success"><span>Ready</span><strong>{countByStatus.get("READY") || 0}</strong><small>Awaiting collection</small></article>
      </section>

      <section className="admin-workspace">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-card">
            <span className="sidebar-eyebrow">FIND AN ORDER</span>
            <form method="get" className="admin-filter-form">
              <label>
                <span>Search</span>
                <input name="q" defaultValue={params.q || ""} placeholder="Order, student, phone or file" />
              </label>
              <label>
                <span>Status</span>
                <select name="status" defaultValue={statusFilter}>
                  <option value="">All statuses</option>
                  {Array.from(ALL_STATUSES).map(status => <option value={status} key={status}>{label(status)}</option>)}
                </select>
              </label>
              <button className="btn primary" type="submit">Filter orders</button>
              {(search || statusFilter) && <a className="admin-clear-filter" href="/admin">Clear filters</a>}
            </form>
          </div>

          <div className="admin-sidebar-card admin-tools-card">
            <span className="sidebar-eyebrow">DOCUMENT TOOLS</span>
            <h3>Clean and reference</h3>
            <p>Each order now has controls for removing empty spaces and applying APA 7 or MLA 9 reference layout before Word download.</p>
            <ul>
              <li><strong>APA 7:</strong> References, double spacing and hanging indents.</li>
              <li><strong>MLA 9:</strong> Works Cited, surname/page header and hanging indents.</li>
              <li><strong>Cleanup:</strong> removes blank paragraphs while preserving real text.</li>
            </ul>
            <div className="admin-channel-status">
              <span className={whatsappNotificationsReady ? "ready" : "missing"}>WhatsApp {whatsappNotificationsReady ? "ready" : "needs credentials"}</span>
              <span className={telegramNotificationsReady ? "ready" : "missing"}>Telegram {telegramNotificationsReady ? "ready" : "needs chat ID"}</span>
            </div>
            <a className="btn conversion-btn" href="/admin/converter">Open Conversion Studio</a>
          </div>

          <div className="admin-sidebar-card admin-status-list">
            <span className="sidebar-eyebrow">WORK QUEUE</span>
            {WORKFLOW_STATUSES.map(status => (
              <a href={`/admin?status=${status}`} key={status} className={statusFilter === status ? "active" : ""} aria-current={statusFilter === status ? "page" : undefined}>
                <span>{label(status)}</span><strong>{countByStatus.get(status) || 0}</strong>
              </a>
            ))}
          </div>
        </aside>

        <div className="admin-orders">
          <div className="admin-section-title">
            <div><h2>{search || statusFilter ? "Filtered Orders" : "Latest Orders"}</h2><p>Showing {visibleOrders.length} of the 100 most recent orders.</p></div>
          </div>

        {visibleOrders.length === 0 && <div className="card"><p>No orders match this search or status.</p></div>}

        {visibleOrders.map(order => {
          const wa = whatsappLink(order.user?.whatsapp);
          const content = order.pastedContent?.trim() || "";
          const writingAssignment = order.transformationMode === "write-assignment";
          const unnFormatting = (order.formatPreset || "unn") === "unn" && !["apa", "mla"].includes(order.referenceStyle || "none");
          const currentStatus = order.status || "NEW";
          const selectableStatus = ALL_STATUSES.has(currentStatus) ? currentStatus : "NEW";
          const formatDownloadReady = Boolean(content && order.orderNumber);
          const aiDownloadReady = Boolean(
            order.orderNumber &&
            order.transformationMode !== "format" &&
            (content || (writingAssignment && order.documentTitle && order.instructions)),
          );
          const conversionReady = formatDownloadReady || aiDownloadReady;
          const hasSubmittedFile = Boolean(order.file && order.orderNumber);
          const originalDownloadReady = Boolean(hasSubmittedFile && order.file?.storageKey?.startsWith("mongodb/"));
          const referenceStyle = parseReferenceStyle(order.referenceStyle || (order.apaFormatting ? "apa7" : "none"));

          return (
            <article className="admin-order-card" key={String(order._id)}>
              <div className="admin-order-head">
                <div>
                  <span className="order-number">{order.orderNumber || "Unknown order"}</span>
                  <h3>{order.user?.name || "Unknown student"}</h3>
                  <p>{order.documentTitle || order.service?.name || "Academic Document Printing"}</p>
                </div>
                <div className="order-head-right">
                  <span className={`status-pill status-${currentStatus.toLowerCase()}`}>{label(currentStatus)}</span>
                  <strong>{formatMoney(order.quotedAmount)}</strong>
                </div>
              </div>

              <div className="admin-detail-grid">
                <div><span>WhatsApp</span><strong>{order.user?.whatsapp || "—"}</strong>{wa && <a href={wa} target="_blank" rel="noreferrer">Message student</a>}</div>
                <div><span>Pages / Copies</span><strong>{order.pages || 1} pages × {order.copies || 1}</strong></div>
                <div><span>Print</span><strong>{label(order.printType)} • {label(order.printOption)}</strong></div>
                <div><span>Binding</span><strong>{label(order.binding)}</strong></div>
                <div><span>Formatting</span><strong>{label(order.formatPreset || "UNN")} • {unnFormatting ? "Times New Roman 12pt" : `${order.font || "Times New Roman"} ${order.fontSize || 12}pt`} • {order.spacing || "1.5"} spacing</strong></div>
                <div><span>Requested output</span><strong>{order.requestedFormat || "DOCX"}</strong></div>
                <div><span>Academic options</span><strong>{[order.citations && "Citations", order.references && "References", order.coverPage && "Cover page", order.conversionRequested && "Convert/format"].filter(Boolean).join(" • ") || "None selected"}</strong></div>
                <div><span>Text treatment</span><strong>{order.transformationMode && order.transformationMode !== "format" ? aiActionLabel(order.transformationMode) : "Format only"}</strong></div>
                <div><span>Paragraph layout</span><strong>{label(order.bodyAlignment || "JUSTIFIED")} • {label(order.paragraphIndentation || "FIRST-LINE")}</strong></div>
                <div><span>Heading / pages</span><strong>{label(order.headingPreset || "ACADEMIC")} • {label(order.pageNumberPosition || "FOOTER-CENTER")}</strong></div>
                <div><span>Advanced Word options</span><strong>{[order.automaticTableOfContents && "Contents page", referenceStyle !== "none" && label(referenceStyle), order.widowOrphanControl !== false && "Widow/orphan control"].filter(Boolean).join(" • ") || "None selected"}</strong></div>
                <div><span>Header / footer</span><strong>{[order.headerText && `Header: ${order.headerText}`, order.footerText && `Footer: ${order.footerText}`].filter(Boolean).join(" • ") || "No custom text"}</strong></div>
                <div><span>Cleanup</span><strong>{[order.boldHeadings !== false && "Bold headings", order.cleanSpecialCharacters !== false && "Special-character cleanup", order.removeEmptyParagraphs !== false && "Empty-space cleanup"].filter(Boolean).join(" • ") || "Disabled"}</strong></div>
                <div><span>Conversion source</span><strong>{order.conversionSource ? label(order.conversionSource) : content ? "PASTE / LEGACY TEXT" : "NOT READY"}</strong></div>
                <div><span>Payment</span><strong>{order.payment?.status || "NO PAYMENT RECORD"}</strong>{order.payment?.reference && <small>{order.payment.reference}</small>}</div>
                <div><span>Delivery</span><strong>{order.delivery ? `${order.delivery.location || "Campus"} • ${order.delivery.status || "PENDING"}` : "No delivery"}</strong>{order.delivery?.addressNote && <small>{order.delivery.addressNote}</small>}</div>
                <div><span>Admin notifications</span><strong>WhatsApp: {label(order.adminNotifications?.whatsapp || "not_configured")} • Telegram: {label(order.adminNotifications?.telegram || "not_configured")}</strong></div>
                <div><span>Submitted</span><strong>{order.createdAt ? new Date(order.createdAt).toLocaleString("en-NG") : "—"}</strong></div>
              </div>

              <div className={`conversion-panel ${conversionReady ? "conversion-panel-ready" : ""}`}>
                <div>
                  <span className="conversion-power-badge">⚡ WORD CONVERSION ENGINE</span>
                  <h4>{conversionReady ? "This order is ready for instant Word generation" : "Automatic Word generation is not ready for this order"}</h4>
                  <p>
                    {conversionReady
                      ? writingAssignment && !content
                        ? `The topic and assignment brief are ready for AI drafting in the default UNN Word format.`
                        : `Download a clean .docx using ${order.font || "Times New Roman"}, ${order.fontSize || 12}pt and ${order.spacing || "1.5"} spacing. Standard formatting works without AI.`
                      : "Older uploads or unsupported file types may not contain stored convertible text. Use the Conversion Studio and paste the text manually."}
                  </p>
                  {order.conversionWarning && <small className="conversion-warning">{order.conversionWarning}</small>}
                </div>
                <div className="conversion-panel-actions">
                  {formatDownloadReady && <a className="btn conversion-btn" href={`/api/admin/orders/${encodeURIComponent(order.orderNumber || "")}/word?mode=format`}>Download Formatted Word (.docx)</a>}
                  {aiDownloadReady && aiConfigured && <a className="btn secondary" href={`/api/admin/orders/${encodeURIComponent(order.orderNumber || "")}/word?mode=ai`}>AI {aiActionLabel(order.transformationMode)} (.docx)</a>}
                  {aiDownloadReady && !aiConfigured && <span className="btn admin-file-disabled" title="Configure AI_API_KEY, AI_BASE_URL and AI_MODEL to enable AI editing.">AI assignment feature unavailable</span>}
                  {originalDownloadReady && <a className="btn secondary" href={`/api/admin/orders/${encodeURIComponent(order.orderNumber || "")}/file`}>Download Uploaded Original (Unformatted)</a>}
                  {hasSubmittedFile && !originalDownloadReady && <span className="btn admin-file-disabled" title="Older submissions did not retain the original file bytes.">Uploaded original unavailable — legacy order</span>}
                  <a className="btn secondary" href="/admin/converter">Open Conversion Studio</a>
                </div>
              </div>

              <div className="admin-document-row">
                <div className="admin-doc-box">
                  <h4>Student instructions</h4>
                  <p className="preserve-text">{order.instructions || "No instructions supplied."}</p>
                </div>

                <div className="admin-doc-box">
                  <h4>Uploaded file</h4>
                  {order.file ? <>
                    <p><strong>{order.file.fileName || "Uploaded file"}</strong></p>
                    <small>{order.file.mimeType || "Unknown type"} • {order.file.sizeBytes ? `${Math.ceil(order.file.sizeBytes / 1024)} KB` : "size unknown"}</small>
                    {originalDownloadReady
                      ? <a className="btn admin-file-download" href={`/api/admin/orders/${encodeURIComponent(order.orderNumber || "")}/file`}>Download uploaded original (unformatted)</a>
                      : <p className="admin-file-unavailable">Legacy metadata only — original file was not retained.</p>}
                  </> : <p>No file uploaded.</p>}
                </div>
              </div>

              {order.clientMessages.length > 0 && <section className="admin-client-messages">
                <h4>New client instructions ({order.clientMessages.length})</h4>
                {order.clientMessages.slice(0, 10).map(message => <div className="admin-client-message" key={String(message._id)}>
                  <small>{message.createdAt ? new Date(message.createdAt).toLocaleString("en-NG") : "Recently received"} • WhatsApp: {label(message.notificationStatus?.whatsapp || "not_configured")} • Telegram: {label(message.notificationStatus?.telegram || "not_configured")}</small>
                  <p>{message.body}</p>
                </div>)}
              </section>}

              {content && (
                <details className="pasted-document">
                  <summary>View convertible student document text</summary>
                  <div className="pasted-document-content">{content}</div>
                </details>
              )}

              <form action={updateOrder} className="admin-action-form">
                <input type="hidden" name="orderNumber" value={order.orderNumber || ""} />
                <label>
                  <span>Production status</span>
                  <select name="status" defaultValue={selectableStatus}>
                    {Array.from(ALL_STATUSES).map(status => <option value={status} key={status}>{label(status)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Referencing style</span>
                  <select name="referenceStyle" defaultValue={referenceStyle}>
                    <option value="none">No prescribed style</option>
                    <option value="apa7">APA 7 — References</option>
                    <option value="mla9">MLA 9 — Works Cited</option>
                  </select>
                </label>
                <label className="admin-cleanup-toggle">
                  <input type="hidden" name="removeEmptyParagraphs" value="off" />
                  <input type="checkbox" name="removeEmptyParagraphs" value="on" defaultChecked={order.removeEmptyParagraphs !== false} />
                  <span>Remove empty spaces / blank paragraphs</span>
                </label>
                <label className="admin-note-field">
                  <span>Printer / admin note</span>
                  <textarea name="adminNote" defaultValue={order.adminNote || ""} placeholder="Formatting issues, collection note, print instructions, follow-up..." />
                </label>
                <button className="btn primary" type="submit">Save Order Update</button>
              </form>
            </article>
          );
        })}
        </div>
      </section>
    </main>
  );
}
