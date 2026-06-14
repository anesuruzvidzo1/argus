# Argus

LLM observability for Anthropic SDK users. Wraps your existing client, captures every call, streams it to a dashboard in real time.

**[Live demo](https://argus-dashboard-phi.vercel.app)**

## Why this exists

Most observability tools for LLMs either require LangChain or only support OpenAI. If you're building directly on the Anthropic SDK you're stuck using generic DevOps tooling that has no concept of tokens, tool calls, or session cost rollup.

Argus fills that gap. One wrapper class, zero framework dependencies.

## Getting started

Clone the repo and start the full stack:

```bash
git clone https://github.com/anesuruzvidzo1/argus
cd argus
cp .env.example .env
```

Open `.env` and set your `ANTHROPIC_API_KEY`. The database and Redis URLs are pre-filled for the Docker setup — leave them as-is.

```bash
docker compose up
```

Opens at `http://localhost:3000`. PostgreSQL, Redis, the backend, and the dashboard all start together.

## Integrating with your code

Copy `wrapper/tracer.py` into your project. It has two dependencies: `anthropic` and `httpx`.

```python
from tracer import ArgusClient

client = ArgusClient(
    session_label="My App",
    tracer_url="http://localhost:8000",  # or your deployed backend URL
)

response = client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "..."}],
)
```

`ArgusClient` is a drop-in replacement for `anthropic.Anthropic()`. Every call gets traced automatically — tokens, cost, latency, tool calls, errors. Your application code doesn't change.

Streaming works the same way:

```python
with client.messages.stream(model="claude-haiku-4-5", max_tokens=256, messages=[...]) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

To verify everything is working end-to-end:

```bash
python3 demo/realistic_demo.py
```

## Deploying your own backend

If you want to run Argus in production for your own project, deploy the backend to Railway or Render (both support Docker). Managed PostgreSQL and Redis are available on both platforms.

Set these environment variables on your backend deployment:

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

Then point your `ArgusClient` at the deployed backend:

```python
client = ArgusClient(
    session_label="Production App",
    tracer_url="https://your-backend.up.railway.app",
)
```

Deploy the dashboard separately to Vercel. Set `NEXT_PUBLIC_BACKEND_URL` to your Railway backend URL.

## What gets tracked

Every `messages.create()` and `messages.stream()` call logs:

- Model, input tokens, output tokens, cost in USD
- Latency from request to first byte
- Tool calls (name only, not arguments — no prompt content is stored)
- Error type and message on failure
- Session-level rollup across all calls in a conversation

The dashboard gives you an overview across all sessions, a per-session trace view, and a model breakdown comparing cost and latency per model.

## Architecture

```
Your app → ArgusClient → Anthropic API
                 ↓
           POST /traces (async, fire-and-forget)
                 ↓
         FastAPI backend → PostgreSQL
                 ↓
              Redis pub/sub
                 ↓
         Next.js dashboard (SSE)
```

A few decisions worth explaining:

The tracer posts traces in the background with a short timeout and swallows all exceptions. Tracing cannot break or slow down your application — if Argus goes down, your AI feature keeps working.

Redis sits between the backend and dashboard for fan-out. Multiple viewers can watch the same session simultaneously without the backend holding a connection per user.

SSE instead of WebSockets because the dashboard only needs server-to-client push. WebSockets add bidirectional overhead that this use case doesn't need.

asyncpg instead of SQLAlchemy because trace inserts are high-frequency writes against a stable schema. The ORM abstraction adds overhead without benefit here.

## Stack

Python, FastAPI, asyncpg, PostgreSQL, Redis, Next.js 15 (App Router), TypeScript, Recharts, Clerk, Docker Compose.

Deployed on Vercel (dashboard) and Railway (backend + databases).

## What this doesn't do

Prompt content is not logged. Argus stores metadata only. This is intentional — storing message content creates data liability and most teams don't want their users' prompts in a third-party database.

No alerting yet. No multi-provider support (OpenAI, Gemini). No team accounts. These are next.

## License

MIT
