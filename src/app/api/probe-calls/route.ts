// src/app/api/probe-calls/route.ts
//
// TEMPORARY DIAGNOSTIC v2. Deploy, then open:
//   https://zeus-dashboard-xc98.onrender.com/api/probe-calls
//
// The endpoint rejected `limit`. This version tries several parameter
// combinations and reports which one returns 200 plus the real record shape.
// Delete this file once calls are wired.

import { NextResponse } from "next/server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const TOKEN = process.env.GHL_PRIVATE_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

export const dynamic = "force-dynamic";

async function tryVariant(
  label: string,
  params: Record<string, string>
): Promise<{
  label: string;
  query: string;
  status: number;
  ok: boolean;
  topLevelKeys: string[];
  firstRecord: unknown;
  bodyPreview: string;
}> {
  const url = new URL(`${GHL_BASE}/voice-ai/dashboard/call-logs`);
  url.searchParams.set("locationId", LOCATION_ID ?? "");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

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
    /* noop */
  }
  const obj = (json ?? {}) as Record<string, unknown>;
  const arr =
    (obj.callLogs as unknown[]) ??
    (obj.calls as unknown[]) ??
    (obj.logs as unknown[]) ??
    (obj.data as unknown[]) ??
    (Array.isArray(json) ? (json as unknown[]) : []);

  return {
    label,
    query: url.searchParams.toString(),
    status: res.status,
    ok: res.ok,
    topLevelKeys: json && typeof json === "object" ? Object.keys(obj) : [],
    firstRecord: Array.isArray(arr) && arr.length ? arr[0] : null,
    bodyPreview: text.slice(0, 500),
  };
}

export async function GET() {
  // A date range helps because the dashboard defaults to a window.
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const variants: Array<[string, Record<string, string>]> = [
    ["no-params", {}],
    ["pageSize", { pageSize: "20" }],
    ["perPage", { perPage: "20" }],
    ["page+pageSize", { page: "1", pageSize: "20" }],
    [
      "dates+pageSize",
      { startDate, endDate, pageSize: "20", timezone: "America/New_York" },
    ],
    [
      "dates+page",
      { startDate, endDate, page: "1", timezone: "America/New_York" },
    ],
  ];

  const results = [];
  for (const [label, params] of variants) {
    try {
      results.push(await tryVariant(label, params));
    } catch (err) {
      results.push({
        label,
        error: (err as Error).message,
      });
    }
  }

  const winner = results.find((r) => "status" in r && r.status === 200);

  return NextResponse.json(
    {
      summary: winner
        ? `WORKING VARIANT: "${winner.label}". Send me its firstRecord + topLevelKeys.`
        : "No 200 yet. Send me all results — the error messages tell us the required params.",
      winner: winner ?? null,
      results,
    },
    { status: 200 }
  );
}
