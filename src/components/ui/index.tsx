import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Design system primitives.
 *
 * Server Components by default — none of these need interactivity, so none of
 * them ship JavaScript. That is most of why the public pages stay small on 4G.
 */

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-[--radius-control] " +
  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
  // 44px minimum touch target: these get pressed one-handed, on a site, in the sun.
  "min-h-[2.75rem] focus-visible:outline-2 focus-visible:outline-offset-2";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Safety amber is reserved for the single primary action on a view.
  primary: "bg-amber-500 text-steel-950 hover:bg-amber-400 active:bg-amber-600",
  secondary: "bg-steel-900 text-white hover:bg-steel-800 active:bg-steel-950",
  ghost: "bg-transparent text-steel-800 hover:bg-steel-100 border border-steel-300",
  danger: "bg-danger text-white hover:opacity-90",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5 min-h-[2.25rem]",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-6 py-3 min-h-[3rem]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[--radius-card] border border-steel-200 bg-white shadow-[--shadow-card]",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("border-b border-steel-200 px-4 py-3 sm:px-5", className)} {...props} />
  );
}

// ---------------------------------------------------------------------------
// Badge — status only, never decoration
// ---------------------------------------------------------------------------

type BadgeTone = "neutral" | "available" | "warning" | "danger" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-steel-100 text-steel-700 border-steel-200",
  available: "bg-[--color-available-bg] text-[--color-available] border-[--color-available]/25",
  warning: "bg-[--color-warning-bg] text-[--color-warning] border-[--color-warning]/25",
  danger: "bg-[--color-danger-bg] text-[--color-danger] border-[--color-danger]/25",
  info: "bg-[--color-info-bg] text-[--color-info] border-[--color-info]/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: BadgeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      // role="status" (not "alert") so a screen reader announces politely
      // rather than interrupting; these are informational, not emergencies.
      role="status"
      className={cn(
        "rounded-[--radius-card] border p-4 text-sm",
        BADGE_TONES[tone],
        className,
      )}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="[&_a]:underline">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

export function Label({
  required,
  className,
  children,
  ...props
}: ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-steel-800", className)} {...props}>
      {children}
      {required && (
        <span className="ms-1 text-danger" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

const FIELD_BASE =
  "w-full rounded-[--radius-control] border border-steel-300 bg-white px-3 py-2.5 text-sm " +
  "text-steel-900 placeholder:text-steel-400 min-h-[2.75rem] " +
  "focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 " +
  "disabled:bg-steel-100 disabled:text-steel-500 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FIELD_BASE, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(FIELD_BASE, "pe-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD_BASE, "min-h-[6rem] py-2", className)} {...props} />;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-steel-500">{children}</p>;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function SectionHeading({
  title,
  description,
  action,
  level = 2,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Tag = `h${level}` as const;
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Tag
          className={cn(
            "font-bold tracking-tight text-steel-950",
            level === 1 ? "text-2xl sm:text-3xl" : level === 2 ? "text-xl sm:text-2xl" : "text-lg",
          )}
        >
          {title}
        </Tag>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-steel-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Wide content (spec tables, comparison) scrolls inside itself, never the page. */
export function ScrollX({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("scroll-x -mx-4 px-4 sm:mx-0 sm:px-0", className)} {...props} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[--radius-card] border border-dashed border-steel-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-steel-800">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-steel-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Marks seeded demo records in the UI.
 *
 * The brief forbids implying that demo machines exist. Rather than trusting a
 * README to convey that, every seeded record carries `isDemoData` and renders
 * this badge.
 */
export function DemoBadge({ label }: { label: string }) {
  return (
    <Badge tone="warning" className="uppercase tracking-wide">
      {label}
    </Badge>
  );
}
