"""
Run: ANTHROPIC_API_KEY=sk-ant-... python demo/demo.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from wrapper.tracer import ArgusClient


def main():
    client = ArgusClient(session_label="Demo")
    print(f"Session:   {client.session_id}")
    print(f"Dashboard: http://localhost:3000/sessions/{client.session_id}")
    print()

    print("Call 1 — basic completion")
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=128,
        messages=[{"role": "user", "content": "What is 2 + 2? Reply in one sentence."}],
    )
    print(response.content[0].text)
    print()

    print("Call 2 — tool use")
    tools = [
        {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "input_schema": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"}
                },
                "required": ["city"],
            },
        }
    ]
    response2 = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=256,
        tools=tools,
        messages=[{"role": "user", "content": "What is the weather in Chicago?"}],
    )
    print(f"Stop reason: {response2.stop_reason}")
    if response2.content:
        for block in response2.content:
            if block.type == "tool_use":
                print(f"Tool called: {block.name}({block.input})")
    print()

    print("Call 3 — streamed response")
    with client.messages.stream(
        model="claude-haiku-4-5",
        max_tokens=128,
        messages=[{"role": "user", "content": "Name three colours."}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
    print("\n")

    print(f"View all traces: http://localhost:3000/sessions/{client.session_id}")


if __name__ == "__main__":
    main()
