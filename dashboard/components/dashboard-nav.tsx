"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Eye, LayoutDashboard, Activity, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/sessions", label: "Sessions", icon: Activity, exact: false },
  { href: "/dashboard/models", label: "Models", icon: Cpu, exact: false },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border/50 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 group">
          <Eye className="w-4 h-4 text-violet-400" />
          <span className="font-bold text-sm tracking-tight group-hover:text-violet-400 transition-colors">
            Argus
          </span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-violet-500/10 text-violet-400 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-border/50 flex items-center gap-3">
        <UserButton />
        <span className="text-xs text-muted-foreground">Account</span>
      </div>
    </aside>
  );
}
