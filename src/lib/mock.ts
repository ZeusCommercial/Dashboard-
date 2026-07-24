import type { Tier } from "./commission";

let seed = 20260720;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function between(min: number, max: number): number {
  return Math.floor(min + rand() * (max - min));
}

export type MockAffiliate = {
  id: string;
  name: string;
  tier: Tier;
  uplineId: string | null;
};

export const MOCK_AFFILIATES: MockAffiliate[] = [
  { id: "AM-1001", name: "Marcus Webb", tier: "TIER_1", uplineId: null },
  { id: "AM-1002", name: "Danielle Ortiz", tier: "TIER_2", uplineId: null },
  { id: "AM-1003", name: "Terrence Hall", tier: "TIER_1", uplineId: null },
  { id: "SAM-2001", name: "Priya Raman", tier: "TIER_1", uplineId: "AM-1001" },
  { id: "SAM-2002", name: "Jordan Fisk", tier: "TIER_1", uplineId: "AM-1001" },
  { id: "SAM-2003", name: "Alicia Moreau", tier: "TIER_2", uplineId: "AM-1002" },
  { id: "SAM-2004", name: "Devon Pike", tier: "TIER_2", uplineId: "AM-1002" },
  { id: "SAM-2005", name: "Rosa Delgado", tier: "TIER_1", uplineId: "AM-1003" },
  { id: "SAM-2006", name: "Kenji Watanabe", tier: "TIER_1", uplineId: "AM-1003" },
];

export const MOCK_STAGES = [
  "New Lead",
  "Contacted",
  "Application Sent",
  "Underwriting",
  "Offer Presented",
  "Funded",
] as const;

const BUSINESS_NAMES = [
  "Ridgeline Logistics",
  "Copperfield Dental",
  "Vega Auto Group",
  "Northgate HVAC",
  "Silver Birch Cafe",
  "Titan Roofing",
  "Blue Harbor Marine",
  "Cascade Print Works",
  "Meridian Staffing",
  "Ironwood Construction",
  "Lakeside Veterinary",
  "Summit Freight",
  "Halcyon Medspa",
  "Pinnacle Fitness",
  "Redstone Machining",
  "Willow Creek Landscaping",
  "Apex Security Systems",
  "Golden Spoon Catering",
  "Fairmount Auto Body",
  "Cedar Point Pharmacy",
] as const;

export type MockDeal = {
  id: string;
  name: string;
  amount: number;
  stage: string;
  affiliateId: string;
  createdAt: string;
  updatedAt: string;
  netBrokerFee: number | null;
  /** Set by the live loader; used to scope leads-over-time to a pipeline. */
  contactId?: string | null;
  /** Real GHL stage order, so charts sort correctly per pipeline. */
  stagePosition?: number;
  pipelineId?: string | null;
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function mockDeals(count = 148): MockDeal[] {
  const deals: MockDeal[] = [];

  for (let i = 0; i < count; i++) {
    const affiliate = pick(MOCK_AFFILIATES);

    const roll = rand();
    let amount: number;
    if (roll < 0.46) amount = between(18_000, 99_000);
    else if (roll < 0.78) amount = between(100_000, 499_000);
    else if (roll < 0.93) amount = between(500_000, 999_000);
    else amount = between(1_000_000, 3_400_000);

    const stageRoll = rand();
    let stage: string;
    if (stageRoll < 0.24) stage = "New Lead";
    else if (stageRoll < 0.44) stage = "Contacted";
    else if (stageRoll < 0.6) stage = "Application Sent";
    else if (stageRoll < 0.74) stage = "Underwriting";
    else if (stageRoll < 0.84) stage = "Offer Presented";
    else stage = "Funded";

    // Mirrors what the live loader derives from GHL stage positions, so mock
    // and live data render through the same ordering path.
    const stagePosition = MOCK_STAGES.indexOf(
      stage as (typeof MOCK_STAGES)[number]
    );

    const createdDaysAgo = between(1, 180);
    const updatedDaysAgo = Math.max(0, createdDaysAgo - between(0, 40));

    deals.push({
      id: `opp_${String(i).padStart(4, "0")}`,
      name: `${pick(BUSINESS_NAMES)} — Working Capital`,
      amount,
      stage,
      affiliateId: affiliate.id,
      contactId: `con_${between(0, 640)}`,
      stagePosition,
      pipelineId: null,
      createdAt: daysAgo(createdDaysAgo),
      updatedAt: daysAgo(updatedDaysAgo),
      netBrokerFee: null,
    });
  }

  return deals;
}

export type MockContact = {
  id: string;
  createdAt: string;
  firstCallAt: string | null;
};

export function mockContacts(count = 640): MockContact[] {
  const contacts: MockContact[] = [];
  for (let i = 0; i < count; i++) {
    const created = between(0, 180);
    const answered = rand() < 0.72;
    const delayMin = rand() < 0.8 ? between(1, 12) : between(30, 900);

    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - created);

    const firstCall = new Date(createdDate.getTime() + delayMin * 60_000);

    contacts.push({
      id: `con_${i}`,
      createdAt: createdDate.toISOString(),
      firstCallAt: answered ? firstCall.toISOString() : null,
    });
  }
  return contacts;
}

export type MockCall = {
  id: string;
  contactId: string;
  durationSec: number;
  outcome: "Booked" | "Answered" | "No Answer" | "Voicemail" | "Declined";
  createdAt: string;
};

export function mockCalls(count = 910): MockCall[] {
  const calls: MockCall[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rand();
    let outcome: MockCall["outcome"];
    if (roll < 0.18) outcome = "Booked";
    else if (roll < 0.46) outcome = "Answered";
    else if (roll < 0.7) outcome = "No Answer";
    else if (roll < 0.88) outcome = "Voicemail";
    else outcome = "Declined";

    const durationSec =
      outcome === "Booked"
        ? between(180, 620)
        : outcome === "Answered"
          ? between(45, 300)
          : outcome === "Voicemail"
            ? between(12, 45)
            : between(3, 20);

    calls.push({
      id: `call_${i}`,
      contactId: `con_${between(0, 640)}`,
      durationSec,
      outcome,
      createdAt: daysAgo(between(0, 180)),
    });
  }
  return calls;
}

export function usingMockData(): boolean {
  return !process.env.GHL_PRIVATE_TOKEN || !process.env.GHL_LOCATION_ID;
}
