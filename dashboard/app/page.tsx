"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Session {
  id: string;
  created_at: string;
  label: string | null;
  trace_count: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_latency_ms: number;
  error_count: number;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.0001) return `$${(cost * 1_000_000).toFixed(1)}µ`;
  if (cost < 0.01) return `$${(cost * 1000).toFixed(3)}m`;
  return `$${cost.toFixed(4)}`;
}

function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/backend/sessions");
    if (res.ok) {
      setSessions(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();

    const source = new EventSource("/api/backend/stream");
    source.onmessage = () => fetchSessions();
    source.onerror = () => source.close();

    return () => source.close();
  }, [fetchSessions]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every session started with <code className="text-purple-400">ArgusClient</code> appears here in real time.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-600 text-sm">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="border border-dashed border-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-2">No sessions yet</p>
          <p className="text-gray-700 text-sm">
            Run <code className="text-purple-400">python demo/demo.py</code> to generate your first traces
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="block border border-gray-800 rounded-lg px-5 py-4 hover:border-purple-800 hover:bg-gray-900/50 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-200 font-medium">
                    {s.label || s.id.slice(0, 8) + "…"}
                  </span>
                  {s.error_count > 0 && (
                    <span className="text-xs bg-red-950 text-red-400 border border-red-900 px-2 py-0.5 rounded-full">
                      {s.error_count} error{s.error_count > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <span className="text-gray-600 text-xs">{timeAgo(s.created_at)}</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-gray-500">
                <span>
                  <span className="text-gray-300 font-medium">{s.trace_count}</span> call{s.trace_count !== 1 ? "s" : ""}
                </span>
                <span>
                  <span className="text-gray-300">{(s.total_input_tokens + s.total_output_tokens).toLocaleString()}</span> tokens
                </span>
                <span className="text-yellow-500 font-medium">{formatCost(s.total_cost_usd)}</span>
                {s.trace_count > 0 && (
                  <span>
                    avg <span className="text-gray-300">{formatLatency(Math.round(s.total_latency_ms / s.trace_count))}</span>
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
