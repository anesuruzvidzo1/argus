"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  Activity,
  Zap,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
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

interface Stats {
  totalCost: number;
  totalCalls: number;
  avgLatencyMs: number;
  errorRate: number;
}

interface ChartPoint {
  date: string;
  cost: number;
}

const chartConfig = {
  cost: {
    label: "Cost ($)",
    color: "#7c3aed",
  },
};

function fmt$(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${(n * 1000).toFixed(3)}m`;
  return `$${n.toFixed(4)}`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function buildChartData(sessions: Session[]): ChartPoint[] {
  const days: ChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const cost = sessions
      .filter((s) => {
        const sd = new Date(s.created_at);
        return (
          sd.getFullYear() === d.getFullYear() &&
          sd.getMonth() === d.getMonth() &&
          sd.getDate() === d.getDate()
        );
      })
      .reduce((sum, s) => sum + s.total_cost_usd, 0);
    days.push({ date: label, cost: parseFloat(cost.toFixed(6)) });
  }
  return days;
}

function calcStats(sessions: Session[]): Stats {
  const totalCost = sessions.reduce((s, x) => s + x.total_cost_usd, 0);
  const totalCalls = sessions.reduce((s, x) => s + x.trace_count, 0);
  const totalLatency = sessions.reduce((s, x) => s + x.total_latency_ms, 0);
  const totalErrors = sessions.reduce((s, x) => s + x.error_count, 0);
  return {
    totalCost,
    totalCalls,
    avgLatencyMs: totalCalls > 0 ? totalLatency / totalCalls : 0,
    errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0,
  };
}

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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
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

export default function OverviewPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/backend/sessions");
    if (res.ok) setSessions(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
    const source = new EventSource("/api/backend/stream");
    source.onmessage = () => fetchSessions();
    source.onerror = () => source.close();
    return () => source.close();
  }, [fetchSessions]);

  const stats = calcStats(sessions);
  const chartData = buildChartData(sessions);
  const recent = sessions.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All-time metrics across every session
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

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Cost"
            value={fmt$(stats.totalCost)}
            icon={DollarSign}
            sub="All sessions combined"
          />
          <StatCard
            title="API Calls"
            value={stats.totalCalls.toLocaleString()}
            icon={Activity}
            sub={`Across ${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
          />
          <StatCard
            title="Avg Latency"
            value={stats.totalCalls > 0 ? fmtMs(stats.avgLatencyMs) : "—"}
            icon={Zap}
            sub="Per API call"
          />
          <StatCard
            title="Error Rate"
            value={stats.totalCalls > 0 ? `${stats.errorRate.toFixed(1)}%` : "—"}
            icon={AlertTriangle}
            sub="Failed calls"
            accent={stats.errorRate > 5}
          />
        </div>
      )}

      {/* Cost chart */}
      <Card className="bg-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Cost over time</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
          </div>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={45}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`$${Number(value).toFixed(5)}`, "Cost"]}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#costGrad)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Sessions
          </h2>
          <Link
            href="/dashboard/sessions"
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : recent.length === 0 ? (
          <Card className="bg-card border-border/50 border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">No sessions yet</p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Run a script using ArgusClient to see traces here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <Link key={s.id} href={`/dashboard/sessions/${s.id}`}>
                <Card className="bg-card border-border/50 hover:border-violet-500/30 transition-colors cursor-pointer">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-sm font-medium">
                        {s.label || s.id.slice(0, 12) + "…"}
                      </span>
                      {s.error_count > 0 && (
                        <Badge variant="destructive" className="text-xs py-0">
                          {s.error_count} error{s.error_count > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-5 text-xs text-muted-foreground font-mono">
                      <span>{s.trace_count} calls</span>
                      <span className="text-violet-400">{fmt$(s.total_cost_usd)}</span>
                      <span>
                        {new Date(s.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
