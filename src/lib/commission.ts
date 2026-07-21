export type Tier = "TIER_1" | "TIER_2";

export const UPLINE_OVERRIDE_USD = 100;

export const TIER_1_BANDS = [
  { min: 0, max: 100_000, payout: 250, label: "Under $100K" },
  { min: 100_000, max: 500_000, payout: 500, label: "$100K – $499K" },
  { min: 500_000, max: 1_000_000, payout: 750, label: "$500K – $999K" },
  { min: 1_000_000, max: Infinity, payout: 1_000, label: "$1M+" },
] as const;

export const TIER_2_RATE = 0.10;

export type CommissionInput = {
  fundedAmount: number;
  tier: Tier;
  netBrokerFee: number | null;
  hasUpline: boolean;
};

export type CommissionResult = {
  affiliateEarning: number | null;
  uplineOverride: number;
  bandLabel: string | null;
  pendingReason: string | null;
};

export function bandFor(fundedAmount: number) {
  return (
    TIER_1_BANDS.find((b) => fundedAmount >= b.min && fundedAmount < b.max) ??
    TIER_1_BANDS[TIER_1_BANDS.length - 1]
  );
}

export function calculateCommission(input: CommissionInput): CommissionResult {
  const { fundedAmount, tier, netBrokerFee, hasUpline } = input;
  const uplineOverride = hasUpline ? UPLINE_OVERRIDE_USD : 0;

  if (tier === "TIER_1") {
    const band = bandFor(fundedAmount);
    return {
      affiliateEarning: band.payout,
      uplineOverride,
      bandLabel: band.label,
      pendingReason: null,
    };
  }

  if (netBrokerFee === null || netBrokerFee === undefined) {
    return {
      affiliateEarning: null,
      uplineOverride,
      bandLabel: null,
      pendingReason: "Net broker fee not recorded in GHL",
    };
  }

  return {
    affiliateEarning: Math.round(netBrokerFee * TIER_2_RATE * 100) / 100,
    uplineOverride,
    bandLabel: null,
    pendingReason: null,
  };
}

export type DealRow = {
  opportunityId: string;
  fundedAmount: number;
  affiliateId: string | null;
  uplineId: string | null;
  tier: Tier;
  netBrokerFee: number | null;
  fundedAt: string | null;
};

export type AffiliateTotals = {
  affiliateId: string;
  name: string;
  tier: Tier;
  uplineId: string | null;
  directDeals: number;
  directFunded: number;
  directEarnings: number;
  pendingEarnings: number;
  overrideEarnings: number;
  overrideDeals: number;
  totalEarnings: number;
  downlineDeals: number;
  downlineFunded: number;
};

export function rollup(
  deals: DealRow[],
  directory: Map<string, { name: string; tier: Tier; uplineId: string | null }>
): AffiliateTotals[] {
  const totals = new Map<string, AffiliateTotals>();

  const ensure = (id: string): AffiliateTotals => {
    const existing = totals.get(id);
    if (existing) return existing;
    const meta = directory.get(id);
    const fresh: AffiliateTotals = {
      affiliateId: id,
      name: meta?.name ?? id,
      tier: meta?.tier ?? "TIER_1",
      uplineId: meta?.uplineId ?? null,
      directDeals: 0,
      directFunded: 0,
      directEarnings: 0,
      pendingEarnings: 0,
      overrideEarnings: 0,
      overrideDeals: 0,
      totalEarnings: 0,
      downlineDeals: 0,
      downlineFunded: 0,
    };
    totals.set(id, fresh);
    return fresh;
  };

  for (const deal of deals) {
    if (!deal.affiliateId) continue;

    const meta = directory.get(deal.affiliateId);
    const tier = meta?.tier ?? deal.tier;
    const uplineId = meta?.uplineId ?? deal.uplineId;

    const result = calculateCommission({
      fundedAmount: deal.fundedAmount,
      tier,
      netBrokerFee: deal.netBrokerFee,
      hasUpline: Boolean(uplineId),
    });

    const affiliate = ensure(deal.affiliateId);
    affiliate.directDeals += 1;
    affiliate.directFunded += deal.fundedAmount;

    if (result.affiliateEarning === null) {
      affiliate.pendingEarnings += 1;
    } else {
      affiliate.directEarnings += result.affiliateEarning;
    }

    if (uplineId && result.uplineOverride > 0) {
      const upline = ensure(uplineId);
      upline.overrideEarnings += result.uplineOverride;
      upline.overrideDeals += 1;
      upline.downlineDeals += 1;
      upline.downlineFunded += deal.fundedAmount;
    }
  }

  for (const t of totals.values()) {
    t.totalEarnings = t.directEarnings + t.overrideEarnings;
  }

  return [...totals.values()].sort((a, b) => b.directFunded - a.directFunded);
}
