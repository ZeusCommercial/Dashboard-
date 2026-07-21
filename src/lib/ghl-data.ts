/**
 * Real GHL data loader. Replaces mock.ts's loadDataset() with live queries.
 *
 * Data model:
 *   - Opportunities → funded revenue, pipeline, deal size distribution
 *   - Contacts → leads over time, speed to lead, referral attribution
 *   - Contacts tagged "zeus-affiliate-registry" → the affiliate directory
 *
 * Every contact carries a `Recruited By` / `Recruited_By` / `Recruited__By`
 * custom field. Whichever is populated holds the affiliate's tracking ID.
 * We look that ID up against the registry to find name, tier, upline.
 */

import {
  getContacts,
  getOpportunities,
  getPipelines,
  readCustomField,
  type GhlContact,
  type GhlOpportunity,
} from "./ghl";
import type { Tier } from "./commission";
import type { MockCall, MockContact, MockDeal, MockAffiliate } from "./mock";

const AFFILIATE_REGISTRY_TAG = "zeus-affiliate-registry";

const FIELDS = {
  // Recruited By variants on regular contacts
  recruitedBy: "glbP7zcGHXcbJAIKSxEd",
  recruitedByAlt: "nMzqOUgBOUumttRz8pu8",
  recruitedByAlt2: "vsW789sMZ75ewGxJG0uv",

  // On affiliate registry contacts (tagged zeus-affiliate-registry)
  affiliateTrackingId: "Raml4g6BgdIS2CobSgzf",
  affiliateTrackingIdAlt: "SV3S8P8zXRVOj4nPvwAn",
  affiliateTier: "ZSXSqPwOVXHQRDqbKxem",
  affiliateParentId: "11OmfSAnnzzL0EGzivU4",
  affiliateStatus: "TNu1915OsWun22JwSsiX",
} as const;

/** Reads the affiliate tracking ID from a contact, trying all three field variants. */
function readRecruitedBy(contact: GhlContact): string | null {
  return (
    readCustomField(contact, FIELDS.recruitedBy) ||
    readCustomField(contact, FIELDS.recruitedByAlt) ||
    readCustomField(contact, FIELDS.recruitedByAlt2) ||
    null
  );
}

/**
 * Loads the affiliate directory from contacts tagged `zeus-affiliate-registry`.
 * Every affiliate is a real contact record; their tracking IDs, tier, and
 * parent are in custom fields.
 */
async function loadAffiliateRegistry(): Promise<MockAffiliate[]> {
  // Pull all contacts, filter by tag client-side. GHL's search-by-tag isn't
  // reliable across versions, so this is the safer path.
  const contacts = await getContacts({ maxPages: 40 });

  const registry: MockAffiliate[] = [];
  const seenIds = new Set<string>();

  for (const c of contacts) {
    const tags = (c.tags ?? []).map((t) => t.toLowerCase());
    if (!tags.includes(AFFILIATE_REGISTRY_TAG)) continue;

    const status = readCustomField(c, FIELDS.affiliateStatus);
    if (status && status.toLowerCase() === "inactive") continue;

    const primaryId = readCustomField(c, FIELDS.affiliateTrackingId);
    const altId = readCustomField(c, FIELDS.affiliateTrackingIdAlt);
    const tierRaw = readCustomField(c, FIELDS.affiliateTier);
    const parentId = readCustomField(c, FIELDS.affiliateParentId);

    const tier: Tier =
      (tierRaw ?? "").toUpperCase().includes("2") ? "TIER_2" : "TIER_1";

    const name =
      [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
      c.email ||
      primaryId ||
      "Unknown affiliate";

    // Each contact can produce up to 2 registry entries — one per tracking ID.
    for (const id of [primaryId, altId]) {
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      registry.push({
        id,
        name,
        tier,
        uplineId: parentId || null,
      });
    }
  }

  return registry;
}

/**
 * Which pipelines and stages count as "funded". Configurable via env so you
 * can adjust without a redeploy. Matched case-insensitively as substrings.
 */
function fundedStageMatchers(): string[] {
  return (process.env.GHL_FUNDED_STAGE_NAMES ?? "funded,funded / closed,closed won,won")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isFundedStageName(name: string | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return fundedStageMatchers().some((m) => n.includes(m));
}

export type LiveDataset = {
  deals: MockDeal[];
  contacts: MockContact[];
  calls: MockCall[];
  affiliates: MockAffiliate[];
  isMock: boolean;
  generatedAt: string;
  pipelines: { id: string; name: string }[];
  pipelineFilter: string | null;
};

/**
 * Loads live GHL data and shapes it into the same structure the pages already
 * consume. Nothing downstream needs to change.
 */
export async function loadLiveDataset(opts: {
  pipelineId?: string | null;
} = {}): Promise<LiveDataset> {
  const { pipelineId } = opts;

  // Fetch in parallel — big time saver, especially on cold starts.
  const [pipelines, opportunities, contacts, affiliates] = await Promise.all([
    getPipelines(),
    getOpportunities({ pipelineId: pipelineId ?? undefined, maxPages: 40 }),
    getContacts({ maxPages: 40 }),
    loadAffiliateRegistry(),
  ]);

  // Build a stage-id -> stage-name map across every pipeline. Opportunities
  // reference stage by ID, not name, so we resolve here.
  const stageIdToName = new Map<string, string>();
  const pipelineIdToName = new Map<string, string>();
  for (const p of pipelines) {
    pipelineIdToName.set(p.id, p.name);
    for (const s of p.stages) stageIdToName.set(s.id, s.name);
  }

  // Turn GHL opportunities into the shape metrics.ts already understands.
  const deals: MockDeal[] = opportunities.map((o: GhlOpportunity) => {
    const stageName = stageIdToName.get(o.pipelineStageId ?? "") ?? "Unknown";
    // Look up the referring affiliate through the source contact.
    const contact = contacts.find((c) => c.id === o.contactId);
    const affiliateId = contact ? readRecruitedBy(contact) : null;

    return {
      id: o.id,
      name: o.name ?? "Untitled Deal",
      amount: Number(o.monetaryValue ?? 0),
      stage: isFundedStageName(stageName) ? "Funded" : stageName,
      affiliateId: affiliateId ?? "unattributed",
      createdAt: o.createdAt ?? new Date().toISOString(),
      updatedAt: o.updatedAt ?? o.lastStatusChangeAt ?? o.createdAt ?? new Date().toISOString(),
      netBrokerFee: null, // GHL doesn't record this yet — Tier 2 stays pending
    };
  });

  // Contacts feed leads-over-time and speed-to-lead metrics.
  // Skip registry contacts — they're affiliates, not leads.
  const leadContacts: MockContact[] = contacts
    .filter((c) => !(c.tags ?? []).map((t) => t.toLowerCase()).includes(AFFILIATE_REGISTRY_TAG))
    .map((c) => ({
      id: c.id,
      createdAt: c.dateAdded ?? new Date().toISOString(),
      // No call timing on the contact record itself — leave null; the AI Calls
      // page will show "—" until we wire calls from conversations.
      firstCallAt: null,
    }));

  // Calls: we'd pull from getCalls() but the conversation search endpoint's
  // shape varies. Leaving empty for now — AI Calls page will show zeroes,
  // which is honest rather than fabricated.
  const calls: MockCall[] = [];

  // Include unattributed as a synthetic affiliate so those deals still appear
  // in totals rather than silently disappearing.
  const affiliatesWithUnattributed: MockAffiliate[] = [
    ...affiliates,
    { id: "unattributed", name: "Unattributed", tier: "TIER_1", uplineId: null },
  ];

  return {
    deals,
    contacts: leadContacts,
    calls,
    affiliates: affiliatesWithUnattributed,
    isMock: false,
    generatedAt: new Date().toISOString(),
    pipelines: pipelines.map((p) => ({ id: p.id, name: p.name })),
    pipelineFilter: pipelineId ?? null,
  };
}

export function hasLiveCredentials(): boolean {
  return !!process.env.GHL_PRIVATE_TOKEN && !!process.env.GHL_LOCATION_ID;
}
