"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const ITEMS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/content", label: "Content", icon: "content" },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/learning", label: "Learning", icon: "learning" },
];

export function NavLinks({ variant }: { variant: "side" | "tab" }) {
  const path = usePathname() ?? "/";
  return (
    <>
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path === it.href || path.startsWith(`${it.href}/`) || (it.href === "/content" && path.startsWith("/videos/"));
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <Icon name={it.icon} size={variant === "tab" ? 22 : 20} />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </>
  );
}
