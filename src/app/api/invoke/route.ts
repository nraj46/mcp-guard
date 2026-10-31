import { invoke } from "@/lib/gateway";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    tool?: string;
    args?: Record<string, unknown>;
    actor?: string;
  };
  if (!body.tool) {
    return Response.json({ error: "Expected { tool, args }" }, { status: 400 });
  }
  try {
    const outcome = await invoke(body.tool, body.args ?? {}, body.actor ?? "console-user");
    return Response.json(outcome);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invocation failed" },
      { status: 400 },
    );
  }
}
