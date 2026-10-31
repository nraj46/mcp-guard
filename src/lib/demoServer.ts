import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * A small demo MCP server ("Acme Workspace") so the console works out of the
 * box with no external services. It exposes a mix of read, write, and
 * sensitive tools — the same mix a real agent-facing MCP server would have.
 *
 * In a production setup this server would be a separate process reached over
 * Streamable HTTP or stdio; the gateway in `gateway.ts` only depends on the
 * MCP Client interface, so swapping the transport is a one-line change.
 */

const DOCS = [
  {
    id: "doc-1",
    title: "Refund policy",
    body: "Refunds are issued to the original payment method within 5-10 business days. Orders above $500 require a supervisor note.",
  },
  {
    id: "doc-2",
    title: "Shipping policy",
    body: "Standard shipping is free over $50. Express delivery is available in the Dallas metro area.",
  },
  {
    id: "doc-3",
    title: "Warranty terms",
    body: "All electronics include a 12-month warranty covering manufacturing defects.",
  },
  {
    id: "doc-4",
    title: "Escalation guide",
    body: "Escalate to Tier 2 when a customer has two or more failed deliveries or a refund older than 10 business days.",
  },
];

const ORDERS: Record<string, { status: string; total: number }> = {
  "ORD-1001": { status: "delivered", total: 129.99 },
  "ORD-1002": { status: "in transit", total: 549.0 },
  "ORD-1003": { status: "processing", total: 74.5 },
};

let ticketCounter = 100;

function text(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function createDemoServer(): McpServer {
  const server = new McpServer({ name: "acme-workspace", version: "1.0.0" });

  server.registerTool(
    "search_docs",
    {
      description: "Search the internal knowledge base. Read-only.",
      inputSchema: { query: z.string().describe("Search terms") },
    },
    async ({ query }) => {
      const q = query.toLowerCase();
      const hits = DOCS.filter(
        (d) => d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q),
      );
      return text(hits.length ? hits : "No matching documents.");
    },
  );

  server.registerTool(
    "get_order_status",
    {
      description: "Look up the status and total of an order. Read-only.",
      inputSchema: { orderId: z.string().describe("e.g. ORD-1001") },
    },
    async ({ orderId }) => {
      const order = ORDERS[orderId];
      return text(order ? { orderId, ...order } : `Unknown order ${orderId}`);
    },
  );

  server.registerTool(
    "create_support_ticket",
    {
      description: "Create a support ticket. Writes data.",
      inputSchema: {
        title: z.string().describe("Short summary of the issue"),
        priority: z.enum(["low", "normal", "high"]).describe("Ticket priority"),
      },
    },
    async ({ title, priority }) => {
      ticketCounter += 1;
      return text({ ticketId: `TCK-${ticketCounter}`, title, priority, status: "open" });
    },
  );

  server.registerTool(
    "issue_refund",
    {
      description: "Refund an order to the original payment method. Sensitive: moves money.",
      inputSchema: {
        orderId: z.string().describe("e.g. ORD-1001"),
        amount: z.number().positive().describe("Refund amount in USD"),
      },
    },
    async ({ orderId, amount }) => {
      const order = ORDERS[orderId];
      if (!order) return text(`Unknown order ${orderId}`);
      if (amount > order.total) {
        return text(`Refund of $${amount} exceeds order total of $${order.total}.`);
      }
      return text({
        orderId,
        refunded: amount,
        method: "original payment method",
        eta: "5-10 business days",
      });
    },
  );

  return server;
}
