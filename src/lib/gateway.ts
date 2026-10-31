import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDemoServer } from "./demoServer";

/**
 * MCP Guard gateway: sits between the UI (or any agent) and an MCP server.
 *
 * - Tools are classified by risk: read / write / sensitive.
 * - Each tool has a policy: "auto" (execute immediately) or "approve"
 *   (a human must approve in the console before the call runs).
 * - Every decision and execution lands in an audit log: who asked, what tool,
 *   what arguments, what was decided, what came back, and how long it took.
 *
 * State is in-memory (globalThis singleton so Next.js hot reloads and route
 * handlers share one store). Swap the store functions for a database to make
 * it durable.
 */

export type Risk = "read" | "write" | "sensitive";
export type Policy = "auto" | "approve";

export interface ToolInfo {
  name: string;
  description: string;
  risk: Risk;
  policy: Policy;
  inputSchema: Record<string, unknown>;
}

export interface Approval {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  tool: string;
  args: Record<string, unknown>;
  risk: Risk;
  decision: "auto-approved" | "approved" | "rejected" | "pending";
  resultSummary: string | null;
  durationMs: number | null;
}

const RISK_BY_TOOL: Record<string, Risk> = {
  search_docs: "read",
  get_order_status: "read",
  create_support_ticket: "write",
  issue_refund: "sensitive",
};

const DEFAULT_POLICY: Record<Risk, Policy> = {
  read: "auto",
  write: "approve",
  sensitive: "approve",
};

interface Store {
  client: Client | null;
  connecting: Promise<Client> | null;
  policies: Map<string, Policy>;
  approvals: Map<string, Approval>;
  audit: AuditEntry[];
  seq: number;
}

const g = globalThis as unknown as { __mcpGuard?: Store };
const store: Store =
  g.__mcpGuard ??
  (g.__mcpGuard = {
    client: null,
    connecting: null,
    policies: new Map(),
    approvals: new Map(),
    audit: [],
    seq: 0,
  });

async function getClient(): Promise<Client> {
  if (store.client) return store.client;
  if (!store.connecting) {
    store.connecting = (async () => {
      const server = createDemoServer();
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "mcp-guard", version: "1.0.0" });
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      store.client = client;
      return client;
    })();
  }
  return store.connecting;
}

function nextId(prefix: string): string {
  store.seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${store.seq}`;
}

function policyFor(name: string, risk: Risk): Policy {
  return store.policies.get(name) ?? DEFAULT_POLICY[risk];
}

export async function listTools(): Promise<ToolInfo[]> {
  const client = await getClient();
  const { tools } = await client.listTools();
  return tools.map((t) => {
    const risk = RISK_BY_TOOL[t.name] ?? "write";
    return {
      name: t.name,
      description: t.description ?? "",
      risk,
      policy: policyFor(t.name, risk),
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    };
  });
}

export function setPolicy(tool: string, policy: Policy): void {
  store.policies.set(tool, policy);
}

function summarize(result: unknown): string {
  const text = JSON.stringify(result);
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

async function execute(
  tool: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; durationMs: number }> {
  const client = await getClient();
  const started = Date.now();
  const result = await client.callTool({ name: tool, arguments: args });
  return { result, durationMs: Date.now() - started };
}

export async function invoke(
  tool: string,
  args: Record<string, unknown>,
  actor: string,
): Promise<
  | { status: "executed"; result: unknown }
  | { status: "pending_approval"; approvalId: string }
> {
  const tools = await listTools();
  const info = tools.find((t) => t.name === tool);
  if (!info) throw new Error(`Unknown tool: ${tool}`);

  if (info.policy === "approve") {
    const approval: Approval = {
      id: nextId("apr"),
      tool,
      args,
      requestedBy: actor,
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    store.approvals.set(approval.id, approval);
    store.audit.unshift({
      id: nextId("aud"),
      at: approval.requestedAt,
      actor,
      tool,
      args,
      risk: info.risk,
      decision: "pending",
      resultSummary: null,
      durationMs: null,
    });
    return { status: "pending_approval", approvalId: approval.id };
  }

  const { result, durationMs } = await execute(tool, args);
  store.audit.unshift({
    id: nextId("aud"),
    at: new Date().toISOString(),
    actor,
    tool,
    args,
    risk: info.risk,
    decision: "auto-approved",
    resultSummary: summarize(result),
    durationMs,
  });
  return { status: "executed", result };
}

export function listApprovals(): Approval[] {
  return [...store.approvals.values()].sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt),
  );
}

export async function decide(
  approvalId: string,
  decision: "approved" | "rejected",
  approver: string,
): Promise<{ status: string; result?: unknown }> {
  const approval = store.approvals.get(approvalId);
  if (!approval || approval.status !== "pending") {
    throw new Error("Approval not found or already decided.");
  }
  approval.status = decision;

  const entry = store.audit.find(
    (a) => a.decision === "pending" && a.tool === approval.tool && a.at === approval.requestedAt,
  );

  if (decision === "rejected") {
    if (entry) {
      entry.decision = "rejected";
      entry.resultSummary = `Rejected by ${approver}`;
    }
    return { status: "rejected" };
  }

  const { result, durationMs } = await execute(approval.tool, approval.args);
  if (entry) {
    entry.decision = "approved";
    entry.resultSummary = summarize(result);
    entry.durationMs = durationMs;
  }
  return { status: "executed", result };
}

export function listAudit(): AuditEntry[] {
  return store.audit.slice(0, 100);
}
