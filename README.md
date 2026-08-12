# securitymaxxing

**Application security for Claude Code.** Audit commands that prove their findings, plus skills
that make Claude write secure code before you ask.

Built for two people: the engineer who knows what an IDOR is and wants a rigorous second pair
of eyes, and the builder who shipped something with AI help and needs a straight answer to
"is this safe to put on the internet?"

---

## Why this exists

Ask any AI to "check my code for security issues" and you get a page of confident, plausible,
mostly-wrong findings. Missing headers on a JSON API. SQL injection in a parameterized query.
A CVE number that doesn't exist. You read it twice, find nothing real, and never run it again —
so the one endpoint that *does* leak your customers' addresses ships anyway.

The problem isn't the model. It's the prompt.

securitymaxxing encodes the discipline a real security engineer applies:

- **No finding without a traced path** from an attacker-controlled source to a dangerous sink.
  Both ends named, or it's flagged "needs verification" instead of reported as fact.
- **Check the mitigation first.** Most "SQL injection in an ORM" findings die once you read
  what the framework actually does in that version.
- **Severity by realistic exploitability × impact**, not by how frightening the bug class sounds.
- **Zero findings is a valid result.** No padding a report to look thorough.
- **Every finding carries the exploit path and the patch** — the requests an attacker sends,
  and the corrected code.

## Install

```
/plugin marketplace add kenjichristopherv-del/securitymaxxing
/plugin install securitymaxxing
```

Or, for local development:

```
/plugin marketplace add ~/Developer/securitymaxxing
/plugin install securitymaxxing
```

## The commands

Type `/sec` in Claude Code and they'll all filter into view.

| Command | What it does |
|---|---|
| `/securitymaxxing:audit` | Full audit — maps the attack surface first, then works every vulnerability class with traced evidence |
| `/securitymaxxing:diff` | Reviews a diff, branch, or PR. Catches the removed guard clause and the route registered on the wrong router |
| `/securitymaxxing:vibe-check` | Plain-English safety check. No jargon, real rigor, direct verdict |
| `/securitymaxxing:ship-check` | Pre-launch gate. Ten blockers, then should-fixes, then a SHIP / DO NOT SHIP verdict |
| `/securitymaxxing:threat-model` | STRIDE model with a Mermaid data-flow diagram and trust boundaries |
| `/securitymaxxing:authz` | Broken access control — IDOR, mass assignment, tenant isolation. The highest-yield review |
| `/securitymaxxing:authn` | Auth, sessions, JWTs, password reset, OAuth account-linking takeover |
| `/securitymaxxing:injection` | Source-to-sink tracing: SQL, command, XSS, SSRF, path traversal, deserialization, SSTI |
| `/securitymaxxing:secrets` | Sweeps the working tree **and git history**. Outputs a rotation list, not a cleanup list |
| `/securitymaxxing:api` | CORS, CSRF, headers, rate limits, over-fetching, GraphQL, file uploads |
| `/securitymaxxing:crypto` | Algorithms, IV reuse, key management, TLS verification, what shouldn't be stored at all |
| `/securitymaxxing:deps` | Runs the real auditor, then **triages** — which of the 140 alerts are actually reachable |
| `/securitymaxxing:harden` | Docker, Kubernetes, Terraform, cloud IAM, and detection readiness |
| `/securitymaxxing:llm` | Prompt injection, tool authority, RAG tenant isolation, unsafe model output |
| `/securitymaxxing:redteam` | Proves it. Builds a working PoC against your own app, and attacks your defenses to confirm they hold |
| `/securitymaxxing:fix` | The only command that writes code. Fixes the class, verifies the patch, adds the regression test |
| `/securitymaxxing:explain` | Explains a vulnerability against *your* code, so you can spot it yourself next time |

Every command is read-only except `fix` (which writes patches) and `redteam` (which sends
active attacks against an app you own).

## The skills

Skills load automatically when Claude detects the relevant work — no command needed.

| Skill | Triggers on |
|---|---|
| **secure-coding** | Writing routes, queries, auth, uploads, shell calls, crypto, or anything taking a resource ID. Supplies the correct pattern *first*, so the bug never exists |
| **llm-app-security** | Building agents, tool calling, RAG, MCP servers, or any LLM feature |
| **security-review-method** | Any security review — the evidence discipline, severity rubric, and finding format the commands share |

`secure-coding` is the quiet one that matters most. It doesn't wait for an audit; it makes the
ownership check part of the query the first time the query gets written.

## Try it

```
/securitymaxxing:vibe-check          # start here if you're not sure what you have
/securitymaxxing:authz src/api       # start here if you are
/securitymaxxing:diff                # before every commit that touches a route
```

A good workflow: `authz` and `injection` on the code you actually shipped, `secrets` once
against full history, `redteam` to prove the findings are real, `diff` on every PR,
`ship-check` before launch.

**Find → prove → fix.** The commands come as a loop: a review command surfaces a hypothesis,
`redteam` builds a working proof-of-concept against your own app (and attacks your existing
defenses to confirm they hold), and `fix` closes it with a regression test that keeps the PoC
from ever coming back. A finding you've watched get exploited and then blocked is a finding you
can trust.

## Prompt catalog

**[PROMPTS.md](PROMPTS.md)** — 75+ security prompts as raw, copy-pasteable text. Use them in
Cursor, Copilot, ChatGPT, or anywhere else; edit them for your stack; or read them to see
exactly what the commands are asking for.

Start with [Section 0, the preamble](PROMPTS.md#0-the-preamble). It's the highest-leverage
paragraph in the repo — paste it before any security prompt in any tool and the output quality
changes immediately.

## Coverage

OWASP Top 10 (2021), OWASP API Security Top 10 (2023), and OWASP Top 10 for LLM Applications,
plus the things those lists don't cover well: business logic and race conditions, CI/CD and
supply chain, cloud IAM, cost-based denial of service, and incident readiness.

## What this is not

This is a very good first pass and a genuinely good teacher. It is **not** a penetration test.

It reads code — it doesn't run your application, fuzz it, or test it live, so it can't find
what only appears at runtime, under load, or in your cloud console. Findings are hypotheses
until you verify them. For anything holding real money or real personal data, this belongs
*alongside* a human review, not instead of one.

## Contributing

New prompts, better prompts, and corrections are all welcome — especially real false positives
you hit, since those become anti-false-positive rules in `security-review-method`. Open an
issue with the code that got misreported and what the review should have said.

## License

Apache 2.0 — see [LICENSE](LICENSE).
