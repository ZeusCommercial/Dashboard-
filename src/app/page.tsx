import {
  Banner,
  BarList,
  Card,
  ColumnChart,
  KpiCard,
} from "@/components/ui";
import {
  compactMoney,
  conversionFunnel,
  leadsOverTime,
  loadDataset,
  overviewKpis,
  pct,
  pipelineByStage,
  revenueByMonth,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const data = loadDataset();
  const kpis = overviewKpis(data);
  const revenue = revenueByMonth(data);
  const stages = pipelineByStage(data);
  const funnel = conversionFunnel(data);
  const leads = leadsOverTime(data);

  const totalPipeline = stages.reduce((s, x) => s + x.value, 0);

  return (
    <main className="space-y-6">
      {data.isMock && (
        <Banner tone="warn">
          <strong>Demo mode.</strong> GHL credentials are not configured yet, so
          numbers below are illustrative. Add <code>GHL_PRIVATE_TOKEN</code> and{" "}
          <code>GHL_LOCATION_ID</code> in Render to switch to live data.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Revenue Funded"
          subtitle="Trailing 6 months"
          className="lg:col-span-2"
        >
          <ColumnChart
            rows={revenue.map((r) => ({
              label: r.month,
              value: r.revenue,
              display: compactMoney(r.revenue),
            }))}
          />
        </Card>

        <Card
          title="Pipeline by Stage"
          subtitle={`${compactMoney(totalPipeline)} across ${stages.reduce(
            (s, x) => s + x.count,
            0
          )} deals`}
        >
          <BarList
            rows={stages.map((s) => ({
              label: s.stage,
              value: s.value,
              display: compactMoney(s.value),
              sub: `${s.count}`,
            }))}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Conversion Funnel"
          subtitle="Cumulative reach and drop-off per stage"
          className="lg:col-span-2"
        >
          <div className="space-y-3">
            {funnel.map((f, i) => {
              const first = funnel[0]?.count ?? 1;
              const width = (f.count / first) * 100;
              return (
                <div key={f.stage} className="group">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-bright/90">
                      {i + 1}. {f.stage}
                    </span>
                    <span className="tnum text-[13px] font-semibold text-bright">
                      {f.count}
                      {f.dropoff !== null && f.dropoff > 0 && (
                        <span className="ml-2 text-[11px] font-normal text-loss">
                          −{pct(f.dropoff)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-goldDim to-gold"
                      style={{ width: `${Math.max(width, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Leads Over Time" subtitle="New contacts per week">
          <ColumnChart
            rows={leads.map((l) => ({
              label: l.week,
              value: l.leads,
              display: `${l.leads}`,
            }))}
            height={170}
          />
        </Card>
      </div>
    </main>
  );
}
