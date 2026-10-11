# securitymaxxing

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.2-informational.svg)](CHANGELOG.md)
[![OWASP Top 10:2025](https://img.shields.io/badge/OWASP-Top%2010%3A2025-black.svg)](https://owasp.org/Top10/2025/)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757.svg)](https://code.claude.com/docs/en/plugins)

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
/plugin install securitymaxxing --marketplace kenjichristopherv-del/securitymaxxing
```

On Claude Code older than 2.1.275, add the marketplace first:

```
/plugin marketplace add kenjichristopherv-del/securitymaxxing
/plugin install securitymaxxing@securitymaxxing
```

Or, from a local clone:

```
git clone https://github.com/kenjichristopherv-del/securitymaxxing
/plugin marketplace add ./securitymaxxing
/plugin install securitymaxxing@securitymaxxing
```

What changed between versions: [CHANGELOG.md](CHANGELOG.md).

## The commands

Type `/securitymaxxing:` in Claude Code to list them all. Not sure where to start? `/securitymaxxing:help`.

| Command | What it does |
|---|---|
| `/securitymaxxing:help` | Not sure where to start? A guided, plain-English pass that finds, proves, fixes, and re-checks — asking before every code change |
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

Every command is read-only except `fix` and `help` (which write patches, and `help` asks first),
`redteam` (which sends proof-of-concept requests to an app you own and writes PoC scripts), and
`threat-model` (which can save the model to a file, if you say yes).

**Least privilege, by construction.** The read-only commands can't run arbitrary shell commands:
each one is allowlisted to the exact read-only subcommands it needs (`git log`, `git ls-files`,
`npm audit`, …), so a review can't push, reset, or "helpfully" run `audit fix`. Only `fix`,
`help`, and `redteam` get a general shell — they need it to run your tests and your app — and
each is told in writing never to commit, push, rewrite history, or rotate a credential for you.

Every report ends with one `→ Recommended next:` line, picked from what was actually found, so
you're never left holding findings with no path forward.

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
/securitymaxxing:help                # start here if you just want it made safe
/securitymaxxing:vibe-check          # a plain-English verdict, no changes made
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

**[PROMPTS.md](PROMPTS.md)** — 78 security prompts as raw, copy-pasteable text. Use them in
Cursor, Copilot, ChatGPT, or anywhere else; edit them for your stack; or read them to see
exactly what the commands are asking for.

Start with [Section 0, the preamble](PROMPTS.md#0-the-preamble). It's the highest-leverage
paragraph in the repo — paste it before any security prompt in any tool and the output quality
changes immediately.

## Coverage

[OWASP Top 10:2025](https://owasp.org/Top10/2025/) — including the two new categories, A03
Software Supply Chain Failures and A10 Mishandling of Exceptional Conditions (fail-open error
handling) — the OWASP API Security Top 10 (2023), the OWASP Top 10 for LLM Applications (2025), and
the OWASP Top 10 for Agentic Applications (2026: goal hijack, tool misuse, memory poisoning,
inter-agent trust, MCP rug pulls), plus the things those lists don't cover well: business logic and race conditions, CI/CD and
supply chain, cloud IAM, cost-based denial of service, and incident readiness.

## What this is not

This is a very good first pass and a genuinely good teacher. It is **not** a penetration test.

The review commands read code — they don't fuzz your application or scan it from outside, so
they can't find what only appears under load or in your cloud console. `redteam` can send
targeted proof-of-concept requests to an instance you own, but that confirms specific findings;
it is not a penetration test. Findings are hypotheses until verified.

`redteam` is for systems you own or are explicitly authorized to test. It asks before sending
anything, defaults to local or staging, and stays non-destructive. For anything holding real money or real personal data, this belongs
*alongside* a human review, not instead of one.

## Evals

`evals/` is a [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) suite. Its job
is regression-guarding: a prompt change that loses a finding, invents one, edits code during a
review, or prints a secret fails the suite.

| Case | Checks |
|---|---|
| `authz-finds-idor` | `/authz` finds a planted IDOR and a role mass-assignment, with location, fix, and sane severity — and edits nothing |
| `authz-fail-open` | `/authz` catches guards that fail open: `if (user && !user.isAdmin)` letting an *invalid* token through, and a policy check that allows on error (OWASP A10:2025) |
| `clean-app-no-false-positives` | `/audit` on a deliberately clean API reports nothing HIGH or CRITICAL, doesn't call PBKDF2-600k weak, and doesn't inflate missing headers on a JSON API |
| `secrets-rotate-and-redact` | `/secrets` on a repo with committed credentials finds both, requires rotation, never prints the values or dumps patches, and ignores placeholder `.env.example` entries |
| `secure-coding-ownership-check` | Asked to write an ID-taking route, Claude loads `secure-coding` and writes the ownership check the first time |

```
claude plugin eval . --scaffold --threshold 0.8 \
  --allow-tools Write 'Bash(git log:*)' 'Bash(git ls-files:*)' 'Bash(git show:*)'
```

`--scaffold` copies each case's fixture into the run's sandbox (and, for the secrets case, commits
it to a throwaway git repo). The scripts are a few lines in `evals/*/scaffold.sh` — read them
before you pass the flag.

## Contributing

New prompts, better prompts, and corrections are all welcome — especially real false positives
you hit, since those become anti-false-positive rules in `security-review-method`. Open an
issue with the code that got misreported and what the review should have said — and if you can,
add it as an eval case so it can never regress. Security problems in the plugin itself (for
example, a command that can be steered into an unintended action): see [SECURITY.md](SECURITY.md).

## License

Apache 2.0 — see [LICENSE](LICENSE).
