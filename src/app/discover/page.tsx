import { Card, Table, Td } from "@/components/ui";
import { getPipelines, getCustomFieldDefs, GhlError } from "@/lib/ghl";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const hasCredentials =
    !!process.env.GHL_PRIVATE_TOKEN && !!process.env.GHL_LOCATION_ID;

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

  // Try to guess which fields match by name
  const guess = (needle: string) =>
    fields.find((f) =>
      (f.name ?? "").toLowerCase().includes(needle.toLowerCase())
    );

  const guessed = {
    referredBy: guess("referred"),
    amId: guess("am") ?? guess("affiliate manager"),
    samId: guess("sam") ?? guess("sub"),
    campaign: guess("campaign") ?? guess("tier"),
    brokerFee: guess("broker") ?? guess("net fee"),
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-bright">
          GHL Discovery
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          What Zeus's GHL location actually contains. Copy the IDs below into
          Render's Environment tab.
        </p>
      </div>

      <Card
        title="Suggested Environment Variables"
        subtitle="Best guess based on field names — verify against the full lists below"
      >
        <div className="space-y-2 font-mono text-[12px]">
          <EnvLine k="GHL_FIELD_REFERRED_BY" v={guessed.referredBy?.id} name={guessed.referredBy?.name} />
          <EnvLine k="GHL_FIELD_AM_ID" v={guessed.amId?.id} name={guessed.amId?.name} />
          <EnvLine k="GHL_FIELD_SAM_ID" v={guessed.samId?.id} name={guessed.samId?.name} />
          <EnvLine k="GHL_FIELD_CAMPAIGN" v={guessed.campaign?.id} name={guessed.campaign?.name} />
          <EnvLine k="GHL_FIELD_NET_BROKER_FEE" v={guessed.brokerFee?.id} name={guessed.brokerFee?.name} />
        </div>
      </Card>

      <Card
        title="Pipelines"
        subtitle={
          pipelineError
            ? `Error: ${pipelineError}`
            : `${pipelines.length} pipeline(s) found — copy the ID of the one that holds funded deals`
        }
      >
        {pipelineError ? (
          <div className="text-[13px] text-loss/90">{pipelineError}</div>
        ) : pipelines.length === 0 ? (
          <div className="text-[13px] text-muted/70">
            No pipelines returned. Check that the Private Integration token has
            the <code>opportunities.readonly</code> scope.
          </div>
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

function EnvLine({
  k,
  v,
  name,
}: {
  k: string;
  v: string | undefined;
  name: string | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted">{k}=</span>
      {v ? (
        <>
          <code className="rounded bg-ink px-2 py-0.5 text-gold">{v}</code>
          <span className="text-[11px] text-muted/60">({name})</span>
        </>
      ) : (
        <span className="text-loss/80">
          # no match found — check the Custom Fields list below
        </span>
      )}
    </div>
  );
}
