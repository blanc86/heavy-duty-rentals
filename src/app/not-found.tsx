import Link from "next/link";

/**
 * Root 404, for paths that resolve to no locale at all (for example /xyz).
 * It renders outside the locale layout, so it brings its own <html> and uses
 * inline styles and system fonts: nothing here depends on the rest of the site
 * having loaded correctly.
 */
export default function NotFound() {
  const link = { color: "#1b2430", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "4px" } as const;
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#1b2430", background: "#fff" }}>
        <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "5rem 1.5rem", lineHeight: 1.6 }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Page not found</h1>
          <p style={{ color: "#4b5664" }}>The page you&rsquo;re looking for isn&rsquo;t here.</p>
          <p>
            <Link href="/en" style={link}>
              Go to the home page
            </Link>
          </p>
          <div lang="ar" dir="rtl" style={{ marginTop: "3rem" }}>
            <h2 style={{ fontSize: "2rem", margin: 0 }}>الصفحة غير موجودة</h2>
            <p style={{ color: "#4b5664" }}>الصفحة التي تبحث عنها غير موجودة هنا.</p>
            <p>
              <Link href="/ar" style={link}>
                الصفحة الرئيسية
              </Link>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
