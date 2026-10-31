"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Risk = "read" | "write" | "sensitive";
type Policy = "auto" | "approve";

interface ToolInfo {
  name: string;
  description: string;
  risk: Risk;
  policy: Policy;
  inputSchema: {
    properties?: Record<string, { type?: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

interface Approval {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

interface AuditEntry {
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

const RISK_STYLES: Record<Risk, string> = {
  read: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  write: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sensitive: "bg-red-500/15 text-red-300 border-red-500/30",
};

const DECISION_STYLES: Record<AuditEntry["decision"], string> = {
  "auto-approved": "text-emerald-300",
  approved: "text-sky-300",
  rejected: "text-red-300",
  pending: "text-amber-300",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export default function Home() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [t, a, au] = await Promise.all([
      api<{ tools: ToolInfo[] }>("/api/tools"),
      api<{ approvals: Approval[] }>("/api/approvals"),
      api<{ audit: AuditEntry[] }>("/api/audit"),
    ]);
    setTools(t.tools);
    setApprovals(a.approvals);
    setAudit(au.audit);
    setSelectedTool((prev) => prev || t.tools[0]?.name || "");
  }, []);

  useEffect(() => {
    refresh().catch((e) => setNotice({ kind: "err", text: String(e.message ?? e) }));
    const id = setInterval(() => refresh().catch(() => {}), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const tool = useMemo(
    () => tools.find((t) => t.name === selectedTool),
    [tools, selectedTool],
  );

  const pending = approvals.filter((a) => a.status === "pending");

  async function togglePolicy(t: ToolInfo) {
    const next: Policy = t.policy === "auto" ? "approve" : "auto";
    const res = await api<{ tools: ToolInfo[] }>("/api/tools", {
      method: "PATCH",
      body: JSON.stringify({ tool: t.name, policy: next }),
    });
    setTools(res.tools);
  }

  async function runInvoke() {
    if (!tool) return;
    setBusy(true);
    setNotice(null);
    try {
      const args: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(tool.inputSchema.properties ?? {})) {
        const raw = formValues[key] ?? "";
        args[key] = schema.type === "number" ? Number(raw) : raw;
      }
      const outcome = await api<{ status: string; result?: unknown; approvalId?: string }>(
        "/api/invoke",
        { method: "POST", body: JSON.stringify({ tool: tool.name, args }) },
      );
      if (outcome.status === "executed") {
        setNotice({ kind: "ok", text: `Executed ${tool.name}: ${JSON.stringify(outcome.result)}` });
      } else {
        setNotice({
          kind: "warn",
          text: `${tool.name} needs approval — it is waiting in the approvals queue below.`,
        });
      }
      await refresh();
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(true);
    try {
      const outcome = await api<{ status: string; result?: unknown }>("/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id, decision }),
      });
      setNotice({
        kind: decision === "approved" ? "ok" : "warn",
        text:
          decision === "approved"
            ? `Approved and executed: ${JSON.stringify(outcome.result)}`
            : "Request rejected. The tool was not run.",
      });
      await refresh();
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-zinc-950 px-6 py-10 text-zinc-100">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          MCP Guard <span className="text-zinc-500 font-normal">— tool governance console</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          AI agents calling MCP tools can read data, write data, and move money — usually with no
          human in the loop. MCP Guard puts a policy gate in front of every tool call: read tools
          run automatically, writes and sensitive actions wait for a human approval, and every
          decision lands in an audit log.
        </p>
      </header>

      {notice && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm break-words ${
            notice.kind === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : notice.kind === "warn"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          {notice.text}
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Tool registry — server: acme-workspace (demo MCP server)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {tools.map((t) => (
            <div key={t.name} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <code className="font-mono text-sm font-semibold">{t.name}</code>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${RISK_STYLES[t.risk]}`}>
                  {t.risk}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{t.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Policy:{" "}
                  <span className="text-zinc-300">
                    {t.policy === "auto" ? "Auto-approve" : "Require approval"}
                  </span>
                </span>
                <button
                  onClick={() => togglePolicy(t)}
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800"
                >
                  Switch to {t.policy === "auto" ? "approval" : "auto"}
                </button>
              </div>
            </div>
          ))}
          {tools.length === 0 && <p className="text-sm text-zinc-500">Loading tools…</p>}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Invoke a tool (as the agent)</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <label className="mb-1 block text-xs text-zinc-400">Tool</label>
            <select
              value={selectedTool}
              onChange={(e) => {
                setSelectedTool(e.target.value);
                setFormValues({});
              }}
              className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              {tools.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            {tool &&
              Object.entries(tool.inputSchema.properties ?? {}).map(([key, schema]) => (
                <div key={key} className="mb-3">
                  <label className="mb-1 block text-xs text-zinc-400">
                    {key}
                    {schema.description ? ` — ${schema.description}` : ""}
                    {tool.inputSchema.required?.includes(key) ? " *" : ""}
                  </label>
                  {schema.enum ? (
                    <select
                      value={formValues[key] ?? schema.enum[0]}
                      onChange={(e) => setFormValues((v) => ({ ...v, [key]: e.target.value }))}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    >
                      {schema.enum.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={schema.type === "number" ? "number" : "text"}
                      value={formValues[key] ?? ""}
                      onChange={(e) => setFormValues((v) => ({ ...v, [key]: e.target.value }))}
                      placeholder={key === "orderId" ? "ORD-1001" : key}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    />
                  )}
                </div>
              ))}

            <button
              onClick={runInvoke}
              disabled={busy || !tool}
              className="mt-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
            >
              {busy ? "Working…" : "Run tool call"}
            </button>
            <p className="mt-3 text-xs text-zinc-500">
              Try: search_docs for “refund” (auto-runs), create_support_ticket (waits for approval),
              issue_refund on ORD-1001 (sensitive, waits for approval).
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Approvals queue{" "}
            {pending.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                {pending.length} pending
              </span>
            )}
          </h2>
          <div className="space-y-3">
            {approvals.length === 0 && (
              <p className="text-sm text-zinc-500">No approval requests yet.</p>
            )}
            {approvals.map((a) => (
              <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between">
                  <code className="font-mono text-sm font-semibold">{a.tool}</code>
                  <span
                    className={`text-xs ${
                      a.status === "pending"
                        ? "text-amber-300"
                        : a.status === "approved"
                          ? "text-emerald-300"
                          : "text-red-300"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-2 text-xs text-zinc-300">
                  {JSON.stringify(a.args, null, 2)}
                </pre>
                <p className="mt-2 text-xs text-zinc-500">
                  Requested by {a.requestedBy} at {new Date(a.requestedAt).toLocaleString()}
                </p>
                {a.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => decide(a.id, "approved")}
                      disabled={busy}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Approve &amp; run
                    </button>
                    <button
                      onClick={() => decide(a.id, "rejected")}
                      disabled={busy}
                      className="rounded-md bg-red-600/80 px-3 py-1.5 text-xs font-medium hover:bg-red-500 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Audit log</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Tool</th>
                <th className="px-4 py-2">Arguments</th>
                <th className="px-4 py-2">Risk</th>
                <th className="px-4 py-2">Decision</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id} className="border-t border-zinc-800 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-400">
                    {new Date(entry.at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.tool}</td>
                  <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-zinc-400">
                    {JSON.stringify(entry.args)}
                  </td>
                  <td className="px-4 py-2">{entry.risk}</td>
                  <td className={`px-4 py-2 ${DECISION_STYLES[entry.decision]}`}>{entry.decision}</td>
                  <td className="max-w-md truncate px-4 py-2 text-xs text-zinc-400">
                    {entry.resultSummary ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">
                    {entry.durationMs != null ? `${entry.durationMs} ms` : "—"}
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-zinc-500">
                    No calls yet — run a tool above and it will be recorded here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 text-xs text-zinc-600">
        Built with Next.js, TypeScript, and the official MCP TypeScript SDK. Demo data lives in
        memory; the gateway is transport-agnostic, so the in-process demo server can be swapped for
        any real MCP server.
      </footer>
    </main>
  );
}
