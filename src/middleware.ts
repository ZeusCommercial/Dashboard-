import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, authEnabled } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.nextUrl.searchParams.get("t");
  const result = await verifyToken(token);

  if (!result.valid) {
    return new NextResponse(
      `<!doctype html><html><head><title>Access denied</title>
       <style>body{background:#0a1628;color:#e8f0fa;font-family:system-ui;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
       .box{border:1px solid #1e3a5c;background:#0f1f35;padding:32px;border-radius:12px;max-width:420px;text-align:center}
       h1{margin:0 0 8px;font-size:18px;color:#F5A623}
       p{margin:0;color:#7B93B4;font-size:13px}</style></head>
       <body><div class="box"><h1>Access denied</h1>
       <p>${result.reason ?? "This link is not valid."}</p></div></body></html>`,
      {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8" },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
