import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * Writes the message to the log instead of sending it.
 *
 * The default, and the honest one for a deployment with no mail account. It
 * reports `delivers: false`, so nothing downstream tells a customer their
 * confirmation is on its way when it is sitting in a server log — the failure
 * this replaces is a booking page that promises an email that never arrives.
 *
 * The body is logged because on a development machine that IS the inbox. It is
 * also why this must never be selected in production with real customers:
 * their names, sites and phone numbers would land in the platform's log store.
 * `assertProductionReady` warns when it is.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly delivers = false;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.warn(
      [
        "",
        "──────── EMAIL (not sent — console provider) ────────",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "─────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { providerMessageId: null };
  }
}
