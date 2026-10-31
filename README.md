# MCP Guard — Tool Governance Console

AI agents calling [MCP (Model Context Protocol)](https://modelcontextprotocol.io) tools can read data, write data, and move money — usually with no human in the loop and no record of what happened. MCP Guard is a small governance layer that sits between an agent and an MCP server:

- **Risk classification** — every tool is labeled `read`, `write`, or `sensitive`.
- **Per-tool approval policy** — reads run automatically; writes and sensitive actions wait for a human to approve them in the console. Policies can be changed per tool at runtime.
- **Approvals queue** — pending calls show the exact tool and arguments; approve to execute, reject to block.
- **Audit log** — every request is recorded: who asked, which tool, what arguments, what was decided, what came back, and how long it took.

Built with **Next.js + TypeScript** and the **official MCP TypeScript SDK** (`@modelcontextprotocol/sdk`).

## Why

MCP adoption is moving fast, but governance is lagging: teams are giving agents broad tool access faster than they can audit it. This project demonstrates the pattern vendors are now productizing — a registry of tools, per-tool approvals, identity on every call, and a complete audit trail — in a form you can read in one sitting.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

No API keys or external services needed. A demo MCP server (`acme-workspace`) runs in-process with four tools:

| Tool | Risk | Default policy | What it does |
| --- | --- | --- | --- |
| `search_docs` | read | auto | Search a small knowledge base |
| `get_order_status` | read | auto | Look up a mock order (try `ORD-1001`) |
| `create_support_ticket` | write | approval | Create a support ticket |
| `issue_refund` | sensitive | approval | Refund an order (try `ORD-1001`, amount ≤ 129.99) |

Try it: run `search_docs` and watch it execute immediately and appear in the audit log. Then run `issue_refund` — it lands in the approvals queue instead. Approve it and the call executes; the audit entry flips from `pending` to `approved` with the result and duration.

## How it works

```
Browser console (Next.js client)
        │  REST
        ▼
Route handlers  /api/tools  /api/invoke  /api/approvals  /api/audit
        │
        ▼
Gateway (src/lib/gateway.ts)  ── policy check ──► approvals queue
        │                                            │ approved
        ▼                                            ▼
MCP Client ──► (in-memory transport) ──► Demo MCP server (src/lib/demoServer.ts)
```

The gateway only depends on the MCP `Client` interface, so the in-process demo server can be swapped for any real MCP server over Streamable HTTP or stdio without changing the policy or audit code.

## Project layout

- `src/lib/demoServer.ts` — demo MCP server with read/write/sensitive tools (Zod-validated inputs).
- `src/lib/gateway.ts` — risk registry, policy engine, approvals, audit log (in-memory store on `globalThis`).
- `src/app/api/*` — route handlers for tools, invocation, approvals, and audit.
- `src/app/page.tsx` — the console UI: registry, invoke panel, approvals queue, audit table.

## Roadmap ideas

- Persist the audit log and policies (SQLite/Postgres) and add per-user identity via auth.
- Connect a real MCP server over Streamable HTTP and add a server registry.
- Argument-aware policies (e.g., auto-approve refunds under $50, require approval above).
- Webhook/Slack notifications when a sensitive call is waiting for approval.

## License

MIT
