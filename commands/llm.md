---
description: Security review of AI/LLM features — prompt injection, agent tool authority, RAG poisoning, and unsafe model output handling.
argument-hint: "[AI feature, agent, or path] (optional)"
allowed-tools: Read, Grep, Glob, Bash(rg:*), Bash(find:*), Bash(git ls-files:*)
---

# LLM and AI feature security review

AI features fail differently. Follow `security-review-method` for evidence discipline, and the
`llm-app-security` skill for the underlying model. **Read-only.**

Scope: $ARGUMENTS

Start by locating every LLM call site, agent loop, tool/function definition, RAG retrieval
path, and model provider SDK usage.

## The core principle

**Everything the model outputs is untrusted.** Not because the model is malicious, but because
anything in its context — a retrieved document, a web page, a file, a previous message, a tool
result, an email — can instruct it. A prompt boundary is not a security boundary. If your
design depends on the model "not being tricked", it has no security control.

Therefore: **security must be enforced outside the model**, in the code that decides what a
tool call is allowed to do.

## 1. Prompt injection surface

Enumerate every untrusted string that reaches the model's context:

- Direct user input
- Retrieved documents (RAG), including anything a user uploaded or that another tenant wrote
- Web pages, PDFs, or files fetched at runtime
- Tool/function results, including API responses from third parties
- Prior conversation history, especially in a shared or multi-user thread
- Email, ticket, chat, and issue content in integrations
- File names, image metadata, and OCR/vision inputs (instructions can be embedded in an image)

For each, ask: **what can the model do once it believes that text?** That is the real question.
The severity of prompt injection is entirely determined by the model's authority.

Check for **indirect injection specifically**: content the *attacker* controls but the *victim*
retrieves. A poisoned document in a shared knowledge base attacks every user who queries it.

## 2. Tool and agent authority — the actual attack surface

For every tool/function exposed to the model:

| Tool | What it can do | Who authorized it | Reversible? | Blast radius if the model is fully controlled |
|---|---|---|---|---|

Then check:

- **Does the tool re-check authorization server-side, using the *session's* identity — not an
  ID the model supplied?** If the model passes `user_id` and the tool trusts it, injection
  becomes account takeover. The user's identity must come from the session, never from the
  model's arguments.
- Are tool arguments validated and constrained (schema, allowlist, range) before execution?
- Is there a tool that reads private data **and** a tool that can send data outward? That
  combination is an exfiltration channel; injection turns it into a data breach. The classic
  form is rendering a markdown image whose URL contains the stolen data.
- Can the model trigger irreversible or costly actions — delete, transfer funds, send email,
  post publicly, spend API credits, run code, execute a shell command, write to a repo?
  Which require a human confirmation, and is that confirmation showing the human enough to
  actually judge it?
- Is there a loop/step/cost budget? Unbounded agent loops are a cost-DoS and a runaway-action risk.
- If the agent executes code or shell commands: is it sandboxed, network-isolated, and
  resource-limited? Assume the model will run whatever an injected document tells it to.

## 3. Output handling

Model output is untrusted data — treat it exactly like a request body:

- Rendered as HTML/markdown → XSS. Is it sanitized? Are `javascript:`/`data:` URLs and remote
  image loads (exfiltration) blocked?
- Used to build SQL, shell commands, file paths, or URLs → injection. Parameterize.
- `eval`'d, or written to a file that later executes → RCE.
- Used as an **authorization decision** ("the model said this user is an admin") → broken by design.
- Parsed as JSON without schema validation → downstream type confusion.
- Returned to another system that trusts it.

## 4. Data exposure through the model

- What ends up in the prompt that shouldn't leave your infrastructure? PII, secrets, other
  tenants' data, internal system details.
- **RAG tenant isolation**: is the vector search filtered by tenant/user *at query time*, in
  the store, or filtered afterward in application code? Post-filtering means the wrong data was
  already retrieved, and a single missed filter leaks across tenants. Check that embeddings and
  the index itself are partitioned.
- Does the system prompt contain anything genuinely sensitive? Assume it will be extracted —
  it is not a secret store. (Prompt extraction is LOW severity by itself; what matters is what
  the prompt reveals about internal systems.)
- Provider data handling: does the vendor train on your data? Is there a zero-retention or
  enterprise agreement? Is that consistent with what your privacy policy tells users?
- Are prompts and completions logged, and do those logs contain user PII or credentials?

## 5. Supply chain and integrity

- Where do models, adapters, and embeddings come from? Are downloaded weights pinned by hash?
- Model files in unsafe formats — a pickle-based `.bin`/`.pt` executes code on load; prefer safetensors.
- MCP servers and third-party tool integrations: who wrote them, what do they have access to,
  and can a malicious tool description itself act as an injection vector against your agent?
- Are third-party plugins/tools reviewed before being granted to the model?

## 6. Abuse, cost, and safety

- Rate limiting and per-user cost caps on model calls. Without them, an authenticated user can
  run your API bill up arbitrarily.
- Is the endpoint a free proxy to a paid model that anyone can call?
- Content safety: what happens if the model produces harmful output in your product's voice?
- Is model behavior tested against a set of known injection payloads in CI?

## Report

Standard finding format. For each finding, state the injection vector, what the model can do
with it, and the **code-level** control that fixes it — not a prompt-level mitigation.

Include the tool-authority table. Close with a blunt statement of the worst case: "if an
attacker fully controls the model's behavior, they can ______." That sentence is the real
security posture of an AI feature.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Injectable surface or over-powered tool → `/securitymaxxing:redteam` with injection payloads to prove the authority, then `/securitymaxxing:fix` — in code, never in the prompt.
