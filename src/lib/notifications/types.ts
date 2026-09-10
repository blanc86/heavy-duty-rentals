import type { Locale } from "@/lib/i18n/config";

/**
 * Transactional email.
 *
 * Deliberately narrow: one recipient, one message, no batching, no marketing.
 * Everything this application sends is the direct consequence of something a
 * customer just did, which is what makes it lawful to send without stored
 * marketing consent (PDPL draws that line, and `notification.is_marketing`
 * records which side a send falls on).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. Always present — it is the accessible and deliverable form. */
  text: string;
  /** Optional HTML. A client that cannot render it falls back to `text`. */
  html?: string;
  locale: Locale;
}

export interface EmailSendResult {
  /** Provider's id for the message, stored so a delivery query can be traced. */
  providerMessageId: string | null;
}

export interface EmailProvider {
  readonly name: string;
  /**
   * True when this provider actually puts mail on the wire. The console driver
   * returns false, so callers can tell "sent" from "written to a log" without
   * inspecting the provider's type — and the UI can avoid promising a customer
   * an email that was never going to arrive.
   */
  readonly delivers: boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Thrown for a provider-side failure. Never allowed to fail the caller's work. */
export class EmailDeliveryError extends Error {
  readonly code = "email_delivery_failed";
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}
