import asyncpg
import os
import json
from typing import Optional

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])
    return _pool


async def create_or_get_session(session_id: str, label: Optional[str] = None) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO sessions (id, label) VALUES ($1, $2)
               ON CONFLICT (id) DO UPDATE SET label = COALESCE(EXCLUDED.label, sessions.label)
               RETURNING *""",
            session_id, label
        )
        return dict(row)


async def insert_trace(trace: dict) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """INSERT INTO traces
                   (session_id, model, input_tokens, output_tokens,
                    cache_read_input_tokens, cache_creation_input_tokens,
                    cost_usd, latency_ms, success, error_type, error_message,
                    stop_reason, tool_call_count, metadata)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                   RETURNING id""",
                trace["session_id"], trace["model"],
                trace["input_tokens"], trace["output_tokens"],
                trace.get("cache_read_input_tokens", 0),
                trace.get("cache_creation_input_tokens", 0),
                trace["cost_usd"], trace["latency_ms"],
                trace["success"], trace.get("error_type"), trace.get("error_message"),
                trace.get("stop_reason"), trace.get("tool_call_count", 0),
                json.dumps(trace.get("metadata", {}))
            )
            trace_id = str(row["id"])

            await conn.execute(
                """UPDATE sessions SET
                   total_input_tokens  = total_input_tokens  + $2,
                   total_output_tokens = total_output_tokens + $3,
                   total_cost_usd      = total_cost_usd      + $4,
                   total_latency_ms    = total_latency_ms    + $5,
                   trace_count         = trace_count         + 1,
                   error_count         = error_count         + $6
                   WHERE id = $1""",
                trace["session_id"],
                trace["input_tokens"], trace["output_tokens"],
                trace["cost_usd"], trace["latency_ms"],
                0 if trace["success"] else 1
            )

    return trace_id


async def get_sessions(limit: int = 50) -> list:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM sessions ORDER BY created_at DESC LIMIT $1", limit
        )
        return [dict(r) for r in rows]


async def get_session(session_id: str) -> Optional[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        return dict(row) if row else None


async def get_traces(session_id: str) -> list:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM traces WHERE session_id = $1 ORDER BY created_at ASC",
            session_id
        )
        return [dict(r) for r in rows]


async def get_model_stats() -> list:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                model,
                COUNT(*)                                             AS total_calls,
                SUM(cost_usd)                                        AS total_cost_usd,
                SUM(input_tokens)                                    AS total_input_tokens,
                SUM(output_tokens)                                   AS total_output_tokens,
                AVG(latency_ms)                                      AS avg_latency_ms,
                SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)        AS error_count
            FROM traces
            WHERE model != 'init'
            GROUP BY model
            ORDER BY total_cost_usd DESC
            """
        )
        return [dict(r) for r in rows]
