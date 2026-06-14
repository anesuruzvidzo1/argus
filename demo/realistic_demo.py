"""
Realistic Argus demo — runs 4 production-style agent sessions.
Run: python3 demo/realistic_demo.py
"""
import sys
import os
import time
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).parent.parent))
from wrapper.tracer import ArgusClient

HAIKU = "claude-haiku-4-5"
SONNET = "claude-sonnet-4-6"
ARGUS_URL = os.environ.get("ARGUS_URL", "http://localhost:8000")

LINT_TOOL = {
    "name": "run_linter",
    "description": "Run a linter on the given Python code and return issues found.",
    "input_schema": {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "Python source code to lint"},
            "rules": {"type": "array", "items": {"type": "string"}, "description": "Lint rules to check"},
        },
        "required": ["code"],
    },
}

APPLY_FIX_TOOL = {
    "name": "apply_fix",
    "description": "Apply a code fix to the repository and open a pull request.",
    "input_schema": {
        "type": "object",
        "properties": {
            "file_path": {"type": "string"},
            "original_code": {"type": "string"},
            "fixed_code": {"type": "string"},
            "pr_title": {"type": "string"},
        },
        "required": ["file_path", "fixed_code", "pr_title"],
    },
}

LOOKUP_ORDER_TOOL = {
    "name": "lookup_order",
    "description": "Look up an order by ID and return status and tracking info.",
    "input_schema": {
        "type": "object",
        "properties": {
            "order_id": {"type": "string"},
            "customer_email": {"type": "string"},
        },
        "required": ["order_id"],
    },
}

UPDATE_TICKET_TOOL = {
    "name": "update_support_ticket",
    "description": "Update a support ticket with resolution notes and close it.",
    "input_schema": {
        "type": "object",
        "properties": {
            "ticket_id": {"type": "string"},
            "resolution": {"type": "string"},
            "status": {"type": "string", "enum": ["resolved", "escalated", "waiting"]},
            "refund_amount": {"type": "number"},
        },
        "required": ["ticket_id", "resolution", "status"],
    },
}

QUERY_DB_TOOL = {
    "name": "query_database",
    "description": "Execute a SQL query and return results as JSON.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sql": {"type": "string", "description": "SQL query to execute"},
            "database": {"type": "string", "description": "Database name"},
        },
        "required": ["sql", "database"],
    },
}


def banner(text):
    print(f"\n{'─' * 50}")
    print(f"  {text}")
    print('─' * 50)


# ── Session 1: Code Review Agent ─────────────────────────────────────────────

def run_code_review_agent():
    banner("Session 1 — Code Review Agent")
    client = ArgusClient(tracer_url=ARGUS_URL, session_label="Code Review Agent")
    print(f"Session ID: {client.session_id}\n")

    buggy_code = '''
def calculate_discount(price, discount_pct, user_type):
    if user_type = "premium":
        discount = price * discount_pct
    else
        discount = price * (discount_pct / 2)
    return price - discount
'''

    # Turn 1: Identify bugs — sonnet for the detailed analysis call
    print("→ Turn 1: Identifying bugs in the function...")
    r1 = client.messages.create(
        model=SONNET,
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": f"Review this Python function for syntax errors and logic bugs. Be concise.\n\n```python{buggy_code}```"
        }],
    )
    print(r1.content[0].text[:200] + "...")

    # Turn 2: Lint it with tool use
    print("\n→ Turn 2: Running linter via tool call...")
    r2 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[LINT_TOOL],
        messages=[
            {"role": "user", "content": f"Run the linter on this code and tell me the issues:\n```python{buggy_code}```"},
        ],
    )
    if r2.stop_reason == "tool_use":
        for block in r2.content:
            if block.type == "tool_use":
                print(f"   Tool called: {block.name}({list(block.input.keys())})")

    # Turn 3: Apply the fix with tool use
    print("\n→ Turn 3: Applying fix via tool call...")
    r3 = client.messages.create(
        model=HAIKU,
        max_tokens=400,
        tools=[APPLY_FIX_TOOL],
        messages=[{
            "role": "user",
            "content": "The linter found 2 issues: missing colon in if statement, missing colon after else. Apply the fix to services/pricing.py and open a PR titled 'Fix discount calculation syntax errors'."
        }],
    )
    if r3.stop_reason == "tool_use":
        for block in r3.content:
            if block.type == "tool_use":
                print(f"   Tool called: {block.name}({list(block.input.keys())})")

    # Turn 4: Streamed summary
    print("\n→ Turn 4: Generating review summary (streamed)...")
    with client.messages.stream(
        model=HAIKU,
        max_tokens=200,
        messages=[{"role": "user", "content": "Write a 2-sentence code review summary for a Slack message. Mention the file fixed and the bug type."}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
    print("\n")

    print(f"✓ Code Review Agent complete — 4 calls logged")
    return client.session_id


# ── Session 2: Customer Support Bot ──────────────────────────────────────────

def run_support_bot():
    banner("Session 2 — Customer Support Bot")
    client = ArgusClient(tracer_url=ARGUS_URL, session_label="Customer Support Bot")
    print(f"Session ID: {client.session_id}\n")

    conversation = [
        {
            "role": "user",
            "content": "Hi, I'm really frustrated. I placed order #ORD-48291 two weeks ago and it still hasn't arrived. My email is sarah@example.com. I need this resolved today."
        }
    ]

    # Turn 1: Understand and look up order
    print("→ Turn 1: Triaging support request and looking up order...")
    r1 = client.messages.create(
        model=HAIKU,
        max_tokens=350,
        tools=[LOOKUP_ORDER_TOOL],
        system="You are a helpful customer support agent. Always look up orders before responding. Be empathetic and efficient.",
        messages=conversation,
    )
    if r1.stop_reason == "tool_use":
        for block in r1.content:
            if block.type == "tool_use":
                print(f"   Tool called: {block.name}({block.input})")

    # Simulate tool result — what the database returned
    conversation.append({"role": "assistant", "content": r1.content})
    conversation.append({
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": next(b.id for b in r1.content if b.type == "tool_use"),
                "content": '{"order_id": "ORD-48291", "status": "delayed", "carrier": "FedEx", "tracking": "794644774000", "estimated_delivery": "2026-06-16", "delay_reason": "weather_disruption", "original_delivery": "2026-06-05"}'
            }
        ]
    })

    # Turn 2: Draft response to customer
    print("\n→ Turn 2: Drafting response with order context...")
    r2 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[LOOKUP_ORDER_TOOL],
        system="You are a helpful customer support agent. Always look up orders before responding. Be empathetic and efficient.",
        messages=conversation,
    )
    if r2.content and r2.content[0].type == "text":
        print(f"   Draft: {r2.content[0].text[:150]}...")

    # Turn 3: Close the ticket
    print("\n→ Turn 3: Closing ticket and issuing credit...")
    r3 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[UPDATE_TICKET_TOOL],
        messages=[{
            "role": "user",
            "content": "The customer accepted the apology. Close ticket TKT-9921 as resolved. Issue a $15 store credit for the inconvenience."
        }],
    )
    if r3.stop_reason == "tool_use":
        for block in r3.content:
            if block.type == "tool_use":
                print(f"   Tool called: {block.name}({block.input})")

    print(f"\n✓ Customer Support Bot complete — 3 calls logged")
    return client.session_id


# ── Session 3: SQL Assistant ──────────────────────────────────────────────────

def run_sql_assistant():
    banner("Session 3 — SQL Assistant")
    client = ArgusClient(tracer_url=ARGUS_URL, session_label="SQL Assistant")
    print(f"Session ID: {client.session_id}\n")

    # Turn 1: Convert NL to SQL
    print("→ Turn 1: Converting natural language to SQL...")
    r1 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[QUERY_DB_TOOL],
        system="You are a SQL assistant. Convert user questions into SQL queries and execute them. Schema: orders(id, customer_id, amount, status, created_at), customers(id, name, email, tier).",
        messages=[{
            "role": "user",
            "content": "Which premium customers spent more than $500 last month and haven't placed an order this month?"
        }],
    )
    if r1.stop_reason == "tool_use":
        for block in r1.content:
            if block.type == "tool_use":
                print(f"   Tool called: {block.name}")
                print(f"   SQL: {block.input.get('sql', '')[:100]}...")

    # Turn 2: Explain the results (streamed) — sonnet for the business narrative
    print("\n→ Turn 2: Explaining query results (streamed)...")
    with client.messages.stream(
        model=SONNET,
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": "The query returned 12 customers. Write a one-paragraph business insight from this, mentioning churn risk."
        }],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
    print("\n")

    # Turn 3: Follow-up query
    print("→ Turn 3: Running follow-up query...")
    r3 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[QUERY_DB_TOOL],
        messages=[{
            "role": "user",
            "content": "Now show me the total revenue at risk from those 12 customers based on their average monthly spend."
        }],
    )
    if r3.stop_reason == "tool_use":
        for block in r3.content:
            if block.type == "tool_use":
                print(f"   Tool called: {block.name}")
                print(f"   SQL: {block.input.get('sql', '')[:100]}...")

    print(f"\n✓ SQL Assistant complete — 3 calls logged")
    return client.session_id


# ── Session 4: Error session ──────────────────────────────────────────────────

def run_error_session():
    banner("Session 4 — Deployment Pipeline Agent (with error)")
    client = ArgusClient(tracer_url=ARGUS_URL, session_label="Deployment Pipeline Agent")
    print(f"Session ID: {client.session_id}\n")

    # Turn 1: Normal call
    print("→ Turn 1: Checking deployment readiness...")
    r1 = client.messages.create(
        model=HAIKU,
        max_tokens=150,
        messages=[{"role": "user", "content": "List 3 checks a deployment pipeline should run before pushing to production. One sentence each."}],
    )
    print(r1.content[0].text[:150] + "...")

    # Turn 2: Bad model name — this will fail and be logged as an error
    print("\n→ Turn 2: Triggering error (bad model name to test error tracking)...")
    try:
        client.messages.create(
            model="claude-haiku-99-does-not-exist",
            max_tokens=100,
            messages=[{"role": "user", "content": "Run post-deploy smoke tests."}],
        )
    except Exception as e:
        print(f"   Error logged: {type(e).__name__}")

    # Turn 3: Recovery call
    print("\n→ Turn 3: Recovery — retrying with correct model...")
    r3 = client.messages.create(
        model=HAIKU,
        max_tokens=150,
        messages=[{"role": "user", "content": "Deployment succeeded. Write a one-sentence Slack notification for the engineering channel."}],
    )
    print(r3.content[0].text)

    print(f"\n✓ Deployment Pipeline Agent complete — 3 calls logged (1 error)")
    return client.session_id


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    dashboard_base = "https://argus-dashboard-phi.vercel.app" if "railway.app" in ARGUS_URL else "http://localhost:3000"
    print("\nArgus Realistic Demo")
    print("Running 4 production-style agent sessions...\n")
    print(f"Keep the dashboard open at {dashboard_base}/dashboard")
    print("Watch sessions appear in real time as each one runs.\n")

    session_ids = []

    session_ids.append(run_code_review_agent())
    time.sleep(1)

    session_ids.append(run_support_bot())
    time.sleep(1)

    session_ids.append(run_sql_assistant())
    time.sleep(1)

    session_ids.append(run_error_session())

    base = ARGUS_URL.replace("https://backend-production-1b09.up.railway.app", "https://argus-dashboard-phi.vercel.app").replace("http://localhost:8000", "http://localhost:3000")
    print("\n" + "═" * 50)
    print("  All sessions complete. Open the dashboard:")
    print(f"  {base}/dashboard")
    print("═" * 50 + "\n")
    for sid in session_ids:
        print(f"  → {base}/dashboard/sessions/{sid}")
    print()


if __name__ == "__main__":
    main()
