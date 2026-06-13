# Argus — LLM Observability for Anthropic SDK Users

Real-time cost, latency, and error tracking for Claude API calls. Built for teams that use the Anthropic SDK directly — no LangChain, no vendor lock-in, self-hostable.

**Live demo:** [argus-dashboard-phi.vercel.app](https://argus-dashboard-phi.vercel.app)

---

## The problem

Most LLM observability tools are built around OpenAI or require LangChain as a dependency. Teams using the Anthropic SDK directly — building raw agents, tool-use pipelines, or multi-turn applications — have no native option. They fall back to generic DevOps tooling (Grafana, Sentry) that was never designed for the semantic structure of LLM calls.

The result: you ship an AI feature, it runs in production, and you have no idea what it costs per user session, which tool calls are failing, or where your agent is spending time. You find out when the invoice arrives or when a user reports broken behavior.

Argus solves this with a one-line SDK wrapper that captures everything — tokens, cost, latency, tool calls, errors — and streams it to a real-time dashboard.

---

## Features

- **Session-level cost rollup** — track what an entire multi-turn conversation costs, not just individual calls
- **Tool call tracing** — log which tools were called, with what arguments, and whether they succeeded
- **Real-time dashboard** — live updates via Server-Sent Events, no polling
- **Error classification** — failed calls logged with error type, message, and token context at time of failure
- **Model breakdown** — compare cost, latency, and error rate across models in the same application
- **Native Anthropic SDK** — wraps `anthropic.Anthropic()` directly. Works with `messages.create()` and `messages.stream()`
- **Self-hostable** — one `docker compose up` command. Your traces stay in your infrastructure

---

## Quickstart

**Step 1 — Replace your client**

```python
# Before
import anthropic
client = anthropic.Anthropic()

# After
from argus import ArgusClient
client = ArgusClient(session_label="My App")
```

**Step 2 — Use it exactly as before**

```python
response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Summarize this document"}],
)
```

**Step 3 — Open the dashboard**

```
http://localhost:3000
```

Every call appears instantly. No configuration needed.

---

## Self-hosting

Requirements: Docker, Docker Compose

```bash
git clone https://github.com/anesuruzvidzo1/argus
cd argus
docker compose up
```

That starts four services: PostgreSQL (trace storage), Redis (real-time pub/sub), FastAPI backend (trace ingestion API), and the Next.js dashboard. Everything runs locally. No external dependencies.

Set your Anthropic API key:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

Run the demo to verify everything is working:

```bash
python3 demo/realistic_demo.py
```

---

## Architecture

```
Your Application
      │
      │  client.messages.create(...)
      ▼
ArgusClient (Python wrapper)
      │
      │  POST /traces (async, fire-and-forget)
      ▼
FastAPI Backend ──► PostgreSQL (trace storage)
      │
      │  Redis pub/sub
      ▼
Next.js Dashboard ◄── SSE stream (live updates)
```

**Why this architecture:**

The wrapper posts traces asynchronously with a short timeout and swallows all exceptions. This is intentional — tracing must never interrupt or slow down the calling application. If Argus goes down, your AI feature keeps working.

Redis sits between the backend and the dashboard for fan-out. Multiple dashboard viewers can watch the same session simultaneously without the backend holding open connections for each one.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Dashboard | Next.js 15, TypeScript | App Router, React Server Components, streaming SSR |
| Auth | Clerk | JWT and session management without custom implementation |
| Charts | Recharts | Lightweight, composable, works with RSC |
| Backend | FastAPI, Python | Async-first, built-in OpenAPI docs, low overhead for I/O-bound trace ingestion |
| Database driver | asyncpg | Direct PostgreSQL async driver — lower overhead than SQLAlchemy for high-frequency inserts |
| Trace storage | PostgreSQL | ACID guarantees for cost accounting, familiar query surface |
| Real-time | Redis pub/sub | O(1) fan-out, decouples ingestion from delivery |
| Real-time transport | Server-Sent Events | Unidirectional push is sufficient — no need for WebSocket bidirectional overhead |
| Deployment | Docker Compose | Single-command local deployment, reproducible across environments |
| Production | Vercel (dashboard), Railway (backend + databases) | |

---

## Observability standards

Argus follows the [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) for AI observability. The trace schema maps to `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, and `gen_ai.usage.output_tokens` — the emerging standard for LLM instrumentation across the industry.

This means trace data collected by Argus is structurally compatible with OpenTelemetry-native tooling and can be exported to Grafana, Prometheus, or any OTel-compatible backend without schema migration.

---

## Deployment

The production architecture separates concerns across platforms:

- **Vercel** hosts the Next.js dashboard. Serverless functions handle the Clerk auth middleware and backend API proxying.
- **Railway** hosts the FastAPI backend, PostgreSQL database, and Redis instance. Docker-based deployment with managed networking between services.

Environment variables required for production:

```
# Dashboard (Vercel)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_BACKEND_URL=https://your-railway-backend.up.railway.app
BACKEND_URL=https://your-railway-backend.up.railway.app

# Backend (Railway)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

---

## What Argus does not do (yet)

- Prompt logging — Argus logs metadata, not message content. This is intentional for privacy.
- OpenAI or Gemini support — Anthropic SDK focus is the current scope.
- Alerting — no notification system for error rate thresholds. Planned.
- Team accounts — single-tenant in the current version.

---

## License

MIT. Use it, fork it, deploy it inside your company.

---

Built by [Anesu Ruzvidzo](https://linkedin.com/in/anesu-ruzvidzo-428193294) as part of a larger open-source AI engineering portfolio.
