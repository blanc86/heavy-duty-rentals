import { env } from "@/lib/env";
import { EmailDeliveryError, type EmailMessage, type EmailProvider, type EmailSendResult } from "./types";

/**
 * Resend (https://resend.com).
 *
 * Called over plain `fetch` rather than their SDK: the API used here is a
 * single POST, and a dependency that ships its own HTTP client is weight this
 * does not need. It also keeps the surface small enough to read.
 *
 * A verified sending DOMAIN is required to reach arbitrary recipients. Without
 * one, Resend accepts mail only to the account holder's own address — so a
 * deployment that has not completed DNS verification will appear to work in
 * testing and silently fail for every real customer. The failure comes back as
 * a 4xx with a message saying so, which is recorded on the notification row
 * rather than swallowed.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly delivers = true;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      // Unreachable via the factory, which refuses to build this provider
      // without a key. Kept so the class is safe if constructed directly.
      throw new EmailDeliveryError("RESEND_API_KEY is not set.");
    }

    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
        // A hung mail API must not hold a webhook open. The booking is already
        // confirmed by this point; the email is the part allowed to be late.
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new EmailDeliveryError(
        error instanceof Error ? `Resend request failed: ${error.message}` : "Resend request failed.",
      );
    }

    const body = (await response.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!response.ok) {
      // Resend's own message is kept verbatim: "domain is not verified" and
      // "you can only send to your own address" are the two that actually
      // happen, and both are worth reading in full on the notification row.
      throw new EmailDeliveryError(
        `Resend rejected the message (${response.status}): ${body?.message ?? body?.name ?? "no detail"}`,
      );
    }

    return { providerMessageId: body?.id ?? null };
  }
}
