from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
import json
import asyncio
from decimal import Decimal
from pathlib import Path

from database import (
    create_or_get_session, insert_trace,
    get_sessions, get_session, get_traces, get_model_stats,
    get_pool,
)
from redis_client import publish_trace, subscribe_session, subscribe_all
from cost import calculate_cost


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await get_pool()
    schema = (Path(__file__).parent / "schema.sql").read_text()
    async with pool.acquire() as conn:
        await conn.execute(schema)
    yield


app = FastAPI(title="Argus — LLM Observability", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ToolCallPayload(BaseModel):
    tool_name: str
    latency_ms: int = 0
    success: bool = True
    error_message: Optional[str] = None


class TracePayload(BaseModel):
    session_id: str
    model: str
    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    latency_ms: int
    success: bool = True
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    stop_reason: Optional[str] = None
    tool_calls: list[ToolCallPayload] = []
    session_label: Optional[str] = None
    metadata: dict = {}


@app.post("/traces", status_code=201)
async def create_trace(payload: TracePayload):
    cost = calculate_cost(
        payload.model,
        payload.input_tokens,
        payload.output_tokens,
        payload.cache_read_input_tokens,
        payload.cache_creation_input_tokens,
    )

    await create_or_get_session(payload.session_id, payload.session_label)

    trace_data = {
        "session_id": payload.session_id,
        "model": payload.model,
        "input_tokens": payload.input_tokens,
        "output_tokens": payload.output_tokens,
        "cache_read_input_tokens": payload.cache_read_input_tokens,
        "cache_creation_input_tokens": payload.cache_creation_input_tokens,
        "cost_usd": cost,
        "latency_ms": payload.latency_ms,
        "success": payload.success,
        "error_type": payload.error_type,
        "error_message": payload.error_message,
        "stop_reason": payload.stop_reason,
        "tool_call_count": len(payload.tool_calls),
        "metadata": payload.metadata,
    }

    trace_id = await insert_trace(trace_data)

    await publish_trace(payload.session_id, {
        "type": "trace",
        "trace_id": trace_id,
        "session_id": payload.session_id,
        "model": payload.model,
        "input_tokens": payload.input_tokens,
        "output_tokens": payload.output_tokens,
        "cost_usd": cost,
        "latency_ms": payload.latency_ms,
        "success": payload.success,
        "tool_call_count": len(payload.tool_calls),
    })

    return {"trace_id": trace_id, "cost_usd": cost}


@app.get("/sessions")
async def list_sessions():
    sessions = await get_sessions()
    return [_serialize(s) for s in sessions]


@app.get("/stats/models")
async def model_stats():
    rows = await get_model_stats()
    return [_serialize(r) for r in rows]


@app.get("/sessions/{session_id}")
async def get_session_detail(session_id: str):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    traces = await get_traces(session_id)
    return {
        "session": _serialize(session),
        "traces": [_serialize(t) for t in traces],
    }


@app.get("/sessions/{session_id}/stream")
async def stream_session(session_id: str):
    async def generate():
        pubsub = await subscribe_session(session_id)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
        except asyncio.CancelledError:
            await pubsub.unsubscribe()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/stream")
async def stream_all():
    async def generate():
        pubsub = await subscribe_all()
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
        except asyncio.CancelledError:
            await pubsub.unsubscribe()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _serialize(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            out[k] = float(v)
        elif hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out
