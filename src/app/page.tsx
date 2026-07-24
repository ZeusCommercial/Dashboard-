import {
  Banner,
  BarList,
  Card,
  ColumnChart,
  KpiCard,
  Table,
  Td,
} from "@/components/ui";
import { PipelineFilter } from "@/components/PipelineFilter";
import {
  compactMoney,
  leadsOverTime,
  loadDataset,
  overviewKpis,
  pipelineByStage,
  revenueByMonth,
  staleDeals,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { pipeline?: string };
}) {
  const data = await loadDataset({ pipelineId: searchParams.pipeline || null });
  const kpis = overviewKpis(data);
  const revenue = revenueByMonth(data);
  const stages = pipelineByStage(data);
  const leads = leadsOverTime(data);
  const stale = staleDeals(data, 21);

  const totalPipeline = stages.reduce((s, x) => s + x.value, 0);
  const stalePipelineValue = stale.reduce((s, d) => s + d.amount, 0);

  return (
    <main className="space-y-6">
      {data.isMock && (
        <Banner tone="warn">
          <strong>Demo mode.</strong> GHL credentials are not configured yet, so
          numbers below are illustrative. Add <code>GHL_PRIVATE_TOKEN</code> and{" "}
          <code>GHL_LOCATION_ID</code> in Render to switch to live data.
        </Banner>
      )}

      {data.pipelines.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-muted"></div>
          <PipelineFilter
            pipelines={data.pipelines}
            current={data.pipelineFilter}
          />
        </div>
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
          title="Stale Deals"
          subtitle={`No stage movement in 21+ days${
            stale.length ? ` — ${compactMoney(stalePipelineValue)} at risk` : ""
          }`}
          className="lg:col-span-2"
        >
          {stale.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-muted/70">
              No stale deals. Pipeline is moving.
            </div>
          ) : (
            <Table head={["Deal", "Stage", "Amount", "Days Idle"]}>
              {stale.slice(0, 8).map((deal) => (
                <tr key={deal.id} className="border-b border-hairline/60">
                  <Td align="left">
                    <div className="font-medium text-bright">{deal.name}</div>
                  </Td>
                  <Td>
                    <span className="rounded bg-raised px-2 py-0.5 text-[11px] text-muted">
                      {deal.stage}
                    </span>
                  </Td>
                  <Td>{compactMoney(deal.amount)}</Td>
                  <Td>
                    <span
                      className={
                        deal.idleDays >= 45
                          ? "font-semibold text-loss"
                          : "text-bright"
                      }
                    >
                      {deal.idleDays}d
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
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
