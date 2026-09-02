/**
 * Next.js startup hook.
 *
 * Runs once when the server process boots, before it accepts traffic. This is
 * where production readiness is enforced: the process is about to touch real
 * customer data, so a missing encryption key or a mock payment provider must
 * stop it here rather than surfacing as a confusing failure on the first
 * booking.
 *
 * Deliberately not done at module load in `env.ts`, because `next build`
 * imports every route module and a build agent has no reason to hold
 * production secrets.
 */
export async function register(): Promise<void> {
  // Only the Node.js server runtime needs this; the check is meaningless in
  // an edge or browser context.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertProductionReady } = await import("@/lib/env");
  assertProductionReady();
}
