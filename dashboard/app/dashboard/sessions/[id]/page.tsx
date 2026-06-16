"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import {
  DollarSign,
  Activity,
  Zap,
  AlertTriangle,
  ChevronLeft,
  Wrench,
} from "lucide-react";

interface Trace {
  id: string;
  created_at: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
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

function fmt$(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.000_01) return `$${(n * 1_000_000).toFixed(1)}µ`;
  if (n < 0.001) return `$${(n * 1_000_000).toFixed(0)}µ`;
  return `$${n.toFixed(5)}`;
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function modelLabel(model: string) {
  return model.replace("claude-", "");
}

function modelColor(model: string): string {
  if (model.includes("fable") || model.includes("mythos")) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  if (model.includes("opus")) return "text-violet-400 bg-violet-500/10 border-violet-500/20";
  if (model.includes("sonnet")) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (model.includes("haiku")) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  return "text-muted-foreground bg-muted border-border";
}

function latencyColor(ms: number) {
  if (ms > 8000) return "#ef4444";
  if (ms > 4000) return "#f59e0b";
  return "#7c3aed";
}

const chartConfig = {
  latency: { label: "Latency", color: "#7c3aed" },
};

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`w-4 h-4 ${accent ? "text-red-400" : "text-violet-400"}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold font-mono ${accent ? "text-red-400" : "text-foreground"}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Session not found.</p>
        <Link href="/dashboard/sessions" className="text-violet-400 text-sm mt-2 inline-block hover:underline">
          ← Back to sessions
        </Link>
      </div>
    );
  }

  const avgLatency =
    session.trace_count > 0
      ? session.total_latency_ms / session.trace_count
      : 0;

  const totalCacheReadTokens = traces.reduce((sum, t) => sum + (t.cache_read_input_tokens || 0), 0);
  const totalCacheCreationTokens = traces.reduce((sum, t) => sum + (t.cache_creation_input_tokens || 0), 0);

  const chartData = traces.map((t, i) => ({
    call: `#${i + 1}`,
    latency: t.latency_ms,
    success: t.success,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/sessions"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-3 h-3" /> Sessions
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {session.label || "Unnamed session"}
            </h1>
            <p className="text-xs text-muted-foreground font-mono mt-1 select-all">
              {session.id}
            </p>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
          >
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </Badge>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Cost"
          value={fmt$(session.total_cost_usd)}
          icon={DollarSign}
          sub={`${(session.total_input_tokens + session.total_output_tokens).toLocaleString()} tokens`}
        />
        <StatCard
          title="API Calls"
          value={String(session.trace_count)}
          icon={Activity}
          sub={`${session.total_input_tokens.toLocaleString()} in / ${session.total_output_tokens.toLocaleString()} out`}
        />
        <StatCard
          title="Avg Latency"
          value={session.trace_count > 0 ? fmtMs(avgLatency) : "—"}
          icon={Zap}
          sub="Per API call"
        />
        <StatCard
          title="Errors"
          value={String(session.error_count)}
          icon={AlertTriangle}
          sub={session.error_count > 0 ? "Check traces below" : "No errors"}
          accent={session.error_count > 0}
        />
      </div>

      {/* Cache banner */}
      {totalCacheReadTokens > 0 && (
        <div className="flex items-center gap-2.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
          <Zap className="w-3.5 h-3.5 shrink-0" />
          <span>
            Prompt cache active &middot;{" "}
            <span className="font-mono font-semibold">{totalCacheReadTokens.toLocaleString()}</span> tokens served from cache
            {totalCacheCreationTokens > 0 && (
              <> &middot; <span className="font-mono font-semibold">{totalCacheCreationTokens.toLocaleString()}</span> written</>
            )}
            {" "}&middot; cache reads billed at <span className="font-semibold">10%</span> of standard input rate
          </span>
        </div>
      )}

      {/* Latency chart */}
      {traces.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Latency per call</CardTitle>
            <p className="text-xs text-muted-foreground">
              Purple = normal · Amber = slow (&gt;4s) · Red = very slow (&gt;8s)
            </p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-44 w-full">
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="call"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtMs(v)}
                  width={55}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [fmtMs(Number(value)), "Latency"]}
                    />
                  }
                />
                <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={latencyColor(entry.latency)} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Trace table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Traces ({traces.length})
        </h2>

        <Card className="bg-card border-border/50">
          <CardContent className="p-0">
            {traces.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No traces yet — waiting for API calls…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    {["#", "Model", "Tokens", "Cost", "Latency", "Tools", "Status"].map((h) => (
                      <TableHead key={h} className="text-xs uppercase tracking-wider text-muted-foreground">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traces.map((trace, i) => (
                    <>
                      <TableRow
                        key={trace.id}
                        className={`border-border/50 transition-colors ${
                          !trace.success ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-accent/30"
                        }`}
                      >
                        <TableCell className="text-muted-foreground font-mono text-xs w-8">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono ${modelColor(trace.model)}`}
                          >
                            {modelLabel(trace.model)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          <div>
                            {trace.input_tokens.toLocaleString()}
                            <span className="text-border mx-1">→</span>
                            {trace.output_tokens.toLocaleString()}
                          </div>
                          {trace.cache_read_input_tokens > 0 && (
                            <div className="text-emerald-400 mt-0.5 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" />
                              {trace.cache_read_input_tokens.toLocaleString()} cached · 90% off
                            </div>
                          )}
                          {trace.cache_creation_input_tokens > 0 && (
                            <div className="text-amber-400/70 mt-0.5 text-[10px]">
                              ↑ cache written
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-violet-400">
                          {fmt$(trace.cost_usd)}
                        </TableCell>
                        <TableCell
                          className={`font-mono text-sm ${
                            trace.latency_ms > 8000
                              ? "text-red-400"
                              : trace.latency_ms > 4000
                              ? "text-amber-400"
                              : "text-foreground"
                          }`}
                        >
                          {fmtMs(trace.latency_ms)}
                        </TableCell>
                        <TableCell>
                          {trace.tool_call_count > 0 ? (
                            <span className="flex items-center gap-1 text-xs text-blue-400">
                              <Wrench className="w-3 h-3" />
                              {trace.tool_call_count}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {trace.success ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            >
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              {trace.error_type ?? "Error"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Error detail row */}
                      {!trace.success && trace.error_message && (
                        <TableRow key={`${trace.id}-err`} className="border-border/50 bg-red-500/5">
                          <TableCell colSpan={7} className="py-2 pl-10">
                            <p className="text-xs text-red-400 font-mono break-all">
                              {trace.error_message}
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
