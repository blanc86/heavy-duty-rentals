"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Primary navigation links.
 *
 * A client component only so the current section can be marked with
 * aria-current — a static layout cannot know which page it is wrapping.
 * A section counts as current for any page beneath it, so a machine page keeps
 * "Equipment" highlighted.
 */
export function NavLinks({ items, className, linkClassName }: { items: NavItem[]; className?: string; linkClassName?: string }) {
  const pathname = usePathname();

  return (
    <ul className={className}>
      {items.map((item) => {
        const isHome = item.href.split("/").filter(Boolean).length === 1;
        const current = isHome ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                linkClassName,
                current && "text-steel-950 after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:bg-machine-500",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
