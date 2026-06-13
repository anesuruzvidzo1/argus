import time
import uuid
import httpx
import anthropic
from typing import Optional, Any


class TracedMessages:
    def __init__(self, client: anthropic.Anthropic, session_id: str, tracer_url: str):
        self._client = client
        self._session_id = session_id
        self._tracer_url = tracer_url

    def create(self, **kwargs) -> anthropic.types.Message:
        start = time.monotonic()
        response: Optional[anthropic.types.Message] = None
        error_type: Optional[str] = None
        error_message: Optional[str] = None

        try:
            response = self._client.messages.create(**kwargs)
            return response
        except anthropic.APIError as exc:
            error_type = type(exc).__name__
            error_message = str(exc)
            raise
        finally:
            latency_ms = int((time.monotonic() - start) * 1000)
            tool_calls = []
            if response is not None:
                for block in response.content:
                    if block.type == "tool_use":
                        tool_calls.append({"tool_name": block.name, "latency_ms": 0, "success": True})
            self._post(
                model=kwargs.get("model", "unknown"),
                response=response,
                latency_ms=latency_ms,
                tool_calls=tool_calls,
                error_type=error_type,
                error_message=error_message,
            )

    def stream(self, **kwargs) -> "_TracedStream":
        return _TracedStream(self._client, kwargs, self._session_id, self._tracer_url)

    def _post(
        self,
        model: str,
        response: Optional[anthropic.types.Message],
        latency_ms: int,
        tool_calls: list,
        error_type: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        payload = {
            "session_id": self._session_id,
            "model": model,
            "input_tokens": response.usage.input_tokens if response else 0,
            "output_tokens": response.usage.output_tokens if response else 0,
            "latency_ms": latency_ms,
            "success": error_type is None,
            "error_type": error_type,
            "error_message": error_message,
            "stop_reason": response.stop_reason if response else None,
            "tool_calls": tool_calls,
        }
        try:
            with httpx.Client(timeout=2.0) as http:
                http.post(f"{self._tracer_url}/traces", json=payload)
        except Exception:
            pass  # tracing must never break the caller


class _TracedStream:
    def __init__(
        self,
        client: anthropic.Anthropic,
        kwargs: dict,
        session_id: str,
        tracer_url: str,
    ):
        self._client = client
        self._kwargs = kwargs
        self._session_id = session_id
        self._tracer_url = tracer_url
        self._ctx: Any = None
        self._start: float = 0.0

    def __enter__(self):
        self._start = time.monotonic()
        self._ctx = self._client.messages.stream(**self._kwargs).__enter__()
        return self._ctx

    def __exit__(self, *args):
        result = self._ctx.__exit__(*args)
        latency_ms = int((time.monotonic() - self._start) * 1000)
        try:
            msg = self._ctx.get_final_message()
            tool_calls = [
                {"tool_name": b.name, "latency_ms": 0, "success": True}
                for b in msg.content
                if b.type == "tool_use"
            ]
            payload = {
                "session_id": self._session_id,
                "model": self._kwargs.get("model", "unknown"),
                "input_tokens": msg.usage.input_tokens,
                "output_tokens": msg.usage.output_tokens,
                "latency_ms": latency_ms,
                "success": True,
                "stop_reason": msg.stop_reason,
                "tool_calls": tool_calls,
            }
            with httpx.Client(timeout=2.0) as http:
                http.post(f"{self._tracer_url}/traces", json=payload)
        except Exception:
            pass
        return result


class ArgusClient:
    """
    Transparent wrapper around anthropic.Anthropic that traces every API call to Argus.

    Usage:
        from wrapper.tracer import ArgusClient

        client = ArgusClient(
            session_id="optional-custom-id",
            session_label="My App",
            tracer_url="http://localhost:8000",
        )
        response = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=1024,
            messages=[{"role": "user", "content": "Hello"}],
        )
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
        session_label: Optional[str] = None,
        tracer_url: str = "http://localhost:8000",
        **anthropic_kwargs,
    ):
        if api_key:
            self._client = anthropic.Anthropic(api_key=api_key, **anthropic_kwargs)
        else:
            self._client = anthropic.Anthropic(**anthropic_kwargs)

        self._session_id = session_id or str(uuid.uuid4())
        self._tracer_url = tracer_url
        self._session_label = session_label
        self.messages = TracedMessages(self._client, self._session_id, tracer_url)

        self._register_session(session_label)

    def _register_session(self, label: Optional[str]) -> None:
        try:
            with httpx.Client(timeout=2.0) as http:
                http.post(
                    f"{self._tracer_url}/traces",
                    json={
                        "session_id": self._session_id,
                        "session_label": label,
                        "model": "init",
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "latency_ms": 0,
                        "success": True,
                        "metadata": {"type": "session_init"},
                    },
                )
        except Exception:
            pass

    @property
    def session_id(self) -> str:
        return self._session_id
