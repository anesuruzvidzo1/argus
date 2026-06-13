import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  DollarSign,
  Zap,
  AlertCircle,
  ArrowRight,
  Terminal,
  BarChart3,
  Eye,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Real-time traces",
    description:
      "Every API call is captured the moment it happens. Watch your agent work live, call by call.",
  },
  {
    icon: DollarSign,
    title: "Cost tracking",
    description:
      "Know exactly what every session costs. Per-call breakdown and cumulative session totals across all models.",
  },
  {
    icon: Zap,
    title: "Latency monitoring",
    description:
      "Track response times per call and per model. Identify which parts of your agent are slow.",
  },
  {
    icon: AlertCircle,
    title: "Error visibility",
    description:
      "Every failure is logged with type, message, and context. Stop guessing why your agent broke in production.",
  },
];

const steps = [
  {
    step: "01",
    title: "Wrap your client",
    description: "Replace anthropic.Anthropic() with ArgusClient(). One line change, nothing else breaks.",
    code: `from argus import ArgusClient\n\nclient = ArgusClient(session_label="My App")`,
  },
  {
    step: "02",
    title: "Use it normally",
    description: "Call the API exactly as you always have. Argus captures everything silently in the background.",
    code: `response = client.messages.create(\n  model="claude-opus-4-8",\n  messages=[...]\n)`,
  },
  {
    step: "03",
    title: "Open the dashboard",
    description: "See every call, cost, latency, and error in real time. No configuration needed.",
    code: `# Open your dashboard\n# Every trace appears instantly`,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-violet-400" />
            <span className="font-bold tracking-tight">Argus</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge
          variant="outline"
          className="mb-6 border-violet-500/30 text-violet-400 bg-violet-500/10"
        >
          Open source · Self-hostable · Anthropic native
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6 leading-tight">
          See exactly what your
          <br />
          <span className="text-violet-400">AI agent is doing</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Argus gives engineering teams real-time visibility into every Claude API call —
          what it cost, how long it took, what failed, and why. Know what your AI is
          doing in production before your users notice something is wrong.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            >
              Open dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <a
            href="https://github.com/anesuruzvidzo1/argus"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" variant="outline" className="gap-2">
              <Terminal className="w-4 h-4" /> View on GitHub
            </Button>
          </a>
        </div>

        {/* Stats row */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          {[
            { value: "< 2ms", label: "Tracing overhead" },
            { value: "4", label: "Models supported" },
            { value: "100%", label: "Open source" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Three steps to full visibility
            </h2>
            <p className="text-muted-foreground">
              No infrastructure changes. Works with your existing Claude setup.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <Card key={s.step} className="bg-card border-border/50">
                <CardContent className="pt-6">
                  <span className="text-xs font-mono text-violet-400 font-bold">
                    {s.step}
                  </span>
                  <h3 className="font-semibold mt-2 mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {s.description}
                  </p>
                  <pre className="bg-background rounded-md p-3 text-xs font-mono text-muted-foreground overflow-x-auto border border-border/50">
                    {s.code}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Everything you need to understand your agent
          </h2>
          <p className="text-muted-foreground">
            Purpose-built for teams running Claude in production — no wrappers, no vendor lock-in.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="bg-card border-border/50">
              <CardContent className="pt-6 flex gap-4">
                <div className="w-9 h-9 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <BarChart3 className="w-10 h-10 text-violet-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Start tracing in under a minute
          </h2>
          <p className="text-muted-foreground mb-8">
            Self-host with Docker Compose or connect to any running instance.
          </p>
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            >
              Open dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-violet-400" />
            <span>Argus</span>
          </div>
          <p>Open source LLM observability for Anthropic SDK users.</p>
        </div>
      </footer>
    </div>
  );
}
