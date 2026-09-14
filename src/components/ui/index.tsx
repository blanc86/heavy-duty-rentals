import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)} {...props} />;
}

/**
 * Button styles.
 *
 * Four, each with one job. `primary` is machine yellow and appears once per
 * view; `whatsapp` is only ever a WhatsApp action; `outline` and `onDark` are
 * the quiet alternatives. Every size keeps a 48 px minimum height — these are
 * tapped by people standing on a site, often in gloves.
 */
const BUTTON_BASE =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-control px-5 text-[1rem] font-semibold leading-tight transition-colors duration-150 focus-visible:outline-offset-4";

export const BUTTON_VARIANTS = {
  primary: "bg-machine-500 text-steel-950 hover:bg-machine-400",
  whatsapp: "bg-whatsapp-600 text-white hover:bg-whatsapp-700",
  outline: "border border-steel-300 bg-white text-steel-900 hover:border-steel-900",
  onDark: "border border-white/35 text-white hover:border-white hover:bg-white/10",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function buttonClass(variant: ButtonVariant = "primary", className?: string): string {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className);
}

/** An internal link styled as a button. */
export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/**
 * An external action styled as a button: `tel:`, `mailto:` or WhatsApp.
 * WhatsApp opens in a new tab on desktop so the page the visitor was reading
 * stays open behind the chat.
 */
export function ActionLink({
  variant = "primary",
  className,
  newTab = false,
  children,
  ...props
}: ComponentProps<"a"> & { variant?: ButtonVariant; newTab?: boolean }) {
  return (
    <a
      className={buttonClass(variant, className)}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    >
      {children}
    </a>
  );
}

export function SectionHeading({
  title,
  intro,
  id,
  className,
  as: Tag = "h2",
  onDark = false,
}: {
  title: string;
  intro?: string;
  id?: string;
  className?: string;
  as?: "h1" | "h2";
  onDark?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <Tag
        id={id}
        className={cn(
          Tag === "h1" ? "text-h1" : "text-h2",
          onDark && "text-white",
        )}
      >
        {title}
      </Tag>
      {intro && (
        <p className={cn("mt-3 text-lg", onDark ? "text-steel-300" : "text-steel-600")}>{intro}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
//
// Inline SVG rather than an icon package: a dozen glyphs do not justify a
// dependency or a network request. All are decorative by default (aria-hidden)
// because every one sits beside a text label that carries the meaning.
// ---------------------------------------------------------------------------

type IconProps = { className?: string; title?: string };

function Svg({ className, title, children, viewBox = "0 0 24 24" }: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      className={cn("h-5 w-5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </Svg>
  );
}

/** The WhatsApp glyph, filled — recognisable at a glance is the point. */
export function WhatsAppIcon({ className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 shrink-0", className)}
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.3-1.6A11.8 11.8 0 0 0 24 12 11.7 11.7 0 0 0 20.4 3.6z" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 12h12" />
    </Svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 13h6M9 17h4" />
    </Svg>
  );
}
