import { env } from "@/lib/env";
import { ConsoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";
import type { EmailProvider } from "./types";

/**
 * The email provider, chosen once per process.
 *
 * Mirrors `getPaymentProvider`. The switch is exhaustive over the enum, so
 * adding a transport to `EMAIL_PROVIDER` without implementing it is a type
 * error rather than a silent fall-through to "console" — which is exactly how
 * `EMAIL_PROVIDER=smtp` came to mean "send nothing, look configured".
 */
let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;

  switch (env.EMAIL_PROVIDER) {
    case "resend":
      instance = new ResendEmailProvider();
      break;
    case "smtp":
      // Refused at startup by `assertProductionReady`, and refused here for
      // every other environment, so the switch can never be quietly ignored.
      throw new Error(
        "EMAIL_PROVIDER=smtp is selected but no SMTP transport is implemented. " +
          "Use `resend`, or implement this branch.",
      );
    case "console":
      instance = new ConsoleEmailProvider();
      break;
  }

  return instance;
}

export * from "./types";
