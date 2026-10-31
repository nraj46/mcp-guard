import { connection } from "next/server";
import { listAudit } from "@/lib/gateway";

export async function GET() {
  await connection();
  return Response.json({ audit: listAudit() });
}
