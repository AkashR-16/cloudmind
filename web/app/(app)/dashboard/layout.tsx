import Link from "next/link";
import { Cloud } from "lucide-react";
import { DashboardNav } from "@/components/layout/DashboardNav";
import { UserMenu } from "@/components/layout/UserMenu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="shrink-0 border-b border-surface-border/60 bg-surface-card/40 backdrop-blur-xl px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center transition-all group-hover:bg-brand-500/25">
            <Cloud className="text-brand-400 w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight">CloudMind</span>
        </Link>
        <UserMenu />
      </header>

      <DashboardNav />

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
