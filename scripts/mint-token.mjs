import { SignJWT } from "jose";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, cur, i, arr) => {
      if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
      return acc;
    }, [])
);

const secret = process.env.DASHBOARD_TOKEN_SECRET;
const locationId = process.env.GHL_LOCATION_ID;

if (!secret) {
  console.error("DASHBOARD_TOKEN_SECRET is not set.");
  process.exit(1);
}
if (!locationId) {
  console.error("GHL_LOCATION_ID is not set.");
  process.exit(1);
}

const token = await new SignJWT({
  locationId,
  label: args.label ?? "embed",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setIssuer("zeus-dashboard")
  .setAudience("ghl-iframe")
  .setExpirationTime(args.expires ?? "365d")
  .sign(new TextEncoder().encode(secret));

const base = process.env.DASHBOARD_BASE_URL ?? "https://YOUR-RENDER-URL.onrender.com";

console.log("");
console.log("Signed token:");
console.log("  " + token);
console.log("");
console.log("Iframe URL (paste this into GHL Custom Menu Link):");
console.log("  " + base + "/?t=" + token);
console.log("");
