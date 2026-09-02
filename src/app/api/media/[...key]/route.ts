import { NextResponse } from "next/server";

/**
 * Media delivery.
 *
 * Object keys are SERVER-GENERATED UUIDs with no user-controlled component, so
 * key enumeration and path traversal are both structurally impossible rather
 * than filtered against.
 *
 * The seed ships no binary image files (a repository is the wrong place for
 * them), so this returns a neutral SVG placeholder. Wiring real storage means
 * implementing the StorageProvider boundary and returning a short-lived signed
 * URL — see docs/ARCHITECTURE.md §9.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;

  // Defence in depth: even though keys are server-generated, reject anything
  // that looks like traversal before it is used for anything.
  if (key.some((segment) => segment.includes("..") || segment.includes("\\"))) {
    return new NextResponse(null, { status: 400 });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="Equipment photograph placeholder">
  <rect width="800" height="600" fill="#e8eaee"/>
  <g fill="none" stroke="#a9b0bd" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M120 470h560M220 470V250l180-140v360M400 250h200v220"/>
  </g>
  <text x="400" y="540" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="#6b7280">
    Equipment photo placeholder
  </text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      // A placeholder is inert, but the header costs nothing and prevents any
      // future content-sniffing surprise.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
