import { env } from "@/lib/env";
import { MockPaymentProvider } from "./mock-provider";
import { MoyasarProvider } from "./moyasar-provider";
import type { PaymentProvider } from "./types";

let instance: PaymentProvider | null = null;

/**
 * Resolve the configured payment provider.
 *
 * Selection is server-side and environment-driven. The browser never chooses a
 * provider, and never learns anything about the provider beyond which payment
 * methods to render.
 */
export function getPaymentProvider(): PaymentProvider {
  if (instance) return instance;

  switch (env.PAYMENT_PROVIDER) {
    case "moyasar":
      instance = new MoyasarProvider();
      break;
    case "mock":
      instance = new MockPaymentProvider();
      break;
  }

  return instance;
}

/** Test seam. */
export function __setPaymentProvider(provider: PaymentProvider | null): void {
  instance = provider;
}

export * from "./types";
export { MockPaymentProvider } from "./mock-provider";
export { MoyasarProvider } from "./moyasar-provider";
