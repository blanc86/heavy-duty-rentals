import { BUSINESS } from "@/content/business";

/**
 * Contact links.
 *
 * Every call, WhatsApp and email action on the site is built here, from the
 * single set of details in `content/business.ts`. Building them in one place is
 * what keeps a phone number from being right in the header and stale in the
 * footer — the failure that costs an enquiry silently, because nobody reports a
 * link that dials the wrong office.
 */

/** `tel:` link in E.164 form, which every mobile dialler accepts. */
export function telHref(digits: string = BUSINESS.phone.digits): string {
  return `tel:+${digits.replace(/\D/g, "")}`;
}

/**
 * WhatsApp click-to-chat link.
 *
 * `wa.me/<digits>` with the number in international form and NO "+", leading
 * zeros or separators — WhatsApp rejects anything else as an invalid number.
 * The optional message is prefilled in the chat, so an enquiry arrives already
 * naming the machine rather than starting with "hi".
 */
export function whatsappHref(message?: string, digits: string = BUSINESS.whatsapp.digits): string {
  const number = digits.replace(/\D/g, "");
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}

/**
 * `mailto:` link with an optional subject and body.
 *
 * Encoded with encodeURIComponent, not URLSearchParams: the latter writes spaces
 * as "+", which several mail clients (Outlook included) show literally.
 */
export function mailtoHref(
  options: { subject?: string; body?: string } = {},
  address: string = BUSINESS.email,
): string {
  const params = [
    options.subject ? `subject=${encodeURIComponent(options.subject)}` : null,
    options.body ? `body=${encodeURIComponent(options.body)}` : null,
  ].filter(Boolean);
  return params.length > 0 ? `mailto:${address}?${params.join("&")}` : `mailto:${address}`;
}
