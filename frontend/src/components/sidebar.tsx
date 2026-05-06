"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Search,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Layers,
  UserSearch,
  Mail,
  Sparkles,
  Presentation,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    items: [
      { href: "/firm-demos", label: "Firm Demos", icon: Presentation },
    ],
  },
  {
    label: "Discovery",
    items: [
      { href: "/batch", label: "Batch Search", icon: Layers },
      { href: "/single", label: "Single Search", icon: UserSearch },
      { href: "/batch-research", label: "Batch Research", icon: Users },
    ],
  },
  {
    label: "Outreach",
    items: [
      { href: "/email-creator", label: "Email Creator", icon: Mail },
      { href: "/flash-cards", label: "Flash Cards", icon: Sparkles },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group/sidebar sticky top-0 flex h-screen shrink-0 flex-col border-r border-border/60 bg-[#fafafa] transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[240px]",
      )}
    >
      <div className="flex h-12 items-center justify-between gap-2 px-3">
        <Link
          href="/firm-demos"
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-black/5"
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold text-background">
            K
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">
              Kalinda
            </span>
          )}
        </Link>
        {!collapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Search"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground"
            >
              <Search className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground"
            >
              <ChevronsLeft className="size-3.5" />
            </button>
          </div>
        )}
        {collapsed && (
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={() => setCollapsed(false)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground"
          >
            <ChevronsRight className="size-3.5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {sections.map((section, sIdx) => {
          const isActive = (href: string) =>
            pathname === href || (href !== "/" && pathname?.startsWith(href));
          return (
            <div key={sIdx} className={cn(sIdx > 0 && "mt-4")}>
              {section.label && !collapsed && (
                <div className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {section.label}
                </div>
              )}
              <ul className="flex flex-col gap-px">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex h-7 items-center gap-2 rounded-md px-2 text-[13px] leading-none transition-colors",
                          active
                            ? "bg-black/[0.06] text-foreground"
                            : "text-foreground/80 hover:bg-black/[0.04]",
                          collapsed && "justify-center",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {!collapsed && item.badge !== undefined && (
                          <span className="rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-border/60 px-3 py-2">
          <Link
            href="/"
            className="flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
          >
            <Home className="size-4" />
            <span>Home</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
