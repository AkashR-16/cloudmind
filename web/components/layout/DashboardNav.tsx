"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/how-it-works", label: "How It Works", icon: HelpCircle },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-b border-surface-border/60 bg-surface-card/20 px-4 sm:px-6 flex items-center gap-0.5 overflow-x-auto">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all duration-200 whitespace-nowrap",
              active ? "text-white" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            {active && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-brand-500 to-violet-400 rounded-t-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
