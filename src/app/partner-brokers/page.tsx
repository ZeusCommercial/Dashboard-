import { BarList, Card, Empty, KpiCard, Table, Td } from "@/components/ui";
import {
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

  const totalVolume = rows.reduce((s, r) => s + r.volume, 0);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright">Partner Brokers</h1>
        <p className="mt-1 text-[13px] text-muted">
          Manual, points-based brokers tracked per deal — Broker Name, Broker
          Points, and Commission Owed set directly on the Opportunity.
        </p>
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
          label="Avg Broker Points"
          value={kpis.avgPoints ? kpis.avgPoints.toFixed(2) : "—"}
          hint="Across brokers with points set"
        />
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

      <Card title="Top Producers" subtitle="Sorted by funded volume">
        {rows.filter((r) => r.fundedDeals > 0).length === 0 ? (
          <Empty>No funded deals attributed to a partner broker yet.</Empty>
        ) : (
          <Table
            head={["Broker", "Funded Deals", "Funded Volume", "Avg Points", "Owed"]}
          >
            {rows
              .filter((r) => r.fundedDeals > 0)
              .map((row) => (
                <tr key={row.name} className="border-b border-cardline/60">
                  <Td align="left">
                    <span className="font-medium text-bright">{row.name}</span>
                  </Td>
                  <Td>{row.fundedDeals}</Td>
                  <Td>{compactMoney(row.fundedVolume)}</Td>
                  <Td>{row.avgPoints ? row.avgPoints.toFixed(2) : "—"}</Td>
                  <Td>
                    <span className="font-semibold text-bright">
                      {money(row.totalOwed)}
                    </span>
                  </Td>
                </tr>
              ))}
          </Table>
        )}
      </Card>

      <Card title="All Broker Deals" subtitle={`${deals.length} in this pipeline`}>
        {deals.length === 0 ? (
          <Empty>
            No opportunities have a Broker Name set yet. Add one on the
            Opportunity to see it here.
          </Empty>
        ) : (
          <Table
            head={["Deal", "Broker", "Points", "Loan Amount", "Owed", "Stage"]}
          >
            {[...deals]
              .sort((a, b) => (b.commissionOwed || 0) - (a.commissionOwed || 0))
              .slice(0, 50)
              .map((deal) => (
                <tr key={deal.id} className="border-b border-hairline/60">
                  <Td align="left">
                    <div className="font-medium text-bright">{deal.name}</div>
                    <div className="text-[11px] text-muted/60">{deal.id}</div>
                  </Td>
                  <Td align="left">{deal.brokerName}</Td>
                  <Td>{deal.brokerPoints ?? "—"}</Td>
                  <Td>{compactMoney(deal.amount)}</Td>
                  <Td>
                    {deal.commissionOwed ? (
                      <span className="text-gold">{money(deal.commissionOwed)}</span>
                    ) : (
                      <span className="text-muted/50">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="rounded bg-raised px-2 py-0.5 text-[11px] text-muted">
                      {deal.stage}
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
