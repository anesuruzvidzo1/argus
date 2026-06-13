import redis.asyncio as aioredis
import os
import json
from typing import Optional

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(
            os.environ.get("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True,
        )
    return _redis


async def publish_trace(session_id: str, data: dict) -> None:
    r = await get_redis()
    payload = json.dumps(data)
    await r.publish(f"traces:{session_id}", payload)
    await r.publish("traces:all", payload)


async def subscribe_session(session_id: str):
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(f"traces:{session_id}")
    return pubsub


async def subscribe_all():
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe("traces:all")
    return pubsub
