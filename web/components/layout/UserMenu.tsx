"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, User } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center hover:bg-brand-500/30 transition-colors"
        aria-label="User menu"
      >
        <User className="w-4 h-4 text-brand-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-surface-card border border-surface-border rounded-xl shadow-xl py-1 z-50">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
