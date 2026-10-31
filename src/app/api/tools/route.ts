import { connection } from "next/server";
import { listTools, setPolicy, type Policy } from "@/lib/gateway";

export async function GET() {
  await connection();
  const tools = await listTools();
  return Response.json({ tools });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { tool?: string; policy?: Policy };
  if (!body.tool || (body.policy !== "auto" && body.policy !== "approve")) {
    return Response.json({ error: "Expected { tool, policy: 'auto' | 'approve' }" }, { status: 400 });
  }
  setPolicy(body.tool, body.policy);
  const tools = await listTools();
  return Response.json({ tools });
}
