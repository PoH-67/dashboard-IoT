import { NextRequest, NextResponse } from "next/server";
import { POST as mainPost, GET as mainGet } from "../../update/route";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const cloneHeaders = new Headers(req.headers);
  cloneHeaders.set("x-auth-token", token);

  const forwardReq = new NextRequest(req.url, {
    method: "POST",
    headers: cloneHeaders,
    body: req.body,
    // @ts-ignore
    duplex: "half",
  });

  return mainPost(forwardReq);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const cloneHeaders = new Headers(req.headers);
  cloneHeaders.set("x-auth-token", token);

  const forwardReq = new NextRequest(req.url, {
    method: "GET",
    headers: cloneHeaders,
  });

  return mainGet(forwardReq);
}
