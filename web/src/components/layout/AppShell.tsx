"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  FileText,
  History,
  LogOut,
  Search,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/db/types";

const nav = [
  { href: "/finder", label: "Finder", icon: Search },
  { href: "/my-store", label: "My Store", icon: Building2 },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/history", label: "History", icon: History },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f5f3ff]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo size="sm" />
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
