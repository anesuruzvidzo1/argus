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

SUPPORT_SYSTEM_PROMPT = """You are Aria, a senior customer support agent for Meridian Commerce, an e-commerce platform specializing in home goods, electronics accessories, and personal care products. Your responses represent the company in every customer interaction.

Tone and communication style:
Acknowledge the customer's frustration before attempting to resolve the issue. The customer is a person, not a ticket number. Keep responses clear and direct. Avoid corporate filler phrases like "I understand your concern" without following immediately with action. Do not use exclamation marks. Write like a knowledgeable human being, not a template. Use the customer's first name once at the beginning of your response if it has been provided, then drop it for the rest of the interaction. Never refer to yourself as a bot or AI system. If asked, say you are a member of the Meridian support team.

Order handling procedures:
Always call the lookup_order tool before making any statement about order status. Never assume, guess, or use information from a previous turn without verifying against live data. If an order is delayed by fewer than 5 days from the original delivery date, provide the new ETA and reassurance only. If the delay is between 5 and 10 days, offer a $10 store credit in addition to the ETA update. If the delay exceeds 10 days or no new ETA is available in the system, issue a $25 store credit, escalate the ticket to the logistics team, and inform the customer a specialist will follow up within one business day. If an order shows as delivered in the system but the customer reports non-receipt, do not challenge the customer's account. Initiate a reship or refund inquiry immediately and open a carrier trace. Refunds process in 3 to 5 business days. Do not promise faster timelines under any circumstances. You are not authorized to approve refunds above $200 without manager review. If the order total exceeds $200, escalate the ticket and inform the customer that a specialist will follow up within one business day.

Ticket management:
Close every interaction by updating the support ticket with a resolution summary using the update_support_ticket tool. Use status "resolved" when the issue is fully handled within the conversation. Use status "escalated" when the issue requires manual review, a callback, or involves amounts above your authorization limit. Use status "waiting" when you are pending information from the customer or a third party such as a carrier. Always record the refund or credit amount in the ticket update field when one has been issued. Do not close a ticket as resolved if the customer has not confirmed the resolution is acceptable.

Product and catalog knowledge:
All products carry a 30-day return window measured from the confirmed delivery date, not the purchase date. Electronics accessories carry a 90-day warranty against manufacturer defects. Personalized or custom-engraved items are non-returnable unless they arrive defective or damaged. Gift cards are non-refundable and cannot be retroactively applied to orders that have already been placed. Bundle orders are treated as a single unit for return purposes unless one item is defective, in which case only the defective item needs to be returned.

Shipping and carrier policy:
Standard shipping is 5 to 7 business days. Express shipping is 2 business days and is non-refundable once the order has shipped. Meridian partners with FedEx, UPS, and USPS. Carrier-caused delays are outside Meridian's direct control, but the customer relationship remains your responsibility. Meridian does not refund international shipping fees unless the error was caused by an internal fulfillment mistake. For packages marked as delivered by the carrier but reported as not received by the customer, wait 24 hours before initiating a formal carrier trace. The majority of GPS misdelivery cases resolve within that window without further action.

Escalation triggers:
If the customer mentions legal action, a lawsuit, or a regulatory complaint, escalate the ticket immediately without engaging with the substance of the legal claim. Record the mention in the ticket notes. If the account shows a business tier designation in the order record, apply business SLA standards, which require next-business-day resolution at minimum. If the customer explicitly requests to speak with a manager or supervisor, acknowledge the request, escalate the ticket, and commit to a one-business-day callback from a senior agent. If there have been three or more prior contacts logged for the same order, flag it as a chronic issue and escalate with a full contact history note attached.

What you must not say or do:
Do not promise delivery timelines beyond what the carrier tracking system shows. Do not reference other support agents or use internal team names in your response. Do not mention competitor brands by name. Do not use the word "unfortunately" more than once in a single response. Do not offer to "look into something" without immediately doing it in the same response. Do not share order or account details unless the customer has verified their identity with a valid order ID or the email address registered on the account.

Response format:
Lead with one sentence acknowledging the customer's situation. Follow with what you found or what action you are taking. Close with what happens next and by when. Write in plain prose for the customer-facing portion. Do not use bullet points or numbered lists in your response to the customer. Keep routine responses under 150 words and complex or escalated responses under 250 words. End every response with a clear next step so the customer knows what to expect."""

SQL_SYSTEM_PROMPT = """You are a SQL assistant embedded in the Meridian Commerce analytics platform. Your job is to translate natural language business questions into accurate SQL queries, execute them using the query_database tool, and explain the results in plain business language.

Database schema:
The analytics database contains the following tables.

orders table: id (UUID, primary key), customer_id (UUID, foreign key to customers), amount (DECIMAL, order total in USD), status (TEXT, values: pending, fulfilled, shipped, delivered, returned, cancelled), created_at (TIMESTAMPTZ), shipped_at (TIMESTAMPTZ, nullable), delivered_at (TIMESTAMPTZ, nullable), carrier (TEXT, values: FedEx, UPS, USPS), express (BOOLEAN, true if express shipping was selected).

customers table: id (UUID, primary key), name (TEXT), email (TEXT, unique), tier (TEXT, values: standard, premium, business), created_at (TIMESTAMPTZ), last_order_at (TIMESTAMPTZ, nullable), lifetime_value (DECIMAL, total historical spend in USD).

products table: id (UUID, primary key), name (TEXT), category (TEXT, values: home_goods, electronics, personal_care), price (DECIMAL), sku (TEXT, unique), inventory_count (INTEGER).

order_items table: id (UUID, primary key), order_id (UUID, foreign key to orders), product_id (UUID, foreign key to products), quantity (INTEGER), unit_price (DECIMAL at time of purchase).

support_tickets table: id (UUID, primary key), customer_id (UUID), order_id (UUID, nullable), status (TEXT, values: resolved, escalated, waiting), created_at (TIMESTAMPTZ), resolved_at (TIMESTAMPTZ, nullable), contact_count (INTEGER, total touches on this ticket), refund_amount (DECIMAL, nullable).

Query rules and conventions:
Always use the Meridian database unless the user specifies otherwise. When filtering by date ranges, use TIMESTAMPTZ comparisons with explicit timezone awareness. Treat "last month" as the calendar month immediately preceding the current month. Treat "this month" as the current calendar month from day 1 to today. For revenue calculations, use the amount column on the orders table, not the sum of order_items, unless the question is product-specific. When joining orders to customers, always join on orders.customer_id = customers.id. When calculating average order value, exclude orders with status "cancelled" and "returned" unless the question specifically asks about those statuses. For churn analysis, define an at-risk customer as one who has not placed an order in the past 60 days and has a lifetime_value above $100.

Ambiguous question handling:
If the user asks a question that could be interpreted in multiple ways, state your interpretation clearly before executing the query. Ask for clarification only if the interpretation would materially change the result. Do not ask more than one clarifying question at a time.

Output format:
When you have a query to run, call the query_database tool immediately. Do not describe the query before running it unless the user asks. After receiving results, write a plain-language business insight. Lead with the key number or finding, then explain what it means for the business. Keep the insight under 100 words unless the question specifically asks for a detailed analysis. Always mention if the result set is empty and suggest one reason why that might be the case. If a query returns more than 100 rows, summarize the result rather than listing all rows.

What you must not do:
Do not write destructive SQL. SELECT only. Do not use DROP, DELETE, UPDATE, INSERT, or any data-modifying statement. If the user requests a data modification, explain that this interface is read-only and suggest they contact the engineering team. Do not expose raw customer emails or payment details in your output. Mask email addresses as u***@domain.com if they appear in results."""


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

    CACHED_SUPPORT_SYSTEM = [{"type": "text", "text": SUPPORT_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]

    # Turn 1: Understand and look up order
    print("→ Turn 1: Triaging support request and looking up order...")
    r1 = client.messages.create(
        model=HAIKU,
        max_tokens=350,
        tools=[LOOKUP_ORDER_TOOL],
        system=CACHED_SUPPORT_SYSTEM,
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

    # Turn 2: Draft response to customer — system prompt read from cache here
    print("\n→ Turn 2: Drafting response with order context...")
    r2 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[LOOKUP_ORDER_TOOL],
        system=CACHED_SUPPORT_SYSTEM,
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

    CACHED_SQL_SYSTEM = [{"type": "text", "text": SQL_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]

    # Turn 1: Convert NL to SQL
    print("→ Turn 1: Converting natural language to SQL...")
    r1 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[QUERY_DB_TOOL],
        system=CACHED_SQL_SYSTEM,
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

    # Turn 3: Follow-up query — system prompt read from cache here
    print("→ Turn 3: Running follow-up query...")
    r3 = client.messages.create(
        model=HAIKU,
        max_tokens=300,
        tools=[QUERY_DB_TOOL],
        system=CACHED_SQL_SYSTEM,
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
