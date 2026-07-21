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
