---
description: Security review of AI/LLM features — prompt injection, agent tool authority, RAG poisoning, and unsafe model output handling.
argument-hint: "[AI feature, agent, or path] (optional)"
allowed-tools: Read, Grep, Glob
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
- **What credentials does the agent act with?** A shared service account, or a user OAuth token
  with broad scopes, means any hijack inherits all of it — scope credentials per user, per task,
  short-lived. (ASI03)
- Are tool arguments validated and constrained (schema, allowlist, range) before execution?
- **Private data + untrusted content + an outbound channel in one agent is the exfiltration
  triad**; injection turns it into a breach. Outbound includes markdown images, link unfurling in
  Slack/Teams, auto-fetched URLs, and any HTTP/email tool.
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
- Used as a URL the server fetches → SSRF. Validate the destination; block internal ranges and
  cloud metadata.
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
- **Persistent memory / context poisoning** (LLM04, ASI06): does the agent write to long-term
  memory, a shared knowledge base, or a vector store from untrusted content? One injected write
  then attacks every future session. Who can write to RAG ingestion and fine-tuning data?
- Embeddings of sensitive text (LLM08): are they exposed or shared? Embedding inversion can
  recover the source text.

## 5. Supply chain and integrity

- Where do models, adapters, and embeddings come from? Are downloaded weights pinned by hash?
- Model files in unsafe formats — pickle-based `.bin`/`.pt`/`.pkl` execute code on load; prefer
  safetensors, and `torch.load(..., weights_only=True)` (the default since PyTorch 2.6 — flag an
  explicit `weights_only=False`). Flag `trust_remote_code=True` in Hugging Face loaders: it runs
  arbitrary code from the model repo.
- MCP servers and third-party tool integrations: who wrote them, what do they have access to,
  and can a malicious tool description itself act as an injection vector against your agent?
  Tool descriptions can change after approval (rug pull) — are they pinned and reviewed per
  version? Does an MCP server pass the user's token through to downstream APIs (confused deputy)?
- Are third-party plugins/tools reviewed before being granted to the model?

## 6. Abuse, cost, and safety

- Rate limiting and per-user cost caps on model calls. Without them, an authenticated user can
  run your API bill up arbitrarily.
- Is the endpoint a free proxy to a paid model that anyone can call?
- Content safety: what happens if the model produces harmful output in your product's voice?
- Is model behavior tested against a set of known injection payloads in CI?

## 7. Multi-agent and reliance

- **Inter-agent messages** (ASI07): authenticated, and treated as untrusted input by the receiver?
  One agent's output must not grant another agent new tools.
- **Cascading failure** (ASI08): can one agent's bad output trigger irreversible actions in
  another without a check? Is fan-out capped?
- **Misinformation / overreliance** (LLM09): is model output presented as authoritative — legal,
  medical, financial, or code that is auto-merged — without verification?
- **Human-agent trust exploitation** (ASI09): can the model's persuasive output get a human to
  approve a harmful action? Are confirmations batched or phrased by the model?

## Report

Standard finding format. For each finding, state the injection vector, what the model can do
with it, and the **code-level** control that fixes it — not a prompt-level mitigation.

For `Class:`, use OWASP Top 10 for LLM Applications 2025 IDs (e.g. `LLM01:2025 Prompt Injection`,
`LLM05:2025 Improper Output Handling`, `LLM06:2025 Excessive Agency`) and, for agents, OWASP Top 10
for Agentic Applications 2026 IDs: ASI01 Agent Goal Hijack, ASI02 Tool Misuse, ASI03 Identity &
Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution, ASI06
Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures,
ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents.

Include the tool-authority table. Close with a blunt statement of the worst case: "if an
attacker fully controls the model's behavior, they can ______." That sentence is the real
security posture of an AI feature.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Injectable surface or over-powered tool → `/securitymaxxing:redteam` with injection payloads to prove the authority, then `/securitymaxxing:fix` — in code, never in the prompt.
- No injectable path with meaningful authority → say so; `/securitymaxxing:ship-check`.
