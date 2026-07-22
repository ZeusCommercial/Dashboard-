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
// Voice AI call logs (Samantha).
// Endpoint: GET /voice-ai/dashboard/call-logs?locationId=..&page=..&pageSize=..
// Response: { callLogs: VoiceCallLog[], total, page, pageSize, traceId }
// Confirmed record shape via live probe (2026-07-22).
// ─────────────────────────────────────────────────────────────────────────

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

export type GhlExecutedCallAction = {
  _id?: string;
  actionType?:
    | "CALL_TRANSFER"
    | "DATA_EXTRACTION"
    | "IN_CALL_DATA_EXTRACTION"
    | "WORKFLOW_TRIGGER"
    | "SMS"
    | "APPOINTMENT_BOOKING"
    | "CUSTOM_ACTION"
    | "KNOWLEDGE_BASE"
    | string;
};

export type GhlVoiceCall = {
  id: string;
  contactId?: string;
  fromNumber?: string;
  createdAt?: string; // ISO
  duration: number; // seconds
  agentId?: string;
  summary?: string;
  transcript?: string;
  agentTransferOccurred?: boolean;
  trialCall?: boolean;
  executedCallActions: GhlExecutedCallAction[];
};

type VoiceCallLogsResponse = {
  callLogs?: GhlVoiceCall[];
  total?: number;
  page?: number;
  pageSize?: number;
};

/**
 * Fetches all Voice AI call logs for the location, paginated.
 * Filters out trial/test calls by default so they don't skew metrics.
 * Returns [] gracefully if the endpoint is ever unauthorized.
 */
export async function getVoiceAiCalls(params: {
  pageSize?: number;
  maxPages?: number;
  includeTrialCalls?: boolean;
} = {}): Promise<GhlVoiceCall[]> {
  const { pageSize = 100, maxPages = 50, includeTrialCalls = false } = params;
  const all: GhlVoiceCall[] = [];
  for (let page = 1; page <= maxPages; page++) {
    let data: VoiceCallLogsResponse;
    try {
      data = await request<VoiceCallLogsResponse>(
        "/voice-ai/dashboard/call-logs",
        { query: { locationId: LOCATION_ID, page, pageSize } }
      );
    } catch (err) {
      if (err instanceof GhlError && [401, 403, 404].includes(err.status)) {
        return all; // token lost access — fail soft, page shows zeros
      }
      throw err;
    }
    const batch = data.callLogs ?? [];
    if (batch.length === 0) break;
    for (const c of batch) {
      if (!includeTrialCalls && c.trialCall) continue;
      all.push({ ...c, executedCallActions: c.executedCallActions ?? [] });
    }
    const total = data.total ?? 0;
    if (batch.length < pageSize || all.length >= total) break;
  }
  return all;
}

/**
 * Derives a call outcome from the fields GHL actually provides. The API has no
 * explicit outcome/status, so we infer from executed actions + duration.
 *
 * Priority:
 *   1. APPOINTMENT_BOOKING action  → "Booked"
 *   2. duration <= 0               → "No Answer"    (never connected)
 *   3. duration < 15s              → "No Answer"    (ring-out / instant hangup)
 *   4. duration < 35s              → "Voicemail"    (short, machine-length)
 *   5. otherwise                   → "Answered"     (real conversation)
 *
 * "Declined" is reserved for a future explicit-rejection signal; we don't
 * fabricate it from duration alone.
 */
export function deriveVoiceOutcome(
  c: GhlVoiceCall
): "Booked" | "Answered" | "No Answer" | "Voicemail" | "Declined" {
  const booked = c.executedCallActions.some(
    (a) => a.actionType === "APPOINTMENT_BOOKING"
  );
  if (booked) return "Booked";
  const d = c.duration ?? 0;
  if (d <= 0) return "No Answer";
  if (d < 15) return "No Answer";
  if (d < 35) return "Voicemail";
  return "Answered";
}
