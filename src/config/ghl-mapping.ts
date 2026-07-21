export const FIELD_IDS = {
  referredBy: process.env.GHL_FIELD_REFERRED_BY ?? "",
  amId: process.env.GHL_FIELD_AM_ID ?? "",
  samId: process.env.GHL_FIELD_SAM_ID ?? "",
  campaign: process.env.GHL_FIELD_CAMPAIGN ?? "",
  netBrokerFee: process.env.GHL_FIELD_NET_BROKER_FEE ?? "",
} as const;

export const TIER_2_CAMPAIGN_MARKERS = (
  process.env.GHL_TIER_2_MARKERS ?? "tier 2,tier2,professional,paid"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function resolveTier(campaignValue: string | null): "TIER_1" | "TIER_2" {
  if (!campaignValue) return "TIER_1";
  const v = campaignValue.toLowerCase();
  return TIER_2_CAMPAIGN_MARKERS.some((m) => v.includes(m))
    ? "TIER_2"
    : "TIER_1";
}

export const PIPELINE = {
  fundedPipelineId: process.env.GHL_FUNDED_PIPELINE_ID ?? "",
  fundedStageNames: (process.env.GHL_FUNDED_STAGE_NAMES ?? "funded,closed won,won")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
} as const;

export function isFundedStage(stageName: string | undefined): boolean {
  if (!stageName) return false;
  const n = stageName.toLowerCase();
  return PIPELINE.fundedStageNames.some((s) => n.includes(s));
}

export const STALE_DEAL_DAYS = Number(process.env.STALE_DEAL_DAYS ?? 21);

export function missingFieldIds(): string[] {
  const required: Array<[string, string]> = [
    ["Referred By", FIELD_IDS.referredBy],
    ["AM ID", FIELD_IDS.amId],
    ["SAM ID", FIELD_IDS.samId],
    ["Campaign", FIELD_IDS.campaign],
  ];
  return required.filter(([, id]) => !id).map(([label]) => label);
}
