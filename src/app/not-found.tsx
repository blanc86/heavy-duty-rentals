import Link from "next/link";

/**
 * Root 404. Reached only for paths outside any locale (a bad /api/* URL, for
 * example) — locale-aware 404s live in app/[locale]/not-found.tsx.
 */
export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Page not found</h1>
        <p style={{ marginTop: "0.5rem", color: "#555" }}>
          The page you&rsquo;re looking for doesn&rsquo;t exist.
        </p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/en" style={{ textDecoration: "underline" }}>
            Go to homepage
          </Link>
        </p>
      </body>
    </html>
  );
}
