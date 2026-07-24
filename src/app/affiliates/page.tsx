import {
  BarList,
  Card,
  KpiCard,
  Pending,
  Table,
  Td,
  TierBadge,
} from "@/components/ui";
import {
  affiliateTree,
  commissionTable,
  compactMoney,
  dealSizeDistribution,
  loadDataset,
  money,
  pct,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage({
  searchParams,
}: {
  searchParams: { pipeline?: string };
}) {
  const data = await loadDataset({ pipelineId: searchParams.pipeline || null });
  const totals = commissionTable(data);
  const tree = affiliateTree(data);
  const dist = dealSizeDistribution(data);

  const totalOwed = totals.reduce((s, r) => s + r.totalEarnings, 0);
  const totalOverrides = totals.reduce((s, r) => s + r.overrideEarnings, 0);
  const totalDirect = totals.reduce((s, r) => s + r.directEarnings, 0);
  const totalPending = totals.reduce((s, r) => s + r.pendingEarnings, 0);
  const totalFunded = totals.reduce((s, r) => s + r.directFunded, 0);

  // Tier 1 payouts are a pure function of funded amount bands, so they're
  // derived from the distribution rather than the per-affiliate rollup.
  const tier1Payout = dist.reduce((s, d) => s + d.count * d.payout, 0);
  const bandVolume = dist.reduce((s, d) => s + d.volume, 0);
  const bandDeals = dist.reduce((s, d) => s + d.count, 0);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright">Partner Network</h1>
       
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Commissions Owed"
          value={money(totalOwed)}
          hint={`${totals.length} partners`}
        />
        <KpiCard
          label="Tier 1 Payout Total"
          value={money(tier1Payout)}
          hint="Band-based earnings, Tier 1 only"
        />
        <KpiCard
          label="Override Earnings"
          value={money(totalOverrides)}
          hint="$100 per downline funded deal"
        />
        <KpiCard
          label="Volume Attributed"
          value={compactMoney(totalFunded)}
          hint={
            totalPending > 0
              ? `${totalPending} Tier 2 deals pending`
              : `${money(totalDirect)} direct earnings`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Deal Size Distribution"
          subtitle={`${bandDeals} funded deals across Tier 1 bands`}
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
          
        >
          <BarList
            rows={dist.map((d) => ({
              label: d.label,
              value: d.volume,
              display: compactMoney(d.volume),
              sub: bandVolume > 0 ? pct(d.volume / bandVolume) : "",
            }))}
          />
        </Card>
      </div>

      <Card title="Top Producers" subtitle="Sorted by funded volume">
        {totals.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted/70">
            No funded deals attributed to affiliates yet.
          </div>
        ) : (
          <Table
            head={[
              "Partner",
              "Tier",
              "Deals",
              "Funded",
              "Direct $",
              "Override $",
              "Total $",
            ]}
          >
            {totals.slice(0, 10).map((row) => (
              <tr key={row.affiliateId} className="border-b border-hairline/60">
                <Td align="left">
                  <div className="font-medium text-bright">{row.name}</div>
                  <div className="text-[11px] text-muted/60">{row.affiliateId}</div>
                </Td>
                <Td>
                  <TierBadge tier={row.tier} />
                </Td>
                <Td>{row.directDeals}</Td>
                <Td>{compactMoney(row.directFunded)}</Td>
                <Td>
                  {row.directEarnings > 0 ? (
                    money(row.directEarnings)
                  ) : row.pendingEarnings > 0 ? (
                    <Pending label={`${row.pendingEarnings} pending`} />
                  ) : (
                    <span className="text-muted/50">—</span>
                  )}
                </Td>
                <Td>
                  {row.overrideEarnings > 0 ? (
                    <span className="text-gold">{money(row.overrideEarnings)}</span>
                  ) : (
                    <span className="text-muted/50">—</span>
                  )}
                </Td>
                <Td>
                  <span className="font-semibold text-bright">
                    {money(row.totalEarnings)}
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Partners">
        {tree.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted/70">
            No affiliates in the registry yet. Add partners to the affiliate
            sheet, or check that the hourly sync is running.
          </div>
        ) : (
          <div className="space-y-4">
            {tree.map(({ am, sams }) => (
              <div
                key={am.affiliateId}
                className="rounded-lg border border-hairline bg-ink/30 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-bright">{am.name}</span>
                      <TierBadge tier={am.tier} />
                      <span className="text-[10px] uppercase tracking-wider text-muted/60">
                        AM
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted/70">
                      Own: {am.directDeals} deals · {compactMoney(am.directFunded)}
                      {" · "}
                      Downline: {am.downlineDeals} deals ·{" "}
                      {compactMoney(am.downlineFunded)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tnum font-display text-xl text-bright">
                      {money(am.totalEarnings)}
                    </div>
                    <div className="text-[11px] text-muted/70">
                      {money(am.directEarnings)} direct ·{" "}
                      <span className="text-gold">
                        {money(am.overrideEarnings)} override
                      </span>
                    </div>
                  </div>
                </div>

                {sams.length > 0 && (
                  <div className="mt-4 space-y-2 border-l-2 border-hairline pl-4">
                    {sams.map((sam) => (
                      <div
                        key={sam.affiliateId}
                        className="flex items-center justify-between gap-3 rounded bg-raised/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted/40">↳</span>
                          <span className="text-[13px] text-bright/90">
                            {sam.name}
                          </span>
                          <TierBadge tier={sam.tier} />
                          <span className="text-[10px] uppercase tracking-wider text-muted/60">
                            SAM
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[12px]">
                          <span className="tnum text-muted/70">
                            {sam.directDeals}d · {compactMoney(sam.directFunded)}
                          </span>
                          <span className="tnum font-semibold text-bright">
                            {sam.directEarnings > 0
                              ? money(sam.directEarnings)
                              : sam.pendingEarnings > 0
                                ? <Pending />
                                : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
