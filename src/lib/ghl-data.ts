/**
 * Real GHL data loader. Replaces mock.ts's loadDataset() with live queries.
 *
 * Data model:
 *   - Opportunities → funded revenue, pipeline, deal size distribution
 *   - Contacts → leads over time, speed to lead, referral attribution
 *   - Google Sheet (published CSV) → the affiliate directory
 *
 * The affiliate registry lives in a Google Sheet, kept in sync with GHL by an
 * Apps Script running on an hourly trigger. Tracking IDs come from a periodic
 * CSV export out of GHL's Affiliate Manager, which has no public API.
 *
 * Every contact carries a `Recruited By` / `Recruited_By` / `Recruited__By`
 * custom field. Whichever is populated holds the affiliate's tracking ID.
 * We look that ID up against the registry to find name, tier, upline.
 */

import {
  getContacts,
  getOpportunities,
  getPipelines,
  getVoiceAiCalls,
  deriveVoiceOutcome,
  readCustomField,
  type GhlContact,
  type GhlOpportunity,
} from "./ghl";
import type { Tier } from "./commission";
import type { MockCall, MockContact, MockDeal, MockAffiliate } from "./mock";

/** Contacts carrying this tag are partners, not leads. */
const PARTNER_TAG = "partner-approved";

/** Published CSV of the Affiliates tab. Set in Render env vars. */
const SHEET_CSV_URL = process.env.AFFILIATE_SHEET_CSV_URL ?? "";

const FIELDS = {
  // Recruited By variants on regular contacts
  recruitedBy: "glbP7zcGHXcbJAIKSxEd",
  recruitedByAlt: "nMzqOUgBOUumttRz8pu8",
  recruitedByAlt2: "vsW789sMZ75ewGxJG0uv",
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

/** Minimal CSV parser — handles quoted fields, embedded commas, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Loads the affiliate directory from the published Google Sheet.
 *
 * Each partner has up to two tracking IDs (Funding Campaign and Partner
 * Program), so one sheet row can produce two registry entries — both pointing
 * at the same person, so a deal attributed to either campaign resolves.
 */
async function loadAffiliateRegistry(): Promise<MockAffiliate[]> {
  if (!SHEET_CSV_URL) {
    console.warn("AFFILIATE_SHEET_CSV_URL not set — affiliate registry empty");
    return [];
  }

  let text: string;
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn(`Affiliate sheet fetch failed: ${res.status}`);
      return [];
    }
    text = await res.text();
  } catch (err) {
    console.warn("Affiliate sheet fetch threw:", err);
    return [];
  }

  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);

  const iName = col("name");
  const iTid = col("tracking_id");
  const iTidAlt = col("tracking_id_alt");
  const iTier = col("tier");
  const iAm = col("am_id");
  const iSam = col("sam_id");
  const iStatus = col("status");

  if (iName === -1 || iTid === -1) {
    console.warn("Affiliate sheet headers not recognised:", head.join(" | "));
    return [];
  }

  const registry: MockAffiliate[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const cell = (i: number) => (i === -1 ? "" : (row[i] ?? "").trim());

    if (cell(iStatus).toLowerCase() === "inactive") continue;

    const name = cell(iName) || "Unknown affiliate";
    const tier: Tier = cell(iTier).includes("2") ? "TIER_2" : "TIER_1";

    // A partner recruited by a SAM sits under that SAM; otherwise under their AM.
    const uplineId = cell(iSam) || cell(iAm) || null;

    for (const raw of [cell(iTid), cell(iTidAlt)]) {
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      registry.push({ id: raw, name, tier, uplineId });
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

  const [pipelines, opportunities, contacts, affiliates, voiceCalls] =
    await Promise.all([
      getPipelines(),
      getOpportunities({ pipelineId: pipelineId ?? undefined, maxPages: 40 }),
      getContacts({ maxPages: 40 }),
      loadAffiliateRegistry(),
      getVoiceAiCalls({ pageSize: 50, maxPages: 50 }),
    ]);

  // Build stage-id -> name and stage-id -> position maps across every pipeline.
  // Opportunities reference stage by ID, not name, so we resolve here. Position
  // drives chart ordering so "Pipeline by Stage" follows the real GHL order for
  // whichever pipeline is selected, rather than a hardcoded list.
  const stageIdToName = new Map<string, string>();
  const stageIdToPosition = new Map<string, number>();
  const pipelineIdToName = new Map<string, string>();
  for (const p of pipelines) {
    pipelineIdToName.set(p.id, p.name);
    p.stages.forEach((s, i) => {
      stageIdToName.set(s.id, s.name);
      stageIdToPosition.set(s.id, (s as { position?: number }).position ?? i);
    });
  }

  // Index contacts by id so deal → contact lookup is O(1) rather than a scan.
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  // Turn GHL opportunities into the shape metrics.ts already understands.
  const deals: MockDeal[] = opportunities.map((o: GhlOpportunity) => {
    const stageName = stageIdToName.get(o.pipelineStageId ?? "") ?? "Unknown";
    const contact = o.contactId ? contactById.get(o.contactId) : undefined;
    const affiliateId = contact ? readRecruitedBy(contact) : null;

    return {
      id: o.id,
      name: o.name ?? "Untitled Deal",
      amount: Number(o.monetaryValue ?? 0),
      stage: isFundedStageName(stageName) ? "Funded" : stageName,
      affiliateId: affiliateId ?? "unattributed",
      // Carried through so leadsOverTime() can narrow contacts to the
      // selected pipeline, and so stage charts sort in real pipeline order.
      contactId: o.contactId ?? null,
      stagePosition: stageIdToPosition.get(o.pipelineStageId ?? "") ?? 999,
      pipelineId: o.pipelineId ?? null,
      createdAt: o.createdAt ?? new Date().toISOString(),
      updatedAt:
        o.updatedAt ?? o.lastStatusChangeAt ?? o.createdAt ?? new Date().toISOString(),
      netBrokerFee: null, // GHL doesn't record this yet — Tier 2 stays pending
    };
  });

  // Map Voice AI calls into the MockCall shape the AI Calls page consumes.
  const calls: MockCall[] = voiceCalls.map((vc) => ({
    id: vc.id,
    contactId: vc.contactId ?? "unknown",
    durationSec: vc.duration ?? 0,
    outcome: deriveVoiceOutcome(vc),
    createdAt: vc.createdAt ?? new Date().toISOString(),
  }));

  // Earliest call timestamp per contact → powers speed-to-lead + rapid response.
  const firstCallByContact = new Map<string, string>();
  for (const vc of voiceCalls) {
    if (!vc.contactId || !vc.createdAt) continue;
    const existing = firstCallByContact.get(vc.contactId);
    if (!existing || vc.createdAt < existing) {
      firstCallByContact.set(vc.contactId, vc.createdAt);
    }
  }

  // Contacts feed leads-over-time and speed-to-lead metrics.
  // Skip partner contacts — they're affiliates, not leads.
  const leadContacts: MockContact[] = contacts
    .filter(
      (c) => !(c.tags ?? []).map((t) => t.toLowerCase()).includes(PARTNER_TAG)
    )
    .map((c) => ({
      id: c.id,
      createdAt: c.dateAdded ?? new Date().toISOString(),
      firstCallAt: firstCallByContact.get(c.id) ?? null,
    }));

  // Include unattributed as a synthetic affiliate so those deals still appear
  // in totals rather than silently disappearing.
  const affiliatesWithUnattributed: MockAffiliate[] = [
    ...affiliates,
    { id: "unattributed", name: "Direct / No Partner", tier: "TIER_1", uplineId: null },
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
