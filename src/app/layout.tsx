import type { ReactNode } from "react";
import "./globals.css";

/**
 * Root layout.
 *
 * Deliberately minimal: <html> and <body> are emitted by the [locale] layout,
 * because `lang` and `dir` depend on the locale segment and must be correct in
 * the very first byte of HTML for both screen readers and RTL rendering.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
