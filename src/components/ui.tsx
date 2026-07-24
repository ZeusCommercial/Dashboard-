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
        <header className="flex items-start justify-between gap-4 border-b border-cardline px-5 py-4">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-muted">{subtitle}</p>
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
        <span className="tnum font-display text-[34px] leading-none text-bright">
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
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
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
            <span className="text-[13px] text-soft">{r.label}</span>
            <span className="tnum text-[13px] font-semibold text-bright">
              {r.display}
              {r.sub && (
                <span className="ml-2 font-normal text-muted">{r.sub}</span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-nested">
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
  // Guard against rows arriving with a mismatched shape — a NaN max would
  // flatten every bar to the minimum height instead of scaling.
  const values = rows.map((r) => (Number.isFinite(r.value) ? r.value : 0));
  const max = Math.max(...values, 1);

  if (!rows.length) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-muted"
        style={{ height }}
      >
        No data for this selection
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {rows.map((r, i) => (
          <div
            key={`${r.label}-${i}`}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="tnum text-[11px] font-semibold text-bright opacity-0 transition-opacity group-hover:opacity-100">
              {r.display}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-goldDim/40 to-gold transition-all group-hover:from-goldDim group-hover:to-gold"
              style={{
                height: `${Math.max((values[i] / max) * 100, 2)}%`,
                minHeight: 3,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2 border-t border-cardline pt-2.5">
        {rows.map((r, i) => (
          <div
            key={`${r.label}-label-${i}`}
            className="min-w-0 flex-1 text-center text-[10px] uppercase tracking-wide text-muted"
          >
            {r.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComboChart({
  rows,
  height = 180,
  lineLabel = "Deals",
}: {
  rows: {
    key: string;
    label: string;
    full: string;
    bar: number;
    barDisplay: string;
    line: number | null;
    lineDisplay: string;
  }[];
  height?: number;
  lineLabel?: string;
}) {
  const maxBar = Math.max(...rows.map((r) => r.bar), 1);
  const maxLine = Math.max(...rows.map((r) => r.line ?? 0), 1);

  if (!rows.length || rows.every((r) => r.bar === 0)) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-muted/70"
        style={{ height }}
      >
        No funded deals yet
      </div>
    );
  }

  const plotH = height - 26;
  const slot = 100 / rows.length;

  const points = rows
    .map((r, i) =>
      r.line === null
        ? null
        : `${slot * i + slot / 2},${plotH - (r.line / maxLine) * plotH * 0.8}`
    )
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div className="relative" style={{ height: plotH }}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 border-t border-hairline/40"
            style={{ bottom: `${t * 100}%` }}
          />
        ))}

        <div className="absolute inset-0 flex items-end">
          {rows.map((r) => (
            <div key={r.key} className="group flex flex-1 justify-center">
              <div
                className="w-full max-w-[44px] rounded-t bg-gold transition-opacity group-hover:opacity-80"
                style={{
                  height: `${(r.bar / maxBar) * 80}%`,
                  minHeight: r.bar > 0 ? 3 : 0,
                }}
                title={`${r.full}: ${r.barDisplay} · ${r.lineDisplay} ${lineLabel.toLowerCase()}`}
              />
            </div>
          ))}
        </div>

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${plotH}`}
          preserveAspectRatio="none"
        >
          <polyline
            points={points}
            fill="none"
            stroke="#8DA2C0"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="mt-2 flex">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex-1 text-center text-[11px] uppercase tracking-wide text-muted/70"
          >
            {r.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const APPROVAL_SERIES = [
  { key: "submitted", name: "Submitted", color: "#3B5A8C" },
  { key: "approved", name: "Approved", color: "#E8A33D" },
  { key: "declined", name: "Declined", color: "#8C4A4A" },
] as const;

export function GroupedBarChart({
  rows,
  height = 190,
}: {
  rows: {
    label: string;
    full: string;
    values: Record<string, number>;
    rate: number | null;
  }[];
  height?: number;
}) {
  const max = Math.max(
    ...rows.flatMap((r) => APPROVAL_SERIES.map((s) => r.values[s.key] ?? 0)),
    1
  );

  if (
    !rows.length ||
    rows.every((r) => APPROVAL_SERIES.every((s) => !r.values[s.key]))
  ) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-muted/70"
        style={{ height }}
      >
        No submissions in this window
      </div>
    );
  }

  const plotH = height - 46;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        {APPROVAL_SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>

      <div className="relative flex items-end" style={{ height: plotH }}>
        {[0.33, 0.66, 1].map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 border-t border-hairline/40"
            style={{ bottom: `${t * 100}%` }}
          />
        ))}

        {rows.map((r) => (
          <div
            key={r.label}
            className="flex h-full flex-1 items-end justify-center gap-[3px]"
          >
            {APPROVAL_SERIES.map((s) => {
              const v = r.values[s.key] ?? 0;
              return (
                <div
                  key={s.key}
                  className="w-[22%] max-w-[18px] rounded-t"
                  style={{
                    height: `${(v / max) * 82}%`,
                    minHeight: v > 0 ? 3 : 0,
                    background: s.color,
                  }}
                  title={`${r.full} — ${s.name}: ${v}${
                    r.rate !== null ? ` · ${r.rate.toFixed(0)}% approved` : ""
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex-1 text-center text-[11px] uppercase tracking-wide text-muted/70"
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
      <table className="w-full border-collapse text-[13px] text-soft">
        <thead>
          <tr className="border-b border-cardline">
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
          : "bg-bright/10 text-muted ring-1 ring-bright/20"
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
          ? "border-gold/30 bg-gold/10 text-gold"
          : "border-cardline bg-surface text-muted"
      }`}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-10 text-center text-[13px] text-muted">{children}</div>
  );
}
