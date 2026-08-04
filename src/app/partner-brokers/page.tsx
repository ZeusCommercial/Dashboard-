import {
  BarList,
  Card,
  ColumnChart,
  DualBarChart,
  Empty,
  KpiCard,
  Table,
  Td,
} from "@/components/ui";
import {
  brokerCommissionByMonth,
  brokerDeals,
  brokerKpis,
  brokerTable,
  compactMoney,
  loadDataset,
  money,
  pct,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function PartnerBrokersPage({
  searchParams,
}: {
  searchParams: { pipeline?: string };
}) {
  const data = await loadDataset({ pipelineId: searchParams.pipeline || null });
  const rows = brokerTable(data);
  const deals = brokerDeals(data);
  const kpis = brokerKpis(data);
  const monthly = brokerCommissionByMonth(data);

  const totalVolume = rows.reduce((s, r) => s + r.volume, 0);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright"></h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Commissions Owed"
          value={money(kpis.totalOwed)}
          hint={`${kpis.activeBrokers} broker${kpis.activeBrokers === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Active Brokers"
          value={`${kpis.activeBrokers}`}
          hint="With at least one deal"
        />
        <KpiCard
          label="Broker-Sourced Volume"
          value={compactMoney(kpis.brokerVolume)}
          hint={`${deals.length} deal${deals.length === 1 ? "" : "s"} tagged`}
        />
        <KpiCard
          label="Avg Broker Percentage"
          value={kpis.avgPoints ? `${kpis.avgPoints.toFixed(2)}%` : "—"}
          hint="Across brokers with a percentage set"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Commission Owed vs. Volume by Broker"
          subtitle="Which brokers bring volume efficiently vs. cost more relative to what they source"
        >
          {rows.length === 0 ? (
            <Empty>No partner broker deals yet.</Empty>
          ) : (
            <DualBarChart
              seriesALabel="Volume"
              seriesBLabel="Owed"
              rows={rows.map((r) => ({
                label: r.name,
                a: r.volume,
                b: r.totalOwed,
                aDisplay: compactMoney(r.volume),
                bDisplay: money(r.totalOwed),
              }))}
            />
          )}
        </Card>

        <Card title="Commission Owed Over Time" subtitle="Trailing 6 months">
          <ColumnChart
            rows={monthly.map((m) => ({
              label: m.label,
              value: m.owed,
              display: money(m.owed),
            }))}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Commission Owed by Broker"
          subtitle={`${rows.length} broker${rows.length === 1 ? "" : "s"}`}
        >
          {rows.length === 0 ? (
            <Empty>No partner broker deals yet.</Empty>
          ) : (
            <Table head={["Broker", "Deals", "Volume", "Owed"]}>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-cardline/60">
                  <Td align="left">
                    <span className="font-medium text-bright">{row.name}</span>
                  </Td>
                  <Td>{row.deals}</Td>
                  <Td>{compactMoney(row.volume)}</Td>
                  <Td>
                    <span className="text-gold">{money(row.totalOwed)}</span>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Volume Share by Broker">
          {rows.length === 0 ? (
            <Empty>No partner broker deals yet.</Empty>
          ) : (
            <BarList
              rows={rows.map((r) => ({
                label: r.name,
                value: r.volume,
                display: compactMoney(r.volume),
                sub: totalVolume > 0 ? pct(r.volume / totalVolume) : "",
              }))}
            />
          )}
        </Card>
      </div>

      <Card title="All Broker Deals" subtitle={`${deals.length} in this pipeline`}>
        {deals.length === 0 ? (
          <Empty>
            No opportunities have a Broker Name set yet. Add one on the
            Opportunity to see it here.
          </Empty>
        ) : (
          <Table head={["Deal", "Broker", "Percentage", "Loan Amount", "Owed"]}>
            {[...deals]
              .sort((a, b) => (b.commissionOwed || 0) - (a.commissionOwed || 0))
              .slice(0, 50)
              .map((deal) => (
                <tr key={deal.id} className="border-b border-hairline/60">
                  <Td align="left">
                    <div className="font-medium text-bright">{deal.name}</div>
                  </Td>
                  <Td>{deal.brokerName}</Td>
                  <Td>
                    {deal.brokerPoints !== null && deal.brokerPoints !== undefined
                      ? `${deal.brokerPoints}%`
                      : "—"}
                  </Td>
                  <Td>{compactMoney(deal.amount)}</Td>
                  <Td>
                    {deal.commissionOwed ? (
                      <span className="text-gold">{money(deal.commissionOwed)}</span>
                    ) : (
                      <span className="text-muted/50">—</span>
                    )}
                  </Td>
                </tr>
              ))}
          </Table>
        )}
      </Card>
    </main>
  );
}
