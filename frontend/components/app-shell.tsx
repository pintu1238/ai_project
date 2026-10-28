import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/projects/new", label: "New project" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/review", label: "Review" },
  { href: "/dashboard/brand", label: "Brand kit" },
  { href: "/dashboard/social", label: "Social accounts" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function AppShell({
  children,
  title,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-white">
              ContentFlow <span className="text-indigo-400">AI</span>
            </Link>
            {title ? <span className="hidden text-sm text-slate-400 md:inline">/ {title}</span> : null}
          </div>
          <nav className="hidden flex-wrap items-center gap-3 text-sm md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-slate-300 hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          {actions}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status.includes("FAIL") || status === "FAILED"
      ? "bg-rose-500/15 text-rose-200 ring-rose-500/30"
      : status.includes("READY") || status === "COMPLETED" || status === "APPROVED" || status === "PUBLISHED"
        ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
        : status.includes("PROCESS") || status === "QUEUED" || status === "SCHEDULED"
          ? "bg-amber-500/15 text-amber-100 ring-amber-500/30"
          : "bg-slate-500/15 text-slate-200 ring-white/10";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 ${className}`}>
      {children}
    </div>
  );
}
