const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

const TOKEN = process.env.GHL_PRIVATE_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!TOKEN || !LOCATION_ID) {
  console.warn(
    "[ghl] GHL_PRIVATE_TOKEN or GHL_LOCATION_ID missing. API calls will fail."
  );
}

const WINDOW_MS = 10_000;
const MAX_IN_WINDOW = 85;

let timestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  timestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_IN_WINDOW) {
    const oldest = timestamps[0];
    const waitMs = WINDOW_MS - (now - oldest) + 50;
    await new Promise((r) => setTimeout(r, waitMs));
    return throttle();
  }

  timestamps.push(now);
}

export class GhlError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message);
    this.name = "GhlError";
  }
}

type RequestOpts = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  retries?: number;
};

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", query, body, retries = 3 } = opts;

  const url = new URL(`${GHL_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Version: GHL_VERSION,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch (networkErr) {
      if (attempt === retries) {
        throw new GhlError(
          `Network failure reaching GHL: ${(networkErr as Error).message}`,
          0,
          path
        );
      }
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      continue;
    }

    if (res.status === 429) {
      if (attempt === retries) {
        throw new GhlError("GHL rate limit exceeded", 429, path);
      }
      const retryAfter = Number(res.headers.get("Retry-After")) || 0;
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (res.status >= 500 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GhlError(
        `GHL ${res.status} on ${path}: ${text.slice(0, 300)}`,
        res.status,
        path
      );
    }

    return (await res.json()) as T;
  }

  throw new GhlError("Exhausted retries", 0, path);
}

export type GhlCustomFieldValue = {
  id: string;
  value?: string | number | null;
  fieldValue?: string | number | null;
};

export type GhlOpportunity = {
  id: string;
  name?: string;
  monetaryValue?: number;
  status?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastStatusChangeAt?: string;
  customFields?: GhlCustomFieldValue[];
  contact?: { id?: string; name?: string; email?: string };
};

export type GhlContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  customFields?: GhlCustomFieldValue[];
};

export type GhlPipeline = {
  id: string;
  name: string;
  stages: { id: string; name: string; position?: number }[];
};

export type GhlCustomFieldDef = {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
};

export async function getPipelines(): Promise<GhlPipeline[]> {
  const data = await request<{ pipelines: GhlPipeline[] }>(
    "/opportunities/pipelines",
    { query: { locationId: LOCATION_ID } }
  );
  return data.pipelines ?? [];
}

export async function getOpportunities(params: {
  pipelineId?: string;
  startDate?: string;
  endDate?: string;
  maxPages?: number;
} = {}): Promise<GhlOpportunity[]> {
  const { pipelineId, startDate, endDate, maxPages = 40 } = params;
  const all: GhlOpportunity[] = [];
  let page = 1;

  while (page <= maxPages) {
    const data = await request<{
      opportunities: GhlOpportunity[];
      meta?: { nextPageUrl?: string | null; total?: number };
    }>("/opportunities/search", {
      query: {
        location_id: LOCATION_ID,
        pipeline_id: pipelineId,
        startDate,
        endDate,
        limit: 100,
        page,
      },
    });

    const batch = data.opportunities ?? [];
    all.push(...batch);

    if (batch.length < 100 || !data.meta?.nextPageUrl) break;
    page++;
  }

  return all;
}

export async function getContacts(params: {
  startDate?: string;
  endDate?: string;
  maxPages?: number;
} = {}): Promise<GhlContact[]> {
  const { startDate, endDate, maxPages = 40 } = params;
  const all: GhlContact[] = [];
  let searchAfter: unknown[] | undefined;

  for (let i = 0; i < maxPages; i++) {
    const data = await request<{
      contacts: GhlContact[];
      total?: number;
    }>("/contacts/search", {
      method: "POST",
      body: {
        locationId: LOCATION_ID,
        pageLimit: 100,
        ...(searchAfter ? { searchAfter } : {}),
        ...(startDate || endDate
          ? {
              filters: [
                {
                  field: "dateAdded",
                  operator: "range",
                  value: { gte: startDate, lte: endDate },
                },
              ],
            }
          : {}),
      },
    });

    const batch = data.contacts ?? [];
    all.push(...batch);

    if (batch.length < 100) break;
    const last = batch[batch.length - 1] as unknown as {
      searchAfter?: unknown[];
    };
    if (!last?.searchAfter) break;
    searchAfter = last.searchAfter;
  }

  return all;
}

export async function getCustomFieldDefs(): Promise<GhlCustomFieldDef[]> {
  const data = await request<{ customFields: GhlCustomFieldDef[] }>(
    `/locations/${LOCATION_ID}/customFields`
  );
  return data.customFields ?? [];
}

export type GhlCall = {
  id: string;
  contactId?: string;
  direction?: string;
  status?: string;
  duration?: number;
  dateAdded?: string;
  callDuration?: number;
};

export async function getCalls(params: {
  startDate?: string;
  endDate?: string;
  maxPages?: number;
} = {}): Promise<GhlCall[]> {
  const { maxPages = 20 } = params;
  const all: GhlCall[] = [];

  for (let i = 0; i < maxPages; i++) {
    const data = await request<{
      conversations: Array<{
        id: string;
        contactId?: string;
        lastMessageType?: string;
        dateUpdated?: string;
      }>;
      total?: number;
    }>("/conversations/search", {
      query: {
        locationId: LOCATION_ID,
        limit: 100,
        offset: i * 100,
      },
    });

    const batch = data.conversations ?? [];
    const calls = batch
      .filter((c) => (c.lastMessageType ?? "").toUpperCase().includes("CALL"))
      .map((c) => ({
        id: c.id,
        contactId: c.contactId,
        dateAdded: c.dateUpdated,
      }));

    all.push(...calls);
    if (batch.length < 100) break;
  }

  return all;
}

export async function getCalendarEvents(params: {
  startDate: string;
  endDate: string;
}): Promise<Array<{ id: string; contactId?: string; startTime?: string; appointmentStatus?: string }>> {
  const data = await request<{
    events: Array<{
      id: string;
      contactId?: string;
      startTime?: string;
      appointmentStatus?: string;
    }>;
  }>("/calendars/events", {
    query: {
      locationId: LOCATION_ID,
      startTime: params.startDate,
      endTime: params.endDate,
    },
  });
  return data.events ?? [];
}

export function readCustomField(
  record: { customFields?: GhlCustomFieldValue[] },
  fieldId: string | undefined
): string | null {
  if (!fieldId || !record.customFields) return null;
  const hit = record.customFields.find((f) => f.id === fieldId);
  if (!hit) return null;
  const raw = hit.value ?? hit.fieldValue;
  return raw === null || raw === undefined ? null : String(raw);
}

// ─────────────────────────────────────────────────────────────────────────
// Voice AI call logs (Samantha). Replaces the old /conversations/search hack.
// Endpoint: GET /voice-ai/dashboard/call-logs  (scoped to a location)
// Docs: marketplace.gohighlevel.com/docs/ghl/voice-ai/get-call-logs
//
// NOTE: field names below are our best guess from the dashboard UI. The exact
// JSON keys are confirmed by running probeVoiceAiCalls() on /discover first.
// Adjust the mapping in getVoiceAiCalls once the probe shows the real shape.
// ─────────────────────────────────────────────────────────────────────────

export type GhlVoiceCall = {
  id: string;
  contactId?: string;
  contactName?: string;
  agentName?: string;
  fromNumber?: string;
  direction?: string;        // "inbound" | "outbound"
  durationSec: number;
  startedAt?: string;        // ISO
  actionsTriggered?: string[]; // e.g. ["Hot Lead Transfer to Thomas"]
  sentiment?: string;
  callStatus?: string;
};

/**
 * Raw probe — returns { status, sampleKeys, firstRecord } so we can see the
 * real response shape on the /discover page without guessing field names.
 * Does NOT throw on non-2xx; captures the status + body so 401/403/404 is visible.
 */
export async function probeVoiceAiCalls(): Promise<{
  status: number;
  ok: boolean;
  topLevelKeys: string[];
  firstRecord: unknown;
  bodyPreview: string;
}> {
  const url = new URL(`${GHL_BASE}/voice-ai/dashboard/call-logs`);
  url.searchParams.set("locationId", LOCATION_ID ?? "");
  url.searchParams.set("limit", "20");

  await throttle();
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: GHL_VERSION,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leave null */
  }

  const obj = (json ?? {}) as Record<string, unknown>;
  const topLevelKeys = json && typeof json === "object" ? Object.keys(obj) : [];

  // Try the likeliest array container names.
  const arr =
    (obj.callLogs as unknown[]) ??
    (obj.calls as unknown[]) ??
    (obj.logs as unknown[]) ??
    (obj.data as unknown[]) ??
    (Array.isArray(json) ? (json as unknown[]) : []);

  return {
    status: res.status,
    ok: res.ok,
    topLevelKeys,
    firstRecord: Array.isArray(arr) && arr.length ? arr[0] : null,
    bodyPreview: text.slice(0, 600),
  };
}

/**
 * Fetches Voice AI call logs and normalizes to GhlVoiceCall[].
 * Paginated (1-based per docs). Tolerant of the exact container/key names
 * differing — adjust the pick() calls after the probe confirms the shape.
 */
export async function getVoiceAiCalls(params: {
  startDate?: string; // ISO or YYYY-MM-DD
  endDate?: string;
  agentId?: string;
  maxPages?: number;
} = {}): Promise<GhlVoiceCall[]> {
  const { startDate, endDate, agentId, maxPages = 20 } = params;
  const all: GhlVoiceCall[] = [];

  for (let page = 1; page <= maxPages; page++) {
    let data: Record<string, unknown>;
    try {
      data = await request<Record<string, unknown>>(
        "/voice-ai/dashboard/call-logs",
        {
          query: {
            locationId: LOCATION_ID,
            limit: 100,
            page,
            startDate,
            endDate,
            agentId,
          },
        }
      );
    } catch (err) {
      // If the endpoint is unauthorized/unavailable for this token, don't crash
      // the whole dashboard — return whatever we have (likely nothing) and let
      // the AI Calls page show zeros honestly.
      if (err instanceof GhlError && [401, 403, 404].includes(err.status)) {
        return all;
      }
      throw err;
    }

    const batch =
      (data.callLogs as unknown[]) ??
      (data.calls as unknown[]) ??
      (data.logs as unknown[]) ??
      (data.data as unknown[]) ??
      [];

    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const raw of batch as Record<string, unknown>[]) {
      all.push(normalizeVoiceCall(raw));
    }

    if (batch.length < 100) break;
  }

  return all;
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

/** Parse "mm:ss" or "hh:mm:ss" (as seen in the dashboard) into seconds. */
function parseClock(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

/**
 * Maps a normalized Voice AI call to one of the 5 MockCall outcomes:
 * "Booked" | "Answered" | "No Answer" | "Voicemail" | "Declined".
 * Booking is inferred from actionsTriggered containing an appointment/booking
 * action, or an explicit booked status. Everything else falls back to duration.
 */
export function classifyVoiceOutcome(
  c: GhlVoiceCall
): "Booked" | "Answered" | "No Answer" | "Voicemail" | "Declined" {
  const status = (c.callStatus ?? "").toLowerCase();
  const actions = (c.actionsTriggered ?? []).join(" ").toLowerCase();

  const booked =
    /book|appointment|schedule|calendar/.test(actions) ||
    /book|appointment/.test(status);
  if (booked) return "Booked";

  if (/no[\s-]?answer|missed|no[\s-]?connect/.test(status)) return "No Answer";
  if (/voicemail|vm/.test(status)) return "Voicemail";
  if (/declin|reject|failed|busy/.test(status)) return "Declined";

  // Fall back to duration when status isn't explicit.
  const d = c.durationSec;
  if (d <= 0) return "No Answer";
  if (d < 12) return "No Answer";
  if (d < 30) return "Voicemail";
  return "Answered";
}

function normalizeVoiceCall(raw: Record<string, unknown>): GhlVoiceCall {
  const durationSec =
    pickNum(raw, "durationSec", "duration", "callDuration", "durationSeconds") ??
    parseClock(pickStr(raw, "duration", "callDuration")) ??
    0;

  const actionsRaw =
    (raw.actionsTriggered as unknown) ??
    (raw.actions as unknown) ??
    (raw.actionType as unknown);
  const actionsTriggered = Array.isArray(actionsRaw)
    ? actionsRaw.map((a) => String(a)).filter((a) => a && a !== "-")
    : typeof actionsRaw === "string" && actionsRaw && actionsRaw !== "-"
      ? [actionsRaw]
      : [];

  return {
    id: pickStr(raw, "id", "callId", "_id") ?? crypto.randomUUID(),
    contactId: pickStr(raw, "contactId", "contact_id"),
    contactName: pickStr(raw, "contactName", "contact", "name"),
    agentName: pickStr(raw, "agentName", "agent"),
    fromNumber: pickStr(raw, "fromNumber", "from", "phone", "phoneNumber"),
    direction: pickStr(raw, "direction", "callType", "type"),
    durationSec,
    startedAt: pickStr(raw, "startedAt", "dateAdded", "createdAt", "dateTime", "date"),
    actionsTriggered,
    sentiment: pickStr(raw, "sentiment"),
    callStatus: pickStr(raw, "status", "callStatus"),
  };
}

