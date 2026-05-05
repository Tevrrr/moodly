import Link from "next/link";
import type { ReactNode } from "react";

type ActivePage = "entry" | "chart";

type MetricItem = {
  label: string;
  value: string;
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const panelClass =
  "rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70";

export const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export const primaryButtonClass =
  "rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400";

export const secondaryButtonClass =
  "rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700";

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section
        className={cn(
          "mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-5 sm:px-8 sm:py-7 lg:px-10",
          className,
        )}
      >
        {children}
      </section>
    </main>
  );
}

export function PageHeader({
  title,
  subtitle,
  activePage,
  metrics,
}: {
  title: string;
  subtitle: string;
  activePage: ActivePage;
  metrics: MetricItem[];
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Mood Tracker
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 break-words text-sm text-slate-500">{subtitle}</p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Основные разделы">
          <NavItem href="/" active={activePage === "entry"}>
            Запись
          </NavItem>
          <NavItem href="/chart" active={activePage === "chart"}>
            График
          </NavItem>
        </nav>
      </div>
      <div
        className={cn(
          "grid gap-3",
          metrics.length === 2
            ? "sm:grid-cols-2 lg:min-w-[340px]"
            : "sm:grid-cols-3 lg:min-w-[480px]",
        )}
      >
        {metrics.map((metric) => (
          <Metric key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>
    </header>
  );
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700",
      )}
    >
      {children}
    </Link>
  );
}

export function Metric({ label, value }: MetricItem) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/70">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold leading-none text-slate-950">
        {value}
      </p>
    </div>
  );
}
