import type { Plate } from "@/lib/catalog";
import { cn } from "@/components/ui";

/**
 * The rating plate: the one number a machine is chosen by, set like the data
 * plate riveted to it. Styling lives in globals.css (.plate) because it is the
 * site's single signature device and must look identical everywhere it appears.
 */
export function RatingPlate({ plate, size = "md", className }: { plate: Plate; size?: "md" | "lg"; className?: string }) {
  return (
    <div className={cn("plate", size === "lg" && "px-4 py-2.5", className)}>
      <span className={cn("plate-value", size === "lg" && "text-[2.25rem]")}>{plate.value}</span>
      <span className="plate-label">{plate.label}</span>
    </div>
  );
}
