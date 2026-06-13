"use client";

import { use, useCallback, useEffect, useState } from "react";

interface Trace {
  id: string;
  created_at: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  success: boolean;
  error_type: string | null;
  error_message: string | null;
  stop_reason: string | null;
  tool_call_count: number;
}

interface Session {
  id: string;
  created_at: string;
  label: string | null;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  trace_count: number;
  error_count: number;
  total_latency_ms: number;
}

function fmt$( cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.000_01) return `$${(cost * 1_000_000).toFixed(2)}µ`;
  if (cost < 0.001) return `$${(cost * 1_000_000).toFixed(0)}µ`;
  return `$${cost.toFixed(5)}`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function modelTag(model: string): string {
  return model.replace("claude-", "");
}

function modelColor(model: string): string {
  if (model.includes("fable") || model.includes("mythos")) return "text-yellow-300";
  if (model.includes("opus")) return "text-purple-300";
  if (model.includes("sonnet")) return "text-blue-300";
  if (model.includes("haiku")) return "text-green-300";
  return "text-gray-400";
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/backend/sessions/${id}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setSession(data.session);
    setTraces(data.traces.filter((t: Trace) => t.model !== "init"));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();

    const source = new EventSource(`/api/backend/sessions/${id}/stream`);
    source.onmessage = () => fetchData();
    source.onerror = () => source.close();

    return () => source.close();
  }, [id, fetchData]);

  if (loading) return <p className="text-gray-600 text-sm">Loading...</p>;
  if (!session) return <p className="text-gray-600 text-sm">Session not found.</p>;

  const avgLatency =
    session.trace_count > 0
      ? Math.round(session.total_latency_ms / session.trace_count)
      : 0;

  const stats = [
    { label: "Calls", value: String(session.trace_count) },
    { label: "Cost", value: fmt$(session.total_cost_usd), accent: "text-yellow-400" },
    { label: "Input tokens", value: session.total_input_tokens.toLocaleString() },
    { label: "Output tokens", value: session.total_output_tokens.toLocaleString() },
    { label: "Avg latency", value: session.trace_count > 0 ? fmtMs(avgLatency) : "—" },
    { label: "Errors", value: String(session.error_count), accent: session.error_count > 0 ? "text-red-400" : undefined },
  ];

  return (
    <div>
      <div className="mb-6">
        <a href="/" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
          ← Sessions
        </a>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-bold">{session.label || "Unnamed session"}</h1>
        <p className="text-gray-700 text-xs mt-1 select-all">{session.id}</p>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="border border-gray-800 rounded-lg px-4 py-3">
            <p className="text-gray-600 text-xs">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.accent ?? "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
        Traces ({traces.length})
      </h2>

      <div className="space-y-1.5">
        {traces.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-lg p-8 text-center text-gray-600 text-sm">
            Waiting for traces…
          </div>
        )}

        {traces.map((trace, i) => (
          <div
            key={trace.id}
            className={`border rounded-lg px-5 py-3 ${
              trace.success
                ? "border-gray-800 hover:border-gray-700"
                : "border-red-900 bg-red-950/20"
            } transition-colors`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-gray-700 text-xs w-5 text-right shrink-0">{i + 1}</span>

                <span className={`text-sm font-medium shrink-0 ${modelColor(trace.model)}`}>
                  {modelTag(trace.model)}
                </span>

                {trace.tool_call_count > 0 && (
                  <span className="text-xs text-blue-400 bg-blue-950/50 border border-blue-900 px-2 py-0.5 rounded-full shrink-0">
                    {trace.tool_call_count} tool{trace.tool_call_count > 1 ? "s" : ""}
                  </span>
                )}

                {!trace.success && trace.error_type && (
                  <span className="text-xs text-red-400 truncate">{trace.error_type}</span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0 ml-4">
                <span>
                  {trace.input_tokens.toLocaleString()}
                  <span className="text-gray-700 mx-1">→</span>
                  {trace.output_tokens.toLocaleString()}
                </span>
                <span className="text-yellow-600 font-medium">{fmt$(trace.cost_usd)}</span>
                <span className={trace.latency_ms > 8000 ? "text-red-400" : "text-gray-500"}>
                  {fmtMs(trace.latency_ms)}
                </span>
              </div>
            </div>

            {trace.error_message && (
              <p className="text-red-400 text-xs mt-2 pl-8 break-all">{trace.error_message}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
