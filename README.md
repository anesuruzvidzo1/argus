# Argus

LLM observability for Anthropic SDK users. Wraps your existing client, captures every call, streams it to a dashboard in real time.

**[Live demo](https://argus-dashboard-phi.vercel.app)**

## Why this exists

Most observability tools for LLMs either require LangChain or only support OpenAI. If you're building directly on the Anthropic SDK you're stuck using generic DevOps tooling that has no concept of tokens, tool calls, or session cost rollup.

Argus fills that gap. One wrapper class, zero framework dependencies.

## Usage

```python
from argus import ArgusClient

client = ArgusClient(session_label="My App")

response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    messages=[{"role": "user", "content": "..."}],
)
```

That's it. `ArgusClient` is a transparent wrapper around `anthropic.Anthropic()`. Every call you make gets traced automatically — tokens, cost, latency, tool calls, errors. Your code doesn't change.

Streaming works too:

```python
with client.messages.stream(model="claude-haiku-4-5", max_tokens=256, messages=[...]) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

## Self-hosting

```bash
git clone https://github.com/anesuruzvidzo1/argus
cd argus
cp .env.example .env  # add your ANTHROPIC_API_KEY
docker compose up
```

Opens at `http://localhost:3000`. PostgreSQL, Redis, the FastAPI backend, and the Next.js dashboard all start together.

To verify everything is working:

```bash
python3 demo/realistic_demo.py
```

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
