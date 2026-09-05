import { headers } from "next/headers";

/**
 * The per-request CSP nonce, for inline `<script>` elements we render.
 *
 * The policy is `script-src 'self' 'nonce-…' 'strict-dynamic'`, and CSP applies
 * to EVERY script element — including a `type="application/ld+json"` data block
 * that never executes. Without the nonce the block is refused, and a crawler
 * that renders with CSP enforced never sees the structured data.
 *
 * That failure is silent in the worst way: the markup is present in the HTML,
 * so viewing source and any test that greps the response body both pass, while
 * the rich result quietly never appears.
 *
 * `proxy.ts` sets `x-nonce` on the request; this reads it back.
 */
export async function cspNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
