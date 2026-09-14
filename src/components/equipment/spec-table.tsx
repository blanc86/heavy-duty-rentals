import type { FormattedSpec } from "@/content/specs";

/**
 * Specifications as a definition list in two columns: label, value. A <dl>
 * rather than a <table> because each row is a single fact, not a record, and
 * screen readers announce the pairing correctly.
 */
export function SpecTable({ specs }: { specs: FormattedSpec[] }) {
  return (
    <dl className="divide-y divide-steel-200 border-y border-steel-200">
      {specs.map((spec) => (
        <div key={spec.key} className="grid grid-cols-[1fr_auto] gap-4 py-3">
          <dt className="text-steel-600">{spec.label}</dt>
          <dd className="font-semibold text-steel-900">
            <bdi className="ltr-nums">{spec.value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}
