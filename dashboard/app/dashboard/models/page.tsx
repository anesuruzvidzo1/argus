"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

interface ModelStat {
  model: string;
  total_calls: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_ms: number;
  error_count: number;
}

function fmt$(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${(n * 1000).toFixed(3)}m`;
  return `$${n.toFixed(4)}`;
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function modelLabel(model: string) {
  return model.replace("claude-", "");
}

function modelColor(model: string) {
  if (model.includes("fable") || model.includes("mythos")) return "#facc15";
  if (model.includes("opus")) return "#a78bfa";
  if (model.includes("sonnet")) return "#60a5fa";
  if (model.includes("haiku")) return "#34d399";
  return "#94a3b8";
}

function modelBadgeClass(model: string) {
  if (model.includes("fable") || model.includes("mythos"))
    return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  if (model.includes("opus"))
    return "text-violet-400 bg-violet-500/10 border-violet-500/20";
  if (model.includes("sonnet"))
    return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (model.includes("haiku"))
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  return "text-muted-foreground bg-muted border-border";
}

const costChartConfig = { cost: { label: "Cost ($)" } };
const latencyChartConfig = { latency: { label: "Avg Latency" } };

export default function ModelsPage() {
  const [stats, setStats] = useState<ModelStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/backend/stats/models");
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const source = new EventSource("/api/backend/stream");
    source.onmessage = () => fetchStats();
    source.onerror = () => source.close();
    return () => source.close();
  }, [fetchStats]);

  const totalCost = stats.reduce((s, m) => s + m.total_cost_usd, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Models</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cost, latency, and error breakdown per model
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

      {/* Charts */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      ) : stats.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Cost by model */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Cost by model</CardTitle>
              <p className="text-xs text-muted-foreground">Total spend per model</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={costChartConfig} className="h-44 w-full">
                <BarChart
                  data={stats.map((m) => ({
                    model: modelLabel(m.model),
                    cost: parseFloat(m.total_cost_usd.toFixed(6)),
                    fill: modelColor(m.model),
                  }))}
                  barSize={32}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="model"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={50}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => [`$${Number(v).toFixed(5)}`, "Cost"]}
                      />
                    }
                  />
                  <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                    {stats.map((m, i) => (
                      <Cell key={i} fill={modelColor(m.model)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Latency by model */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Avg latency by model</CardTitle>
              <p className="text-xs text-muted-foreground">Mean response time per model</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={latencyChartConfig} className="h-44 w-full">
                <BarChart
                  data={stats.map((m) => ({
                    model: modelLabel(m.model),
                    latency: Math.round(m.avg_latency_ms),
                  }))}
                  barSize={32}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="model"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmtMs(v)}
                    width={55}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => [fmtMs(Number(v)), "Avg Latency"]}
                      />
                    }
                  />
                  <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
                    {stats.map((m, i) => (
                      <Cell key={i} fill={modelColor(m.model)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Table */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : stats.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground text-sm">No model data yet</p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Model stats appear once you start making API calls with ArgusClient
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  {["Model", "Calls", "Total Cost", "Cost Share", "Avg Latency", "Tokens", "Errors"].map((h) => (
                    <TableHead key={h} className="text-xs uppercase tracking-wider text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((m) => {
                  const errorRate = m.total_calls > 0
                    ? (m.error_count / m.total_calls) * 100
                    : 0;
                  const costShare = totalCost > 0
                    ? (m.total_cost_usd / totalCost) * 100
                    : 0;

                  return (
                    <TableRow key={m.model} className="border-border/50 hover:bg-accent/30">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${modelBadgeClass(m.model)}`}
                        >
                          {modelLabel(m.model)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {m.total_calls.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-violet-400">
                        {fmt$(m.total_cost_usd)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${costShare}%`,
                                backgroundColor: modelColor(m.model),
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {costShare.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {fmtMs(m.avg_latency_ms)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {(m.total_input_tokens + m.total_output_tokens).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {m.error_count > 0 ? (
                          <Badge variant="destructive" className="text-xs font-mono">
                            {m.error_count} ({errorRate.toFixed(1)}%)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          >
                            Clean
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
