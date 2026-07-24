import { BarList, Card, ColumnChart, KpiCard } from "@/components/ui";
import RangeFilter from "@/components/RangeFilter";
import {
  callMetrics,
  callOutcomes,
  callVolumeByWeek,
  duration,
  loadDataset,
  pct,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AiCallsPage({
  searchParams,
}: {
  searchParams: { pipeline?: string; range?: string };
}) {
  const data = await loadDataset({ pipelineId: searchParams.pipeline || null });

  // Filter calls + contacts to the selected time window (?range=days)
  const rangeDays = Number(searchParams.range) || null;
  const cutoff = rangeDays
    ? new Date(Date.now() - rangeDays * 86_400_000).toISOString()
    : null;

  const filtered = cutoff
    ? {
        ...data,
        calls: data.calls.filter((c) => c.createdAt >= cutoff),
        contacts: data.contacts.filter((c) => c.createdAt >= cutoff),
      }
    : data;

  const m = callMetrics(filtered);
  const outcomes = callOutcomes(filtered);
  const weekly = callVolumeByWeek(filtered);
  const voicemails = filtered.calls.filter(
    (c) => c.outcome === "Voicemail"
  ).length;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-bright">
            Samantha AI Calls
          </h1>
        </div>
        <RangeFilter />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Calls"
          value={`${m.total.toLocaleString()}`}
          hint={`${m.contacted.toLocaleString()} contacts reached`}
        />
        <KpiCard
          label="Voicemails Left"
          value={`${voicemails.toLocaleString()}`}
          hint={`${pct(m.total ? voicemails / m.total : 0)} of all calls`}
        />
        <KpiCard
          label="Connect Rate"
          value={pct(m.connectRate)}
          hint="Answered or booked"
        />
        <KpiCard
          label="Median Speed to Lead"
          value={`${Math.round(m.medianSpeedMin)}m`}
          hint={`${pct(m.under5Rate)} under 5 minutes`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Call Volume by Week"
          subtitle="Total calls with booked overlay"
          className="lg:col-span-2"
        >
          <ColumnChart
            rows={weekly.map((w) => ({
              label: w.week,
              value: w.calls,
              display: `${w.calls}`,
            }))}
          />
        </Card>

        <Card title="Call Outcomes" subtitle="Distribution across all calls">
          <BarList
            rows={outcomes.map((o) => ({
              label: o.outcome,
              value: o.count,
              display: `${o.count}`,
              sub: m.total > 0 ? pct(o.count / m.total) : "0%",
            }))}
          />
        </Card>
      </div>

      <Card
        title="Performance Detail"
        subtitle="What Samantha is doing well and where the drop-offs are"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Average Call Duration"
            value={duration(m.avgDuration)}
            note="Longer calls typically correlate with bookings"
          />
          <Metric
            label="Uncontacted Leads"
            value={`${m.uncontacted.toLocaleString()}`}
            note={
              m.contacted + m.uncontacted > 0
                ? `${pct(m.uncontacted / (m.contacted + m.uncontacted))} of contacts`
                : "No contacts yet"
            }
            warn={m.uncontacted > 0}
          />
          <Metric
            label="Booking Efficiency"
            value={pct(m.booked / Math.max(m.contacted, 1))}
            note="Bookings per contact reached"
          />
          <Metric
            label="Rapid Response Rate"
            value={pct(m.under5Rate)}
            note="First call within 5 minutes"
          />
        </div>
      </Card>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
  warn = false,
}: {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-cardline bg-nested p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
        {label}
      </div>
      <div
        className={`tnum mt-2 font-display text-2xl ${warn ? "text-loss" : "text-bright"}`}
      >
        {value}
      </div>
      {note && <div className="mt-1.5 text-[11px] text-muted">{note}</div>}
    </div>
  );
}
