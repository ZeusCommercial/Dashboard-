import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-hairline bg-surface shadow-md ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-muted/80">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && isFinite(delta);
  const up = hasDelta && delta! >= 0;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-md">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="tnum font-display text-[34px] leading-none text-white">
          {value}
        </span>
        {hasDelta && (
          <span
            className={`tnum text-[13px] font-semibold ${
              up ? "text-gain" : "text-loss"
            }`}
          >
            {up ? "▲" : "▼"} {Math.abs(delta! * 100).toFixed(1)}%
          </span>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-muted/80">{hint}</div>}
    </div>
  );
}

export function BarList({
  rows,
}: {
  rows: { label: string; value: number; display: string; sub?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="space-y-3.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-white/90">{r.label}</span>
            <span className="tnum text-[13px] font-semibold text-white">
              {r.display}
              {r.sub && (
                <span className="ml-2 font-normal text-muted/80">{r.sub}</span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-gradient-to-r from-goldDim to-gold"
              style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({
  rows,
  height = 190,
}: {
  rows: { label: string; value: number; display: string }[];
  height?: number;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {rows.map((r) => (
          <div
            key={r.label}
            className="group flex flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="tnum text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              {r.display}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-goldDim/40 to-gold transition-all group-hover:from-goldDim group-hover:to-gold"
              style={{
                height: `${Math.max((r.value / max) * 100, 2)}%`,
                minHeight: 3,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2 border-t border-hairline pt-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex-1 text-center text-[10px] uppercase tracking-wide text-muted/80"
          >
            {r.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Table({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px] text-white/90">
        <thead>
          <tr className="border-b border-hairline">
            {head.map((h, i) => (
              <th
                key={h}
                className={`pb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  align = "right",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`py-3 ${align === "left" ? "text-left" : "tnum text-right"} ${className}`}
    >
      {children}
    </td>
  );
}

export function TierBadge({ tier }: { tier: "TIER_1" | "TIER_2" }) {
  const two = tier === "TIER_2";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        two
          ? "bg-gold/15 text-gold ring-1 ring-gold/30"
          : "bg-white/10 text-muted ring-1 ring-white/20"
      }`}
    >
      {two ? "Tier 2" : "Tier 1"}
    </span>
  );
}

export function Pending({ label = "Pending" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-loss/10 px-2 py-0.5 text-[11px] font-medium text-loss/90 ring-1 ring-loss/20">
      {label}
    </span>
  );
}

export function Banner({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "info";
  children: ReactNode;
}) {
  const warn = tone === "warn";
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-[13px] ${
        warn
          ? "border-gold/40 bg-gold/10 text-goldDim"
          : "border-hairline bg-surface text-muted"
      }`}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-10 text-center text-[13px] text-muted/80">{children}</div>
  );
}
