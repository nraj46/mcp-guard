export default function DataPolicyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-zinc-950 px-6 py-10 text-zinc-100">
      <p className="mb-2 text-sm">
        <a href="/" className="text-sky-400 hover:underline">← Back to MCP Guard</a>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Data &amp; Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-400">
        What MCP Guard sees, what it keeps, and what it never does with your data. Written for the
        people who approve AI tools — not lawyers.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">What data flows through MCP Guard</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Tool-call payloads</strong> — the arguments an AI agent sends to a tool (e.g. an order ID for a refund). The gateway sees these in transit to evaluate policy.</li>
            <li><strong>Tool results</strong> — what the tool returns, shown to the operator in the console.</li>
            <li><strong>Approvals</strong> — who approved or rejected a held call, and when.</li>
            <li><strong>Audit log entries</strong> — timestamp, tool name, policy decision, and outcome for every call.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">What we do with it</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Payloads are used <strong>only</strong> to evaluate the tool's policy (auto-execute vs. require approval) and to display the call to the operator.</li>
            <li>The audit log exists so a business can answer "what did the AI do, and who approved it?" — it is the product, not a data grab.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-red-900/60 bg-red-950/30 p-5">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">What we never do</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Never train models on your tool calls.</strong> Customer payloads are never used to train, fine-tune, or evaluate AI models.</li>
            <li><strong>Never sell or share</strong> payloads, results, or audit data with third parties or advertisers.</li>
            <li><strong>Never retain payloads beyond the operational window</strong> in a production deployment — payloads are kept only as long as the audit record requires, then purged; the audit metadata (tool, decision, approver, time) is what persists.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">Your controls</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Per-tool policies decide which calls even reach a human — sensitive tools can be set to always require approval or be disabled entirely.</li>
            <li>Operators can export or delete audit records for their workspace on request.</li>
            <li>Sensitive argument fields can be redacted from the audit log while keeping the decision record.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-2 text-base font-semibold text-zinc-100">About this demo</h2>
          <p>
            This public demo keeps everything in server memory — nothing is written to a database,
            and all data disappears when the server restarts. Don't paste real customer data into it.
          </p>
        </section>
      </div>

      <footer className="mt-10 text-xs text-zinc-600">
        MCP Guard — tool governance for AI agents. Policy v1.0, November 2026.
      </footer>
    </main>
  );
}
