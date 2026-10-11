# Changelog

## 1.0.0 — 2026-10-11

First stable release. From here, command names, their arguments, and the finding format are
stable — a change to any of them is a major version. Every command, skill, and prompt was reviewed
line by line, the plugin now ships an eval suite, and this version was dogfooded with a full
`/audit` of a production FastAPI application (171 routes) before release.

### Fixed
- **`/authz` description was cut off.** An unquoted ` #` in its YAML frontmatter started a comment,
  so the listing ended at "…tenant isolation gaps. The".
- **Django apps were flagged DO NOT SHIP.** `ship-check`, `vibe-check`, `audit`, `authn`, `crypto`,
  the skills, and PROMPTS.md only accepted bcrypt/scrypt/argon2, so Django's default
  PBKDF2-SHA256 hasher read as a blocker. Password guidance now uses the OWASP minimums for all
  four (argon2id m≥19 MiB t≥2, scrypt N≥2^17, bcrypt cost ≥10 with its 72-byte limit,
  PBKDF2-HMAC-SHA256 ≥600k) and doesn't flag framework defaults.
- **`/secrets` printed the secrets it found.** Its history search used `git log -p`, which dumps
  whole patches into the transcript. History is now searched with `-S`/`-G` and pathspecs, values
  are redacted, and PKCS#8 `BEGIN PRIVATE KEY` is matched. A Twilio Account SID is no longer
  treated as a secret.
- **The docs contradicted `/redteam`.** `security-review-method` said "never run exploits against a
  live system", and the README said the plugin never tests live. Both now scope active testing to
  `redteam`, on systems you own, after confirming the target.
- **`SameSite=Lax` by default was treated as a CSRF mitigation.** It's Chromium-only, with a
  2-minute POST exception.
- Wrong or outdated security guidance:
  - `LIMIT` can be parameterized.
  - A bare `startswith` path-containment check is itself a bug.
  - Angular `[innerHTML]` is sanitized.
  - `bleach` is deprecated.
  - PKCS#1 v1.5 *signatures* (JWT RS256) are fine; v1.5 *encryption* is not.
  - PyJWT 2 syntax.
  - `git diff <ref>` reversed branch diffs.
  - `pip-audit` audited the environment, not the project.
  - Yarn Berry audit syntax.
  - The CORS regex examples.
  - `/redteam` could request cloud-metadata credentials, or put a secret on a command line.

### Security
- **Least-privilege `allowed-tools` on every read-only command.** These patterns were removed:
  - `Bash(git:*)`, which allowed `push` and `reset --hard`;
  - `Bash(gh pr:*)`, which allowed `merge` and `checkout`;
  - `Bash(uv:*)`, which allowed `uv run`;
  - `Bash(find:*)`, which allowed `-exec` and `-delete`;
  - `Bash(rg:*)`, where `--pre` runs programs.

  Each command is now allowlisted to the read-only subcommands it actually uses.
- `fix`, `redteam` and `help` are told never to commit, push, rewrite history or rotate
  credentials. `redteam` never modifies application source.
- SECURITY.md documents the prompt-injection risk of running write-capable commands on untrusted
  repositories.

### Added
- **`/securitymaxxing:help`**: a guided, plain-English pass that finds, proves, fixes and
  re-checks. It asks before every code change.
- **OWASP Top 10:2025 coverage**:
  - A10 Mishandling of Exceptional Conditions: fail-open checks across audit, authz, authn, api
    and the skills.
  - A09 logging and alerting.
  - A03 supply chain, including slopsquatting.
  - Findings now cite `A01:2025`-style IDs.
- **LLM and agent coverage**:
  - The OWASP LLM Top 10 2025 and the Agentic Top 10 2026 (ASI01–ASI10) are mapped in `/llm` and
    `llm-app-security`.
  - Agent memory poisoning, inter-agent trust and cascading failures.
  - MCP rug pulls, tool shadowing and token audience.
  - `trust_remote_code` and `weights_only`.
- **New checks**:
  - Next.js middleware bypass, path/verb confusion and RLS `BYPASSRLS`.
  - Prototype pollution, XXE, open redirect and CSRF in the full audit.
  - DNS-rebinding-safe SSRF guidance.
  - GitHub Actions expression injection and SHA pinning.
  - Supabase RLS and Firebase rules in `vibe-check`.
  - CISA KEV in `deps`.
- PROMPTS.md: 2.7 Fail-open on errors, 10.7 Agent memory & multi-agent trust, 10.8 MCP servers
  (78 prompts).
- **`evals/`**: a `claude plugin eval` suite — IDOR and fail-open recall, false-positive precision on a
  clean app, secret redaction and rotation, and secure-coding skill behaviour.
- Every `→ Recommended next` line now has a clean-result branch.

### Changed
- `secure-coding` now leads its description with when to load it, plus explicit trigger words. In
  evals it went from never loading on a "write a GET /invoices/:id route" request (0/3) to loading
  every time (3/3).

## 0.2.1 — 2026-08-12
- Every command closes with a guided `→ Recommended next:` step.

## 0.2.0 — 2026-08-12
- Added `/securitymaxxing:redteam`: prove findings with working PoCs against your own app.

## 0.1.0 — 2026-08-12
- Initial release: 16 commands, 3 skills, and the PROMPTS.md catalog.
