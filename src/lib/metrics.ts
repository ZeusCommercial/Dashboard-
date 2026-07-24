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
import { hasLiveCredentials, loadLiveDataset } from "./ghl-data";

export const FUNDED_STAGE = "Funded";

/** Matches "Funded", "funded / closed", "Funded/Closed", etc. */
export function isFundedStage(stage: string): boolean {
  return (stage ?? "").toLowerCase().includes("funded");
}

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

export async function loadDataset(opts: {
  pipelineId?: string | null;
} = {}): Promise<Dataset> {
  if (!hasLiveCredentials()) {
    return {
      deals: mockDeals(),
      contacts: mockContacts(),
      calls: mockCalls(),
      affiliates: MOCK_AFFILIATES,
      isMock: true,
      generatedAt: new Date().toISOString(),
      pipelines: [],
      pipelineFilter: null,
    };
  }

  const live = await loadLiveDataset(opts);
  return {
    deals: live.deals,
    contacts: live.contacts,
    calls: live.calls,
    affiliates: live.affiliates,
    isMock: false,
    generatedAt: live.generatedAt,
    pipelines: live.pipelines,
    pipelineFilter: live.pipelineFilter,
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
  const funded = d.deals.filter((x) => isFundedStage(x.stage));
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

  const openDeals = d.deals.filter((x) => !isFundedStage(x.stage));
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
    if (!isFundedStage(deal.stage)) continue;
    const k = monthKey(deal.updatedAt);
    map.set(k, (map.get(k) ?? 0) + deal.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([k, v]) => ({ month: monthLabel(k), revenue: v }));
}

/**
 * Stage order is derived from the data itself rather than a fixed list, so
 * the chart works for any pipeline. Deals carry stagePosition when the loader
 * can resolve it from the GHL pipeline definition; otherwise we fall back to
 * first-seen order and push funded stages to the end.
 */
export function pipelineByStage(d: Dataset) {
 const map = new Map<string, { count: number; value: number; position: number }>();

  d.deals.forEach((deal, i) => {
    const stage = deal.stage ?? "Unassigned";
    const cur = map.get(stage) ?? {
      count: 0,
      value: 0,
      position: (deal as { stagePosition?: number }).stagePosition ?? i,
    };
    cur.count += 1;
    cur.value += deal.amount;
    map.set(stage, cur);
  });

  return [...map.entries()]
    .map(([stage, v]) => ({ stage, count: v.count, value: v.value, position: v.position }))
    .sort((a, b) => {
      const af = isFundedStage(a.stage) ? 1 : 0;
      const bf = isFundedStage(b.stage) ? 1 : 0;
      if (af !== bf) return af - bf;
      return a.position - b.position;
    })
    .map(({ stage, count, value }) => ({ stage, count, value }));
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

/**
 * When a pipeline filter is active, only count contacts that actually have a
 * deal in that pipeline — otherwise the chart shows every lead in the account
 * regardless of the selected filter.
 */
export function leadsOverTime(d: Dataset) {
  let contacts = d.contacts;

  if (d.pipelineFilter) {
    const ids = new Set(
      d.deals
        .map((x) => (x as { contactId?: string }).contactId)
        .filter(Boolean) as string[]
    );
    if (ids.size) contacts = d.contacts.filter((c) => ids.has(c.id));
  }

  const map = new Map<string, number>();
  for (const c of contacts) {
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
  const funded = d.deals.filter((x) => isFundedStage(x.stage));
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
    .filter((x) => !isFundedStage(x.stage))
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
    .filter((x) => isFundedStage(x.stage))
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

type Person = {
  ids: string[];
  name: string;
  tier: Tier;
  uplineId: string | null;
};

export function affiliateTree(d: Dataset) {
  const totals = commissionTable(d);
  const byId = new Map(totals.map((t) => [t.affiliateId, t]));

  const people = new Map<string, Person>();
  for (const a of d.affiliates) {
    const key = a.name;
    const existing = people.get(key);
    if (existing) {
      existing.ids.push(a.id);
    } else {
      people.set(key, {
        ids: [a.id],
        name: a.name,
        tier: a.tier as Tier,
        uplineId: a.uplineId,
      });
    }
  }

  const ownerOfId = new Map<string, string>();
  for (const [key, p] of people) {
    for (const id of p.ids) ownerOfId.set(id, key);
  }

  const merge = (p: Person) => {
    const parts = p.ids
      .map((id) => byId.get(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
    const sum = (f: (x: (typeof parts)[number]) => number) =>
      parts.reduce((s, x) => s + f(x), 0);

    return {
      affiliateId: p.ids[0],
      name: p.name,
      tier: p.tier,
      uplineId: p.uplineId,
      directDeals: sum((x) => x.directDeals),
      directFunded: sum((x) => x.directFunded),
      directEarnings: sum((x) => x.directEarnings),
      pendingEarnings: sum((x) => x.pendingEarnings),
      overrideEarnings: sum((x) => x.overrideEarnings),
      overrideDeals: sum((x) => x.overrideDeals),
      totalEarnings: sum((x) => x.totalEarnings),
      downlineDeals: sum((x) => x.downlineDeals),
      downlineFunded: sum((x) => x.downlineFunded),
    };
  };

  const all = [...people.values()];
  const roots = all.filter((p) => !p.uplineId || !ownerOfId.has(p.uplineId));

  return roots.map((root) => {
    const children = all.filter(
      (p) => p.uplineId && ownerOfId.get(p.uplineId) === root.name
    );
    return { am: merge(root), sams: children.map(merge) };
  });
}

export type MonthBucket = { key: string; label: string; full: string };

export function trailingMonths(n = 6): MonthBucket[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short" }),
      full: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
    };
  });
}

function monthKeyOf(input: string | Date | null | undefined): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type FundedVolumeRow = {
  key: string;
  label: string;
  full: string;
  funded: number;
  deals: number;
};

export function fundedVolumeByMonth(d: Dataset, n = 6): FundedVolumeRow[] {
  const buckets = new Map<string, { funded: number; deals: number }>();

  for (const deal of d.deals) {
    if (!isFundedStage(deal.stage)) continue;
    const k = monthKeyOf(deal.updatedAt);
    if (!k) continue;
    const b = buckets.get(k) ?? { funded: 0, deals: 0 };
    b.funded += deal.amount || 0;
    b.deals += 1;
    buckets.set(k, b);
  }

  return trailingMonths(n).map((m) => ({
    ...m,
    funded: buckets.get(m.key)?.funded ?? 0,
    deals: buckets.get(m.key)?.deals ?? 0,
  }));
}

export type ApprovalRow = {
  key: string;
  label: string;
  full: string;
  submitted: number;
  approved: number;
  declined: number;
  rate: number | null;
};

/**
 * Stage names are matched loosely because they vary per pipeline. A deal that
 * reached any post-submission stage counts toward volume, so the approval rate
 * denominator reflects everything that actually got underwritten.
 */
export function approvalTrendByMonth(d: Dataset, n = 6): ApprovalRow[] {
  const buckets = new Map
    string,
    { submitted: number; approved: number; declined: number }
  >();

  const bump = (
    k: string | null,
    field: "submitted" | "approved" | "declined"
  ) => {
    if (!k) return;
    const b = buckets.get(k) ?? { submitted: 0, approved: 0, declined: 0 };
    b[field] += 1;
    buckets.set(k, b);
  };

  for (const deal of d.deals) {
    const stage = (deal.stage || "").toLowerCase();
    const k = monthKeyOf(deal.updatedAt);

    if (/submitted|underwriting|approved|funded|declined|denied/.test(stage)) {
      bump(k, "submitted");
    }
    if (/approved|funded/.test(stage)) bump(k, "approved");
    if (/declined|denied|dead/.test(stage)) bump(k, "declined");
  }

  return trailingMonths(n).map((m) => {
    const b = buckets.get(m.key);
    const submitted = b?.submitted ?? 0;
    return {
      ...m,
      submitted,
      approved: b?.approved ?? 0,
      declined: b?.declined ?? 0,
      rate: submitted > 0 ? ((b?.approved ?? 0) / submitted) * 100 : null,
    };
  });
}
