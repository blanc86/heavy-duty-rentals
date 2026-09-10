import { formatDate, type Locale } from "@/lib/i18n/config";
import { formatMoney, type Halalas } from "@/lib/money";

/**
 * Booking confirmation.
 *
 * Written as plain text first, because that is what actually arrives: it
 * renders everywhere, survives every client, and is what a screen reader and a
 * spam filter both read. The HTML version carries the same words in the same
 * order and adds nothing the text version lacks.
 *
 * The reference is stated twice — near the top and again beside the link —
 * because it is the customer's only way back into the booking. There are no
 * accounts, so a lost reference means a phone call.
 */

export interface BookingConfirmationVars {
  reference: string;
  customerName: string;
  className: string;
  startDate: Date;
  endDate: Date;
  siteCity: string | null;
  chargedHalalas: Halalas;
  depositHalalas: Halalas;
  currency: string;
  bookingUrl: string;
  companyName: string;
  companyPhone: string;
}

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const COPY = {
  en: {
    subject: (ref: string) => `Booking confirmed — ${ref}`,
    greeting: (name: string) => `Hello ${name},`,
    confirmed: "Your rental is confirmed and the machine is reserved for your dates.",
    contactSoon:
      "One of our team will contact you shortly to arrange delivery access, timing and the handover.",
    referenceLabel: "Booking reference",
    keepReference:
      "Keep this reference. You do not have an account with us — the reference and this email address are how you reopen this booking.",
    equipment: "Equipment",
    dates: "Rental period",
    site: "Delivery site",
    chargedNow: "Charged now",
    deposit: "Refundable deposit (authorised at handover, not charged today)",
    viewBooking: "View your booking",
    questions: "Questions? Reply to this email or call",
    signOff: (company: string) => `— ${company}`,
  },
  ar: {
    subject: (ref: string) => `تم تأكيد الحجز — ${ref}`,
    greeting: (name: string) => `مرحبًا ${name}،`,
    confirmed: "تم تأكيد إيجارك وحجز المعدة للتواريخ المحددة.",
    contactSoon:
      "سيتواصل معك أحد أفراد فريقنا قريبًا لترتيب الوصول إلى الموقع والتوقيت وتسليم المعدة.",
    referenceLabel: "مرجع الحجز",
    keepReference:
      "احتفظ بهذا المرجع. لا يوجد لديك حساب لدينا — المرجع وعنوان البريد هذا هما وسيلتك لفتح هذا الحجز مجددًا.",
    equipment: "المعدة",
    dates: "فترة الإيجار",
    site: "موقع التسليم",
    chargedNow: "المبلغ المدفوع الآن",
    deposit: "مبلغ تأمين مسترد (يُحجز عند التسليم ولا يُخصم اليوم)",
    viewBooking: "عرض حجزك",
    questions: "لديك سؤال؟ رد على هذا البريد أو اتصل بنا على",
    signOff: (company: string) => `— ${company}`,
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBookingConfirmation(
  locale: Locale,
  v: BookingConfirmationVars,
): RenderedEmail {
  const c = COPY[locale];
  const money = (amount: Halalas) => formatMoney(amount, locale, v.currency);
  const period = `${formatDate(v.startDate, locale)} — ${formatDate(v.endDate, locale)}`;

  const rows: [string, string][] = [
    [c.referenceLabel, v.reference],
    [c.equipment, v.className],
    [c.dates, period],
    ...(v.siteCity ? ([[c.site, v.siteCity]] as [string, string][]) : []),
    [c.chargedNow, money(v.chargedHalalas)],
    ...(v.depositHalalas > 0n
      ? ([[c.deposit, money(v.depositHalalas)]] as [string, string][])
      : []),
  ];

  const text = [
    c.greeting(v.customerName),
    "",
    c.confirmed,
    c.contactSoon,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    c.keepReference,
    "",
    `${c.viewBooking}: ${v.bookingUrl}`,
    "",
    `${c.questions} ${v.companyPhone}`,
    c.signOff(v.companyName),
  ].join("\n");

  // Inline styles only, and a table for layout: every mail client strips
  // <style> blocks and most still have no flexbox worth relying on.
  const dir = locale === "ar" ? "rtl" : "ltr";
  const align = locale === "ar" ? "right" : "left";
  const html = `
<div dir="${dir}" style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1f23;max-width:560px;margin:0 auto;padding:24px;text-align:${align}">
  <p>${escapeHtml(c.greeting(v.customerName))}</p>
  <p><strong>${escapeHtml(c.confirmed)}</strong></p>
  <p>${escapeHtml(c.contactSoon)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:20px 0">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e6e8eb;color:#5b6470;text-align:${align}">${escapeHtml(label)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e6e8eb;font-weight:600;text-align:${locale === "ar" ? "left" : "right"}">${escapeHtml(value)}</td>
    </tr>`,
      )
      .join("\n    ")}
  </table>
  <p style="background:#f5f6f7;padding:12px 14px;border-radius:6px">${escapeHtml(c.keepReference)}</p>
  <p><a href="${escapeHtml(v.bookingUrl)}" style="display:inline-block;background:#f5a623;color:#1c1f23;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:6px">${escapeHtml(c.viewBooking)}</a></p>
  <p style="color:#5b6470;font-size:13px">${escapeHtml(c.questions)} ${escapeHtml(v.companyPhone)}<br>${escapeHtml(c.signOff(v.companyName))}</p>
</div>`.trim();

  return { subject: c.subject(v.reference), text, html };
}
