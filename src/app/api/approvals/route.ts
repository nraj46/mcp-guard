import { connection } from "next/server";
import { decide, listApprovals } from "@/lib/gateway";

export async function GET() {
  await connection();
  return Response.json({ approvals: listApprovals() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    decision?: "approved" | "rejected";
    approver?: string;
  };
  if (!body.id || (body.decision !== "approved" && body.decision !== "rejected")) {
    return Response.json(
      { error: "Expected { id, decision: 'approved' | 'rejected' }" },
      { status: 400 },
    );
  }
  try {
    const outcome = await decide(body.id, body.decision, body.approver ?? "approver");
    return Response.json(outcome);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Decision failed" },
      { status: 400 },
    );
  }
}
