"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";

interface Session {
  id: string;
  created_at: string;
  label: string | null;
  trace_count: number;
  total_cost_usd: number;
  total_latency_ms: number;
  error_count: number;
}

type SortKey = "created_at" | "total_cost_usd" | "trace_count" | "avg_latency";
type SortDir = "asc" | "desc";

function fmt$(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${(n * 1000).toFixed(3)}m`;
  return `$${n.toFixed(4)}`;
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 text-muted-foreground/50" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 text-violet-400" />
    : <ChevronDown className="w-3 h-3 ml-1 text-violet-400" />;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = sessions
    .filter((s) => {
      const q = query.toLowerCase();
      return (
        !q ||
        s.id.toLowerCase().includes(q) ||
        (s.label ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "avg_latency") {
        av = a.trace_count > 0 ? a.total_latency_ms / a.trace_count : 0;
        bv = b.trace_count > 0 ? b.total_latency_ms / b.trace_count : 0;
      } else {
        av = sortKey === "created_at"
          ? new Date(a.created_at).getTime()
          : (a[sortKey] as number);
        bv = sortKey === "created_at"
          ? new Date(b.created_at).getTime()
          : (b[sortKey] as number);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const cols: { key: SortKey; label: string }[] = [
    { key: "created_at", label: "Session" },
    { key: "trace_count", label: "Calls" },
    { key: "total_cost_usd", label: "Cost" },
    { key: "avg_latency", label: "Avg Latency" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading…" : `${sessions.length} total session${sessions.length !== 1 ? "s" : ""}`}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by session name or ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-card border-border/50 focus-visible:ring-violet-500/50"
        />
      </div>

      {/* Table */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground text-sm">
                {query ? "No sessions match your search" : "No sessions yet"}
              </p>
              {!query && (
                <p className="text-muted-foreground/60 text-xs mt-1">
                  Start ArgusClient in your code to create your first session
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  {cols.map((col) => (
                    <TableHead
                      key={col.key}
                      className="text-muted-foreground cursor-pointer select-none"
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="flex items-center text-xs uppercase tracking-wider">
                        {col.label}
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const avgMs =
                    s.trace_count > 0
                      ? s.total_latency_ms / s.trace_count
                      : 0;
                  return (
                    <TableRow
                      key={s.id}
                      className="border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() =>
                        (window.location.href = `/dashboard/sessions/${s.id}`)
                      }
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {s.label || "Unnamed session"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {s.id.slice(0, 8)}… · {timeAgo(s.created_at)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {s.trace_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-violet-400">
                        {fmt$(s.total_cost_usd)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {s.trace_count > 0 ? fmtMs(avgMs) : "—"}
                      </TableCell>
                      <TableCell>
                        {s.error_count > 0 ? (
                          <Badge
                            variant="destructive"
                            className="text-xs font-mono"
                          >
                            {s.error_count} error{s.error_count > 1 ? "s" : ""}
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
