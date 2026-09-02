import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { Readable } from "node:stream";

/**
 * Media delivery.
 *
 * Object keys are SERVER-GENERATED with no user-controlled component, so key
 * enumeration and path traversal are structurally impossible rather than
 * filtered against. The resolved path is nevertheless re-checked against the
 * media root before anything is read — defence in depth costs nothing here.
 *
 * Demo photography lives under `public/demo-equipment/`. Production should
 * serve from private object storage behind short-lived signed URLs instead;
 * see docs/ARCHITECTURE.md §9.
 */
const MEDIA_ROOT = path.resolve(process.cwd(), "public");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;

  // Reject anything traversal-shaped before it is used for anything at all.
  if (key.some((segment) => segment.includes("..") || segment.includes("\\") || segment.startsWith("."))) {
    return new NextResponse(null, { status: 400 });
  }

  const requested = path.resolve(MEDIA_ROOT, ...key);
  // The resolved path must still sit inside the media root. This catches any
  // traversal the segment check above did not.
  if (!requested.startsWith(MEDIA_ROOT + path.sep)) {
    return new NextResponse(null, { status: 400 });
  }

  const extension = path.extname(requested).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  // Only known image types are ever served, so an uploaded file cannot be
  // returned with a type that a browser would execute.
  if (!contentType) return new NextResponse(null, { status: 404 });

  try {
    const info = await stat(requested);
    if (!info.isFile()) return new NextResponse(null, { status: 404 });

    const stream = Readable.toWeb(createReadStream(requested)) as WebReadableStream<Uint8Array>;

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        // Never let a served media file run as script in our origin.
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
