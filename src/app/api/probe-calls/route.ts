// src/app/api/probe-calls/route.ts
//
// TEMPORARY DIAGNOSTIC. Deploy this, then open:
//   https://zeus-dashboard-xc98.onrender.com/api/probe-calls
//
// It hits the Voice AI call-logs endpoint and reports back the HTTP status
// and the REAL response shape (top-level keys + first record) so we can
// confirm (a) whether your Private Integration token is allowed, and
// (b) the exact JSON field names to map against.
//
// Delete this file once calls are wired.

import { NextResponse } from "next/server";
import { probeVoiceAiCalls } from "@/lib/ghl";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await probeVoiceAiCalls();
    return NextResponse.json(
      {
        note:
          result.status === 200
            ? "OK — token reaches Voice AI. Send me `firstRecord` + `topLevelKeys` and I'll finalize the mapper."
            : `Endpoint returned ${result.status}. If 401/403/404, the Private Integration token likely lacks Voice AI scope (same as Affiliate Manager). Send me this whole JSON.`,
        ...result,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, name: (err as Error).name },
      { status: 200 }
    );
  }
}
