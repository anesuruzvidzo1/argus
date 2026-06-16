PRICING: dict[str, dict[str, float]] = {
    "claude-fable-5":    {"input": 10.00, "output": 50.00},
    "claude-mythos-5":   {"input": 10.00, "output": 50.00},
    "claude-opus-4-8":   {"input":  5.00, "output": 25.00},
    "claude-opus-4-7":   {"input":  5.00, "output": 25.00},
    "claude-opus-4-6":   {"input":  5.00, "output": 25.00},
    "claude-sonnet-4-6": {"input":  3.00, "output": 15.00},
    "claude-haiku-4-5":  {"input":  1.00, "output":  5.00},
}

_FALLBACK = {"input": 3.00, "output": 15.00}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_input_tokens: int = 0,
    cache_creation_input_tokens: int = 0,
) -> float:
    pricing = PRICING.get(model)
    if pricing is None:
        for key, val in PRICING.items():
            if model.startswith(key):
                pricing = val
                break
    if pricing is None:
        pricing = _FALLBACK

    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    cache_read_cost = (cache_read_input_tokens / 1_000_000) * pricing["input"] * 0.10
    cache_creation_cost = (cache_creation_input_tokens / 1_000_000) * pricing["input"] * 1.25
    return round(input_cost + output_cost + cache_read_cost + cache_creation_cost, 8)
