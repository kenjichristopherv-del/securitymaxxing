# securitymaxxing

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-informational.svg)](CHANGELOG.md)
[![OWASP Top 10:2025](https://img.shields.io/badge/OWASP-Top%2010%3A2025-black.svg)](https://owasp.org/Top10/2025/)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757.svg)](https://code.claude.com/docs/en/plugins)

**Is my app safe to put on the internet?** securitymaxxing is a Claude Code plugin that answers
that in plain English, then works through the fixes alongside you: one change at a time, and it
asks before each one.

It's built for people who made something with AI help and don't speak security, and it's just
as useful to engineers who want a rigorous, measured second pair of eyes.

---

## Start here: make your app safe, step by step

No security background needed. Plan on about 15–30 minutes. Nothing is changed without your
say-so.

### Step 1: Open your project in Claude Code

You need [Claude Code](https://code.claude.com) installed. In a terminal, go to your project
folder and start it:

```
cd path/to/your-app
claude
```

**Save a checkpoint first.** If your project uses git, commit your current work so any change can
be undone with one command:

```
git add -A
git commit -m "Before security fixes"
```

### Step 2: Install securitymaxxing

Type this into Claude Code:

```
/plugin install securitymaxxing --marketplace kenjichristopherv-del/securitymaxxing
```

### Step 3: Get a plain-English verdict (changes nothing)

```
/securitymaxxing:vibe-check
```

It reads your code and tells you, without jargon:

- 🚨 **Fix before anyone uses this.** What a stranger could do today, and how bad it would be.
- ⚠️ **Fix soon.**
- 💡 **Worth doing eventually.**
- ✅ **What's already fine.** So you know what *not* to touch.
- 🤔 **What it couldn't check.** Usually your hosting dashboard or database settings.

It ends with a straight answer: is it safe to put online right now? This step is read-only.
It won't edit a file.

<details>
<summary>What a finding looks like</summary>

> 🚨 **Anyone can read anyone's notes.**
> Your app checks that someone is logged in, but not that the note they asked for is *theirs*.
> Change the number in `/api/notes/101` to `102` and you get someone else's note, private
> details and all.
> **Where:** `server.js:47`
> **Fix:** look the note up by its ID *and* the logged-in user's ID, and say "not found" when it
> isn't theirs. (The corrected code follows.)

</details>

### Step 4: Fix it together

```
/securitymaxxing:help
```

`help` walks the whole way with you: it finds the real problems, shows that they're real on your
own machine, fixes them, and checks that the fix worked.

- **Before every change** it shows you what it wants to change, in plain words, and waits for your
  yes.
- **It never** commits, pushes, deletes your work, or touches anything live on the internet.
- Claude Code may ask permission to run a command, such as starting your app or running your
  tests. Read the command, and approve it if it looks like part of the job.

You can also tell it what you're worried about, for example
`/securitymaxxing:help people can see each other's orders`.

### Step 5: Do the things only you can do

Some fixes can't happen in code. `help` ends with a short list, for example:

- **Rotate a leaked key.** Make a new one in the provider's dashboard and delete the old one.
  Deleting it from your code isn't enough: if it was ever committed or shared, assume it's out.
- Change a setting in your hosting or database dashboard.

Don't skip this list. It's often the most important part.

### Step 6: Before you launch

```
/securitymaxxing:ship-check
```

This is a pre-launch gate. It checks ten blockers and gives a clear **SHIP / SHIP WITH
CONDITIONS / DO NOT SHIP** verdict.

If your app handles real money or real personal data, also run the thorough version once:

```
/securitymaxxing:audit --deep
```

It reads every route with several reviewers working in parallel, and double-checks every
finding. It costs about $5–6 per run on a mid-sized app, against well under $1 for the quick
checks. In our tests it found twice as much.

### Step 7: Stay safe as you keep building

- **Nothing to run for this.** While Claude writes code, a built-in check flags risky patterns
  (a missing ownership check, a hard-coded key) as they appear, before they ship.
- **Before you commit a big change**, run `/securitymaxxing:diff` to review just what changed.
- **Run `/securitymaxxing:vibe-check` again** whenever you add something important: payments,
  file uploads, an AI feature, a new kind of user.

If anything in a report doesn't make sense, ask: `/securitymaxxing:explain the first finding`.
Need something to show a co-founder, a client, or an investor? `/securitymaxxing:report` turns
the findings into a shareable report: a plain-English verdict and fix plan up front, with the
technical detail behind it.

**Rather have a person do it?** A [hands-on launch review](REVIEW.md) runs the deep review for
you, checks every finding by hand, and delivers the report. It starts at $249.

---

## For engineers: the find → prove → fix loop

```
/securitymaxxing:audit --deep       # 1. Find: every entry point reviewed, every finding verified
/securitymaxxing:redteam            # 2. Prove: working PoCs against your local or staging app
/securitymaxxing:fix                # 3. Fix: the class, not the instance, plus a regression test
/securitymaxxing:audit              # 4. Re-check: the ledger shows what's fixed or regressed
/securitymaxxing:diff               # 5. Every PR: catch the vulnerability as it's introduced
/securitymaxxing:ship-check         # 6. Launch gate
/securitymaxxing:report             # 7. The write-up for whoever needs it
```

Focused reviews when you know where to look: `authz` (the highest-yield one), `authn`,
`injection`, `secrets` (across full git history), `api`, `crypto`, `deps`, `harden`, `llm`, and
`threat-model`. Every finding has a traced source → sink, a `file:line`, an exploit path, and a
patch. Zero findings is a valid answer.

## Does it actually help? (measured)

Today's models are already decent security reviewers. What they aren't is **thorough** or
**consistent**: a single review of a real codebase reads part of it, a different part each time,
and reports whatever it happened to look at.

We measured this on a production FastAPI app (171 routes, a 16,000-line main module), against
53 weaknesses, each verified against the code by an independent verifier who didn't know which
run had raised it:

| | Plain Claude Code | `/securitymaxxing:audit --deep` |
|---|---|---|
| Real risk found, severity-weighted (mean of 3 runs) | 27% | **52%** |
| Worst run | 16% | **51%** |
| Real issues per run | 12 | **23** |
| Found every MEDIUM-severity issue | 1 run in 3 | **3 runs in 3** |
| False positives | 0 | 1 in ~68 findings |
| Cost per run (Sonnet 5.5) | ~$0.50 | ~$5.70 |

`--deep` gets there by changing the *process*, not the prompt: a mapper splits the app into
units that together contain every entry point, reviewers cover each unit exhaustively in
parallel, and a separate verifier tries to kill every finding and re-rates the survivors. The
method is in [`bench/`](bench/), so you can run the same comparison on your own code.

Honest footnote: the standard `/securitymaxxing:audit` (no `--deep`) was **not** better than
plain Claude at finding issues in this test. Its value is everything around the finding — the
same evidence rules, severity that doesn't cry wolf, guard rails, and the find → prove → fix
loop below.

What securitymaxxing adds either way:

- **Evidence, not vibes.** No finding without a traced path from an attacker-controlled source to
  a dangerous sink. Mitigations are checked first; severity is exploitability × impact; zero
  findings is a valid answer.
- **Guard rails.** Reviews are read-only, secrets are never printed, every read-only command is
  allowlisted to the exact subcommands it needs, and `redteam` asks before it attacks anything.
- **A loop, not a report.** `audit` → `redteam` proves it → `fix` closes it with a regression test
  → the next audit confirms it, tracked in a findings ledger.
- **Prevention at write time.** When Claude writes a route, a query, or auth code, a hook and the
  `secure-coding` skill supply the safe pattern before the bug exists.
- **Plain English when you want it.** `vibe-check` and `help` are written for people who build
  with AI and don't speak AppSec.

## Other ways to install

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

Type `/securitymaxxing:` in Claude Code to list them all.

| Command | What it does |
|---|---|
| `/securitymaxxing:vibe-check` | Plain-English safety check. No jargon, real rigor, a direct verdict, no changes |
| `/securitymaxxing:help` | Not sure where to start? A guided, plain-English pass that finds, proves, fixes, and re-checks — asking before every code change |
| `/securitymaxxing:ship-check` | Pre-launch gate. Ten blockers, then should-fixes, then a SHIP / DO NOT SHIP verdict |
| `/securitymaxxing:audit` | Full audit — maps the attack surface first, then works every vulnerability class with traced evidence. Add `--deep` for the multi-agent version that covers every entry point and verifies every finding (slower, ~10× the cost, about twice the recall) |
| `/securitymaxxing:diff` | Reviews a diff, branch, or PR. Catches the removed guard clause and the route registered on the wrong router |
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
| `/securitymaxxing:fix` | Fixes the class, verifies the patch, adds the regression test. Works from the findings ledger |
| `/securitymaxxing:report` | Turns the findings into a shareable report — verdict, what could happen, fix plan, then the detail — for a co-founder, client, or investor |
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

**Findings ledger.** `audit` keeps `.securitymaxxing/findings.json` (add it to `.gitignore`), so
the next audit reports what's new, still open, fixed, or **regressed**; `fix` and `redteam` work
from it, and record what they fixed and proved. Accepting a risk or marking a false positive stays
your call — set the `status` yourself and later runs respect it.

## Write-time check

A `PostToolUse` hook runs after Claude writes or edits source code. If the new code contains a
pattern that's commonly the start of a vulnerability — a route reading a resource ID with no
owner check in sight, SQL built from strings, a shell command, an HTML-escaping opt-out, an
unverified token decode, a server-side fetch of a request URL, an error path that may fail open,
or something shaped like a live credential — it hands Claude a one-line reminder of the safe
pattern. It never blocks, never edits, and stays silent otherwise. It's a POSIX `sh` script with
no dependencies; turn it off with `SECURITYMAXXING_HOOKS=off`.

If you also run Anthropic's `security-guidance` plugin, you'll get both sets of reminders; they
overlap on a few patterns and are complementary on the rest (this one focuses on ownership checks
and fail-open paths).

## The skills

Skills load automatically when Claude detects the relevant work — no command needed.

| Skill | Triggers on |
|---|---|
| **secure-coding** | Writing routes, queries, auth, uploads, shell calls, crypto, or anything taking a resource ID. Supplies the correct pattern *first*, so the bug never exists |
| **llm-app-security** | Building agents, tool calling, RAG, MCP servers, or any LLM feature |
| **security-review-method** | Any security review — the evidence discipline, severity rubric, and finding format the commands share |

`secure-coding` is the quiet one. It doesn't wait for an audit; it makes the ownership check part
of the query the first time the query gets written — and the write-time hook backs it up for the
times it doesn't load.

## Prompt catalog

**[PROMPTS.md](PROMPTS.md)** — 78 security prompts as raw, copy-pasteable text. Use them in
Cursor, Copilot, ChatGPT, or anywhere else; edit them for your stack; or read them to see
exactly what the commands are asking for.

Start with [Section 0, the preamble](PROMPTS.md#0-the-preamble): it carries the evidence rules
that every other prompt depends on, so paste it before any security prompt in any tool.

## Coverage

[OWASP Top 10:2025](https://owasp.org/Top10/2025/) — including the two new categories, A03
Software Supply Chain Failures and A10 Mishandling of Exceptional Conditions (fail-open error
handling) — the OWASP API Security Top 10 (2023), the OWASP Top 10 for LLM Applications (2025), and
the OWASP Top 10 for Agentic Applications (2026: goal hijack, tool misuse, memory poisoning,
inter-agent trust, MCP rug pulls), plus the things those lists don't cover well: business logic
and race conditions, CI/CD and supply chain, cloud IAM, cost-based denial of service, and incident readiness.

## What this is not

This is a very good first pass and a genuinely good teacher. It is **not** a penetration test.

The review commands read code — they don't fuzz your application or scan it from outside, so
they can't find what only appears under load or in your cloud console. `redteam` can send
targeted proof-of-concept requests to an instance you own, but that confirms specific findings;
it is not a penetration test. Findings are hypotheses until verified.

`redteam` is for systems you own or are explicitly authorized to test. It asks before sending
anything, defaults to local or staging, and stays non-destructive.

For anything holding real money or real personal data, this belongs *alongside* a human review, not instead of one.

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

## Benchmark

[`bench/`](bench/) runs plain Claude Code, `audit`, and `audit --deep` against any repository, each
isolated from your own settings and plugins, then scores the reports against a verified list of
issues:

```
python3 bench/run.py --target ~/code/app --arm plain --arm deep --runs 3 --out results/
python3 bench/score.py --truth truth.json --runs results/
```

Findings that match nothing in the truth file are listed separately — verify them before counting
them as either real or false. The truth file for the numbers above describes a private
application's weaknesses, so it isn't published.

## Contributing

New prompts, better prompts, and corrections are all welcome — especially real false positives
you hit, since those become anti-false-positive rules in `security-review-method`. Open an
issue with the code that got misreported and what the review should have said — and if you can,
add it as an eval case so it can never regress. Security problems in the plugin itself (for
example, a command that can be steered into an unintended action): see [SECURITY.md](SECURITY.md).

## License

Apache 2.0 — see [LICENSE](LICENSE).
