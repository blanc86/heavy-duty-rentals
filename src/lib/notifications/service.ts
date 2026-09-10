import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { uuidv7 } from "@/lib/ids";
import type { Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings";
import { getEmailProvider } from "./index";
import { renderBookingConfirmation } from "./templates";

/**
 * Transactional sends.
 *
 * Two rules hold everywhere in this file:
 *
 * 1. **A send may never fail the thing it reports on.** By the time a
 *    confirmation is sent, the customer's card has been charged and the machine
 *    is reserved. An unreachable mail API must not turn that into a 500 that
 *    makes the payment provider retry a webhook it already delivered. Every
 *    failure is caught, recorded, and swallowed.
 *
 * 2. **Every attempt leaves a row**, in `queued` -> `sent`/`failed`. Support's
 *    first question is "did they get the email", and the only honest answer
 *    comes from a record written at the time. The row holds template variables,
 *    never the rendered body — the body is full of PII and rows get exported.
 */

/** Written before dispatch so a crash mid-send still leaves evidence. */
async function queueNotification(params: {
  toAddress: string;
  userId: string | null;
  templateKey: string;
  locale: Locale;
  payload: Record<string, unknown>;
}): Promise<string> {
  const id = uuidv7();
  await db.execute(raw`
    INSERT INTO notification (id, user_id, to_address, channel, template_key, locale, payload, is_marketing, status)
    VALUES (${id}, ${params.userId}, ${params.toAddress}, 'email', ${params.templateKey},
            ${params.locale}::locale, ${JSON.stringify(params.payload)}::jsonb, FALSE, 'queued')
  `);
  return id;
}

async function markSent(id: string, providerMessageId: string | null): Promise<void> {
  await db.execute(raw`
    UPDATE notification SET status = 'sent', provider_message_id = ${providerMessageId}, sent_at = now()
    WHERE id = ${id}
  `);
}

async function markFailed(id: string, reason: string): Promise<void> {
  await db.execute(raw`
    UPDATE notification SET status = 'failed', failure_reason = ${reason.slice(0, 400)}
    WHERE id = ${id}
  `);
}

/**
 * `suppressed`, not `failed`: nothing went wrong, this deployment simply has no
 * mail transport. Distinguishing the two is what stops "no email configured"
 * from being investigated forever as a delivery bug.
 */
async function markSuppressed(id: string, reason: string): Promise<void> {
  await db.execute(raw`
    UPDATE notification SET status = 'suppressed', failure_reason = ${reason.slice(0, 400)}
    WHERE id = ${id}
  `);
}

/**
 * Confirm a booking by email.
 *
 * Called once, from the verified-webhook path, and only when the booking
 * actually moved into `confirmed` — so a replayed webhook cannot send a second
 * copy. Returns nothing: no caller's behaviour should depend on whether the
 * mail went out.
 */
export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  try {
    const rows = await db.execute<{
      reference: string;
      locale: Locale;
      start_date: string;
      end_date: string;
      site_city: string | null;
      charged_halalas: string;
      deposit_halalas: string;
      currency: string;
      customer_user_id: string;
      email: string;
      full_name: string;
      class_name_en: string | null;
      class_name_ar: string | null;
    }>(raw`
      SELECT b.reference, b.locale, b.start_date, b.end_date, b.site_city,
             (b.taxable_subtotal_halalas + b.vat_halalas)::text AS charged_halalas,
             b.deposit_halalas::text AS deposit_halalas, b.currency,
             b.customer_user_id, u.email, u.full_name,
             ec.name_en AS class_name_en, ec.name_ar AS class_name_ar
      FROM booking b
      JOIN "user" u ON u.id = b.customer_user_id
      LEFT JOIN booking_item bi ON bi.booking_id = b.id
      LEFT JOIN equipment_class ec ON ec.id = bi.class_id
      WHERE b.id = ${bookingId}
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) return;

    const locale: Locale = row.locale === "ar" ? "ar" : "en";
    const business = await getBusinessSettings();

    const notificationId = await queueNotification({
      toAddress: row.email,
      userId: row.customer_user_id,
      templateKey: "booking.confirmed",
      locale,
      payload: { bookingId, reference: row.reference },
    });

    const provider = getEmailProvider();

    const message = renderBookingConfirmation(locale, {
      reference: row.reference,
      customerName: row.full_name,
      className:
        (locale === "ar" ? row.class_name_ar : row.class_name_en) ?? row.reference,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      siteCity: row.site_city,
      chargedHalalas: BigInt(row.charged_halalas),
      depositHalalas: BigInt(row.deposit_halalas),
      currency: row.currency,
      bookingUrl: new URL(`/${locale}/booking/${row.reference}`, env.APP_URL).toString(),
      companyName: locale === "ar" ? business.companyNameAr : business.companyNameEn,
      companyPhone: business.phone,
    });

    try {
      const result = await provider.send({
        to: row.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
        locale,
      });

      if (provider.delivers) {
        await markSent(notificationId, result.providerMessageId);
      } else {
        await markSuppressed(
          notificationId,
          `EMAIL_PROVIDER=${provider.name} does not deliver mail; the message was logged instead.`,
        );
      }
    } catch (error) {
      await markFailed(
        notificationId,
        error instanceof Error ? error.message : "Unknown delivery failure.",
      );
    }
  } catch (error) {
    // The outer catch exists so that a fault in this function — a bad query, a
    // missing settings row, anything — cannot propagate into the webhook that
    // called it. The booking is already paid and confirmed; losing the email is
    // recoverable, telling the provider the webhook failed is not.
    console.error("[notifications] booking confirmation failed", error);
  }
}
