import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.DASHBOARD_TOKEN_SECRET ?? "insecure-development-secret-change-me"
);

const ISSUER = "zeus-dashboard";
const AUDIENCE = "ghl-iframe";

export async function mintToken(opts: {
  locationId: string;
  label?: string;
  expiresIn?: string;
}): Promise<string> {
  return new SignJWT({
    locationId: opts.locationId,
    label: opts.label ?? "embed",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(opts.expiresIn ?? "365d")
    .sign(secret);
}

export async function verifyToken(
  token: string | undefined | null
): Promise<{ valid: boolean; locationId?: string; reason?: string }> {
  if (!token) return { valid: false, reason: "No token supplied" };

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return { valid: true, locationId: payload.locationId as string };
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (message.includes("exp")) {
      return { valid: false, reason: "This dashboard link has expired" };
    }
    return { valid: false, reason: "This dashboard link is not valid" };
  }
}

export function authEnabled(): boolean {
  return process.env.DASHBOARD_REQUIRE_TOKEN === "true";
}
