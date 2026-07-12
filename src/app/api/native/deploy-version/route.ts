import { NextResponse } from "next/server";
import {
  allowNativeShellRequest,
  nativeShellCorsHeaders,
} from "@/lib/native-api-request";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: nativeShellCorsHeaders(request.headers.get("origin")),
  });
}

/** Returns the current live-site deploy version for native refresh prompts. */
export async function GET(request: Request) {
  const cors = nativeShellCorsHeaders(request.headers.get("origin"));
  if (!allowNativeShellRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  const version =
    process.env.NATIVE_DEPLOY_VERSION?.trim() ||
    process.env.RENDER_GIT_COMMIT?.trim() ||
    "dev";

  return NextResponse.json({ version }, { headers: cors });
}
