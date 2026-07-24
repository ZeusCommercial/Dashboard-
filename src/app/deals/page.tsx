import { Card, KpiCard, Table, Td } from "@/components/ui";
import { PipelineFilter } from "@/components/PipelineFilter";
import { compactMoney, loadDataset, pct } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: { pipeline?: string };
}) {
  const data = await loadDataset({ pipelineId: searchParams.pipeline || null });

  const openDeals = data.deals.filter((d) => d.stage !== "Funded");
  const openValue = openDeals.reduce((s, d) => s + d.amount, 0);
  const noValue = data.deals.filter((d) => !d.amount).length;

  // How many deals resolve to a real partner rather than falling through to
  // the "unattributed" bucket — the health check on the whole tracking chain.
  const attributed = data.deals.filter(
    (d) => d.affiliateId && d.affiliateId !== "unattributed"
  ).length;
  const coverage = data.deals.length ? attributed / data.deals.length : 0;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright">Deals</h1>
        
      </div>

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
        <KpiCard
          label="Total Deals"
          value={`${data.deals.length}`}
          hint={`${openDeals.length} still open`}
        />
        <KpiCard
          label="Open Value"
          value={compactMoney(openValue)}
          hint="Excludes funded deals"
        />
        <KpiCard
          label="Attribution Coverage"
          value={pct(coverage)}
          hint={`${attributed} of ${data.deals.length} traced to a partner`}
        />
        <KpiCard
          label="Missing Amount"
          value={`${noValue}`}
          hint="Deals with no monetary value set"
        />
      </div>

      <Card title="All Deals" subtitle={`${data.deals.length} in this pipeline`}>
        {data.deals.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted/70">
            No deals in this pipeline.
          </div>
        ) : (
          <Table head={["Deal", "Stage", "Amount", "Updated"]}>
            {[...data.deals]
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 50)
              .map((deal) => (
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
                  <Td>
                    {deal.amount ? (
                      compactMoney(deal.amount)
                    ) : (
                      <span className="text-muted/50">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-muted/70">
                      {new Date(deal.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
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
