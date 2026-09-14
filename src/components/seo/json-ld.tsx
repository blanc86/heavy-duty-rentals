import { serializeJsonLd } from "@/lib/seo/json-ld";

/**
 * A JSON-LD block. `type="application/ld+json"` is a data block, not a script:
 * browsers never execute it, so it needs no CSP nonce and works on a statically
 * generated page.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
