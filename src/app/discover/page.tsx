import { Card, Table, Td } from "@/components/ui";
import { getPipelines, getCustomFieldDefs, GhlError } from "@/lib/ghl";

export const dynamic = "force-dynamic";

const TOKEN = process.env.GHL_PRIVATE_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

async function ghlFetch(
  method: "GET" | "POST",
  path: string,
  opts?: { query?: Record<string, string>; body?: unknown }
) {
  const url = new URL(`${GHL_BASE}${path}`);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Version: GHL_VERSION,
        Accept: "application/json",
        ...(opts?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    return { status: res.status, ok: res.ok, body: text };
  } catch (e) {
    return { status: 0, ok: false, body: (e as Error).message };
  }
}

export default async function DiscoverPage() {
  const hasCredentials = !!TOKEN && !!LOCATION_ID;

  if (!hasCredentials) {
    return (
      <main className="space-y-6">
        <h1 className="font-display text-2xl text-bright">Discovery</h1>
        <div className="rounded-lg border border-loss/30 bg-loss/5 p-4 text-[13px] text-loss/90">
          <strong>Missing credentials.</strong> Set{" "}
          <code>GHL_PRIVATE_TOKEN</code> and <code>GHL_LOCATION_ID</code> in
          Render's Environment tab, then reload this page.
        </div>
      </main>
    );
  }

  let pipelines: Awaited<ReturnType<typeof getPipelines>> = [];
  let fields: Awaited<ReturnType<typeof getCustomFieldDefs>> = [];
  let pipelineError: string | null = null;
  let fieldError: string | null = null;

  try {
    pipelines = await getPipelines();
  } catch (e) {
    pipelineError =
      e instanceof GhlError
        ? `${e.status} — ${e.message}`
        : (e as Error).message;
  }

  try {
    fields = await getCustomFieldDefs();
  } catch (e) {
    fieldError =
      e instanceof GhlError
        ? `${e.status} — ${e.message}`
        : (e as Error).message;
  }

  // Pull one real contact and dump the FULL JSON.
  // We're hunting for the attribution/source object where am_id and sam_id land.
  const contactSample = await ghlFetch("POST", "/contacts/search", {
    body: {
      locationId: LOCATION_ID!,
      pageLimit: 3,
    },
  });

  // Pull one opportunity too — see what shape opportunity custom fields have.
  const opportunitySample = await ghlFetch("GET", "/opportunities/search", {
    query: {
      location_id: LOCATION_ID!,
      limit: "1",
    },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright">GHL Discovery</h1>
        <p className="mt-1 text-[13px] text-muted">
          Deep probes to find where attribution and affiliate data live.
        </p>
      </div>

      <Card
        title="Contact Sample (3 real contacts, full JSON)"
        subtitle={`Status: ${contactSample.status} — search for "am_id", "sam_id", "attribution", or "source" in the JSON below`}
      >
        <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap break-all rounded bg-ink p-3 text-[10px] leading-tight text-muted/90">
          {contactSample.body}
        </pre>
      </Card>

      <Card
        title="Opportunity Sample (1 real opportunity, full JSON)"
        subtitle={`Status: ${opportunitySample.status} — check what custom fields flow through here`}
      >
        <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap break-all rounded bg-ink p-3 text-[10px] leading-tight text-muted/90">
          {opportunitySample.body}
        </pre>
      </Card>

      <Card
        title="Pipelines"
        subtitle={
          pipelineError
            ? `Error: ${pipelineError}`
            : `${pipelines.length} pipeline(s) found`
        }
      >
        {pipelineError ? (
          <div className="text-[13px] text-loss/90">{pipelineError}</div>
        ) : (
          <div className="space-y-6">
            {pipelines.map((p) => (
              <div key={p.id}>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="font-medium text-bright">{p.name}</span>
                  <code className="rounded bg-ink px-2 py-0.5 text-[11px] text-gold">
                    {p.id}
                  </code>
                </div>
                <Table head={["Stage Name", "Stage ID"]}>
                  {p.stages.map((s) => (
                    <tr key={s.id} className="border-b border-hairline/60">
                      <Td align="left">{s.name}</Td>
                      <Td align="left">
                        <code className="text-[11px] text-muted/80">{s.id}</code>
                      </Td>
                    </tr>
                  ))}
                </Table>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Custom Fields"
        subtitle={
          fieldError
            ? `Error: ${fieldError}`
            : `${fields.length} field(s) found`
        }
      >
        {fieldError ? (
          <div className="text-[13px] text-loss/90">{fieldError}</div>
        ) : (
          <Table head={["Name", "Data Type", "ID"]}>
            {fields.map((f) => (
              <tr key={f.id} className="border-b border-hairline/60">
                <Td align="left">
                  <span className="font-medium text-bright">{f.name}</span>
                </Td>
                <Td align="left">
                  <span className="text-muted">{f.dataType ?? "—"}</span>
                </Td>
                <Td align="left">
                  <code className="text-[11px] text-muted/80">{f.id}</code>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </main>
  );
}
