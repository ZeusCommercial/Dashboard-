import { Card, Table, Td } from "@/components/ui";
import { getPipelines, getCustomFieldDefs, GhlError } from "@/lib/ghl";

export const dynamic = "force-dynamic";

const TOKEN = process.env.GHL_PRIVATE_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

async function probe(path: string, query?: Record<string, string>) {
  const url = new URL(`${GHL_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Version: GHL_VERSION,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    return {
      status: res.status,
      ok: res.ok,
      body: text.slice(0, 2500),
    };
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

  // Probe every plausible affiliate endpoint. GHL's affiliate API isn't in
  // the public docs, so we try known paths and show what comes back.
  const affiliateProbes = await Promise.all([
    probe("/affiliates/campaigns", { locationId: LOCATION_ID! }),
    probe("/affiliates/", { locationId: LOCATION_ID! }),
    probe("/affiliate-managers/", { locationId: LOCATION_ID! }),
    probe("/affiliate/campaigns", { locationId: LOCATION_ID! }),
    probe("/affiliate/manager", { locationId: LOCATION_ID! }),
    probe(`/locations/${LOCATION_ID}/affiliates`),
    probe(`/locations/${LOCATION_ID}/affiliate-campaigns`),
  ]);

  const probePaths = [
    "/affiliates/campaigns",
    "/affiliates/",
    "/affiliate-managers/",
    "/affiliate/campaigns",
    "/affiliate/manager",
    `/locations/${LOCATION_ID}/affiliates`,
    `/locations/${LOCATION_ID}/affiliate-campaigns`,
  ];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright">GHL Discovery</h1>
        <p className="mt-1 text-[13px] text-muted">
          Probes GHL to see what data is actually reachable with your token.
        </p>
      </div>

      <Card
        title="Affiliate API Probes"
        subtitle="Testing every plausible endpoint — one of these should return 200 with affiliate data"
      >
        <div className="space-y-4">
          {affiliateProbes.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-hairline bg-ink/40 p-3"
            >
              <div className="mb-2 flex items-baseline gap-3">
                <code className="text-[12px] text-bright">{probePaths[i]}</code>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    r.ok
                      ? "bg-gain/15 text-gain"
                      : r.status === 404
                        ? "bg-muted/10 text-muted"
                        : "bg-loss/15 text-loss"
                  }`}
                >
                  {r.status} {r.ok ? "OK" : ""}
                </span>
              </div>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-ink p-2 text-[10px] leading-tight text-muted/80">
                {r.body}
              </pre>
            </div>
          ))}
        </div>
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
