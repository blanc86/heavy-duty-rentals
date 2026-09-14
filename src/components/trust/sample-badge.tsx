import { cn } from "@/components/ui";

/**
 * Marks content that is an illustrative sample rather than the business's own:
 * the demo projects and certificates. A dashed border reads as "placeholder"
 * without shouting, and it disappears by itself once an entry's `sample` flag
 * is false — which should only happen when the content is real.
 */
export function SampleBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-plate border border-dashed border-steel-400 bg-white px-2 py-0.5 text-xs font-semibold text-steel-700",
        className,
      )}
    >
      {label}
    </span>
  );
}
