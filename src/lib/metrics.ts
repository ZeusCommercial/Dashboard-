import { rollup, type DealRow, type Tier, TIER_1_BANDS } from "./commission";
import {
  MOCK_AFFILIATES,
  mockCalls,
  mockContacts,
  mockDeals,
  type MockCall,
  type MockContact,
  type MockDeal,
} from "./mock";

export const FUNDED_STAGE = "Funded";

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function compactMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export type Dataset = {
  deals: MockDeal[];
  contacts: MockContact[];
  calls: MockCall[];
  affiliates: typeof MOCK_AFFILIATES;
  isMock: boolean;
  generatedAt: string;
  pipelines: { id: string; name: string }[];
  pipelineFilter: string | null;
};

export function loadDataset(): Dataset {
  return {
    deals: mockDeals(),
    contacts: mockContacts(),
    calls: mockCalls(),
    affiliates: MOCK_AFFILIATES,
    isMock: true,
    generatedAt: new Date().toISOString(),
  };
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export type Kpi = {
  label: string;
  value: string;
  delta: number | null;
  hint?: string;
};

export function overviewKpis(d: Dataset): Kpi[] {
  const funded = d.deals.filter((x) => x.stage === FUNDED_STAGE);
  const totalFunded = funded.reduce((s, x) => s + x.amount, 0);

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 7);

  const thisMonthFunded = funded
    .filter((x) => monthKey(x.updatedAt) === thisMonth)
    .reduce((s, x) => s + x.amount, 0);
  const prevMonthFunded = funded
    .filter((x) => monthKey(x.updatedAt) === prev)
    .reduce((s, x) => s + x.amount, 0);

  const mom =
    prevMonthFunded > 0
      ? (thisMonthFunded - prevMonthFunded) / prevMonthFunded
      : null;

  const openDeals = d.deals.filter((x) => x.stage !== FUNDED_STAGE);
  const pipelineValue = openDeals.reduce((s, x) => s + x.amount, 0);

  const commissionRows = commissionTable(d);
  const owed = commissionRows.reduce((s, r) => s + r.totalEarnings, 0);

  const avgDeal = funded.length ? totalFunded / funded.length : 0;

  return [
    {
      label: "Total Funded",
      value: compactMoney(totalFunded),
      delta: mom,
      hint: `${funded.length} funded deals`,
    },
    {
      label: "Open Pipeline",
      value: compactMoney(pipelineValue),
      delta: null,
      hint: `${openDeals.length} active deals`,
    },
    {
      label: "Commissions Owed",
      value: money(owed),
      delta: null,
      hint: "Includes $100 overrides",
    },
    {
      label: "Avg Deal Size",
      value: compactMoney(avgDeal),
      delta: null,
      hint: "Funded deals only",
    },
  ];
}

export function revenueByMonth(d: Dataset) {
  const map = new Map<string, number>();
  for (const deal of d.deals) {
    if (deal.stage !== FUNDED_STAGE) continue;
    const k = monthKey(deal.updatedAt);
    map.set(k, (map.get(k) ?? 0) + deal.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([k, v]) => ({ month: monthLabel(k), revenue: v }));
}

export function pipelineByStage(d: Dataset) {
  const order = [
    "New Lead",
    "Contacted",
    "Application Sent",
    "Underwriting",
    "Offer Presented",
    "Funded",
  ];
  const map = new Map<string, { count: number; value: number }>();
  for (const deal of d.deals) {
    const cur = map.get(deal.stage) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += deal.amount;
    map.set(deal.stage, cur);
  }
  return order.map((stage) => ({
    stage,
    count: map.get(stage)?.count ?? 0,
    value: map.get(stage)?.value ?? 0,
  }));
}

export function conversionFunnel(d: Dataset) {
  const stages = pipelineByStage(d);
  const totals: { stage: string; count: number; dropoff: number | null }[] = [];

  for (let i = 0; i < stages.length; i++) {
    const reached = stages.slice(i).reduce((s, x) => s + x.count, 0);
    const prevReached = totals.length ? totals[totals.length - 1].count : null;
    totals.push({
      stage: stages[i].stage,
      count: reached,
      dropoff:
        prevReached && prevReached > 0
          ? (prevReached - reached) / prevReached
          : null,
    });
  }
  return totals;
}

export function leadsOverTime(d: Dataset) {
  const map = new Map<string, number>();
  for (const c of d.contacts) {
    const week = weekKey(c.createdAt);
    map.set(week, (map.get(week) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([k, v]) => ({ week: k.slice(5), leads: v }));
}

function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function dealSizeDistribution(d: Dataset) {
  const funded = d.deals.filter((x) => x.stage === FUNDED_STAGE);
  return TIER_1_BANDS.map((band) => {
    const inBand = funded.filter(
      (x) => x.amount >= band.min && x.amount < band.max
    );
    return {
      label: band.label,
      count: inBand.length,
      payout: band.payout,
      volume: inBand.reduce((s, x) => s + x.amount, 0),
    };
  });
}

export function staleDeals(d: Dataset, thresholdDays = 21) {
  const now = Date.now();
  return d.deals
    .filter((x) => x.stage !== FUNDED_STAGE)
    .map((x) => ({
      ...x,
      idleDays: Math.floor((now - new Date(x.updatedAt).getTime()) / 86_400_000),
    }))
    .filter((x) => x.idleDays >= thresholdDays)
    .sort((a, b) => b.idleDays - a.idleDays);
}

export function callMetrics(d: Dataset) {
  const total = d.calls.length;
  const booked = d.calls.filter((c) => c.outcome === "Booked").length;
  const connected = d.calls.filter(
    (c) => c.outcome === "Booked" || c.outcome === "Answered"
  ).length;
  const avgDuration = total
    ? d.calls.reduce((s, c) => s + c.durationSec, 0) / total
    : 0;

  const withCall = d.contacts.filter((c) => c.firstCallAt);
  const speeds = withCall.map(
    (c) =>
      (new Date(c.firstCallAt!).getTime() - new Date(c.createdAt).getTime()) /
      60_000
  );
  speeds.sort((a, b) => a - b);
  const medianSpeed = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 0;
  const under5 = speeds.filter((s) => s <= 5).length;

  return {
    total,
    booked,
    bookRate: total ? booked / total : 0,
    connectRate: total ? connected / total : 0,
    avgDuration,
    medianSpeedMin: medianSpeed,
    under5Rate: speeds.length ? under5 / speeds.length : 0,
    contacted: withCall.length,
    uncontacted: d.contacts.length - withCall.length,
  };
}

export function callOutcomes(d: Dataset) {
  const map = new Map<string, number>();
  for (const c of d.calls) map.set(c.outcome, (map.get(c.outcome) ?? 0) + 1);
  return [...map.entries()]
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count);
}

export function callVolumeByWeek(d: Dataset) {
  const map = new Map<string, { calls: number; booked: number }>();
  for (const c of d.calls) {
    const k = weekKey(c.createdAt);
    const cur = map.get(k) ?? { calls: 0, booked: 0 };
    cur.calls += 1;
    if (c.outcome === "Booked") cur.booked += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([k, v]) => ({ week: k.slice(5), ...v }));
}

export function commissionTable(d: Dataset) {
  const directory = new Map(
    d.affiliates.map((a) => [
      a.id,
      { name: a.name, tier: a.tier as Tier, uplineId: a.uplineId },
    ])
  );

  const rows: DealRow[] = d.deals
    .filter((x) => x.stage === FUNDED_STAGE)
    .map((x) => {
      const aff = directory.get(x.affiliateId);
      return {
        opportunityId: x.id,
        fundedAmount: x.amount,
        affiliateId: x.affiliateId,
        uplineId: aff?.uplineId ?? null,
        tier: aff?.tier ?? "TIER_1",
        netBrokerFee: x.netBrokerFee,
        fundedAt: x.updatedAt,
      };
    });

  return rollup(rows, directory);
}

export function affiliateTree(d: Dataset) {
  const totals = commissionTable(d);
  const byId = new Map(totals.map((t) => [t.affiliateId, t]));

  const roots = d.affiliates.filter((a) => !a.uplineId);
  return roots.map((root) => {
    const self = byId.get(root.id);
    const children = d.affiliates
      .filter((a) => a.uplineId === root.id)
      .map((c) => byId.get(c.id))
      .filter(Boolean);

    return {
      am: self ?? {
        affiliateId: root.id,
        name: root.name,
        tier: root.tier,
        uplineId: null,
        directDeals: 0,
        directFunded: 0,
        directEarnings: 0,
        pendingEarnings: 0,
        overrideEarnings: 0,
        overrideDeals: 0,
        totalEarnings: 0,
        downlineDeals: 0,
        downlineFunded: 0,
      },
      sams: children as NonNullable<(typeof children)[number]>[],
    };
  });
}
