import { BarList, Card, KpiCard, Table, Td } from "@/components/ui";
import { PipelineFilter } from "@/components/PipelineFilter";
import {
  compactMoney,
  dealSizeDistribution,
  loadDataset,
  money,
  pct,
  staleDeals,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: { pipeline?: string };
}) {
  const data = await loadDataset({ pipelineId: searchParams.pipeline || null });
  const dist = dealSizeDistribution(data);
  const stale = staleDeals(data, 21);

  const totalFunded = dist.reduce((s, d) => s + d.count, 0);
  const totalVolume = dist.reduce((s, d) => s + d.volume, 0);
  const totalPayout = dist.reduce((s, d) => s + d.count * d.payout, 0);

  const stalePipelineValue = stale.reduce((s, d) => s + d.amount, 0);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright">Deals</h1>
        <p className="mt-1 text-[13px] text-muted">
          Distribution across commission bands and deals that need attention.
        </p>
      </div>

      {data.pipelines.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-muted">Filter by pipeline:</div>
          <PipelineFilter
            pipelines={data.pipelines}
            current={data.pipelineFilter}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Funded Deals"
          value={`${totalFunded}`}
          hint={compactMoney(totalVolume)}
        />
        <KpiCard
          label="Tier 1 Payout Total"
          value={money(totalPayout)}
          hint="Direct affiliate earnings, Tier 1 only"
        />
        <KpiCard
          label="Stale Deals"
          value={`${stale.length}`}
          hint={`${compactMoney(stalePipelineValue)} at risk`}
        />
        <KpiCard
          label="Avg Funded Deal"
          value={compactMoney(totalFunded ? totalVolume / totalFunded : 0)}
          hint="Weighted average"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Deal Size Distribution"
          subtitle="How many funded deals landed in each commission band"
        >
          <Table head={["Band", "Payout", "Deals", "Volume"]}>
            {dist.map((row) => (
              <tr key={row.label} className="border-b border-hairline/60">
                <Td align="left">
                  <span className="font-medium text-bright">{row.label}</span>
                </Td>
                <Td>
                  <span className="text-gold">{money(row.payout)}</span>
                </Td>
                <Td>{row.count}</Td>
                <Td>{compactMoney(row.volume)}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card
          title="Volume Share by Band"
          subtitle="Where the money actually comes from"
        >
          <BarList
            rows={dist.map((d) => ({
              label: d.label,
              value: d.volume,
              display: compactMoney(d.volume),
              sub: totalVolume > 0 ? pct(d.volume / totalVolume) : "",
            }))}
          />
        </Card>
      </div>

      <Card
        title="Stale Deals"
        subtitle={`Open deals with no stage movement in 21+ days${
          stale.length ? ` — ${compactMoney(stalePipelineValue)} at risk` : ""
        }`}
      >
        {stale.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted/70">
            No stale deals. Pipeline is moving.
          </div>
        ) : (
          <Table head={["Deal", "Stage", "Amount", "Days Idle"]}>
            {stale.slice(0, 15).map((deal) => (
              <tr key={deal.id} className="border-b border-hairline/60">
                <Td align="left">
                  <div className="font-medium text-bright">{deal.name}</div>
                  <div className="text-[11px] text-muted/60">{deal.id}</div>
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
    </main>
  );
}
