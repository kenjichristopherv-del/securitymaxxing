---
description: Trace untrusted input to dangerous sinks — SQL, command, XSS, SSRF, path traversal, deserialization, template injection.
argument-hint: "[path or sink type] (optional)"
allowed-tools: Read, Grep, Glob, Bash(rg:*), Bash(find:*), Bash(git ls-files:*)
---

# Injection and untrusted input review

Every injection bug is the same bug: data crossed into a place where it was interpreted as
instructions. Find the crossings. Follow `security-review-method` — a sink alone is not a
finding, you need the traced path from a source. **Read-only.**

Scope: $ARGUMENTS

## Step 1 — Inventory the sources

List where untrusted data enters. Be generous about what counts as untrusted:

- Request path, query, body, headers, cookies, `Host`, `X-Forwarded-*`, `User-Agent`, `Referer`
- Uploaded file contents **and filenames** (filenames are attacker-controlled strings)
- Webhook payloads, message queue messages, imported CSV/JSON/XML
- Third-party API responses (a compromised or malicious partner is a real source)
- **Database rows written by another user** — this is how stored XSS and second-order SQL
  injection happen, and it's the source people forget
- LLM output, when it derives from any of the above
- Environment and config in a multi-tenant or user-configurable runtime

## Step 2 — Inventory the sinks, then trace backwards

For each sink family below, grep the codebase, then for each hit walk backwards until you
reach either a source (finding) or a constant/validated value (not a finding).

**SQL / NoSQL**
- String concatenation or f-strings/template literals building queries
- `raw`, `rawQuery`, `execute`, `query`, `literal`, `Sequelize.literal`, `knex.raw`,
  `session.execute(text(...))`, `$queryRawUnsafe`
- Dynamic identifiers: table names, column names, `ORDER BY`, `LIMIT` — these **cannot** be
  parameterized, so they must be validated against an allowlist. This is the injection that
  survives in codebases that "use an ORM everywhere".
- Mongo: user-controlled objects reaching `find()` enabling `$ne`/`$gt`/`$where` operator
  injection; `$where` with a string
- ORM `where` clauses fed a whole request body

**Command execution**
- `exec`, `execSync`, `spawn` with `shell: true`, `child_process`, `os.system`, `popen`,
  `subprocess` with `shell=True`, backticks, `Runtime.exec` with a string, `eval` of shell
- Argument injection even without a shell: a filename beginning with `-` becomes a flag.
  Check any `spawn(cmd, [userInput])` where the tool has dangerous flags (`git`, `ffmpeg`,
  `curl`, `tar`, `rsync`)

**Path traversal / file access**
- `path.join`, `open()`, `readFile`, `sendFile`, `res.download`, `os.path.join`, zip/tar
  extraction (Zip Slip — entry names are attacker-controlled paths)
- Check for containment *after* resolution: `realpath(target).startswith(realpath(base))`.
  Blocking `../` textually is not containment — URL encoding, unicode, and absolute paths
  bypass it.

**SSRF**
- Any HTTP client called with a URL that came from a request: `fetch`, `axios`, `requests`,
  `curl`, `http.get`, webhook registration, "import from URL", avatar/preview fetchers,
  PDF/screenshot renderers, OpenAPI/OIDC discovery URLs
- For each: is there an allowlist? Does it block cloud metadata (`169.254.169.254`,
  `metadata.google.internal`), loopback, link-local, and RFC1918? Does it re-validate **after**
  following redirects? Does it resolve DNS once and connect to that same IP (or is it
  vulnerable to DNS rebinding)? Are non-HTTP schemes (`file://`, `gopher://`, `dict://`) rejected?

**XSS**
- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
- `dangerouslySetInnerHTML`, `v-html`, `[innerHTML]`, `{@html}`
- Template escaping opt-outs: `|safe`, `{{{ }}}`, `Markup()`, `mark_safe`, `raw`, `html_safe`
- User data in a `<script>` block, in an inline event handler, or in a URL attribute
  (`href`/`src` accepting `javascript:` or `data:`)
- Sanitizer config — is DOMPurify/bleach actually configured to strip what it needs to, or
  configured with an allowlist that includes `on*` attributes or `<svg>`?
- Server-rendered JSON embedded in HTML without escaping `</script>`
- Reflected values in error pages, search results, and 404 handlers

**Deserialization and parsers**
- `pickle.loads`, `yaml.load` without `SafeLoader`, `Marshal.load`, PHP `unserialize`,
  Java `ObjectInputStream`, `.NET BinaryFormatter`
- XML parsers with external entities enabled (XXE) — check `resolve_entities`, `DTDLoad`,
  `XMLConstants.FEATURE_SECURE_PROCESSING`
- Any parser given unbounded input (billion laughs, zip bomb, catastrophic regex)

**Template injection**
- User input concatenated into a template *string* then rendered:
  `render_template_string(f"...{user}")`, `Handlebars.compile(userInput)`, Jinja/Twig/Velocity
  fed user data as the template rather than as context. This is usually RCE, not XSS.

**Other interpreters**
- `eval`, `new Function`, `setTimeout("string")`, `vm.runInNewContext`
- LDAP filters, XPath expressions, regex built from user input (ReDoS), CSV formula injection
  (`=`/`+`/`-`/`@` at the start of an exported cell), header/CRLF injection, log injection

## Step 3 — Judge honestly

Before reporting, for each candidate:
- Confirm the framework isn't already handling it. React escapes by default; Django templates
  escape by default; parameterized queries are safe even when built dynamically *around* the
  parameters. Read the code, don't assume either way.
- Confirm the value is genuinely reachable from a source, and name the entry point.
- Note the sanitization that exists and explain specifically why it's insufficient, if it is.
  "It uses a regex denylist" is an explanation; "input is not sanitized" when it visibly is,
  is a false positive.

## Report

Standard format. For every finding show the **full trace**: source line → intermediate hops →
sink line. Give a concrete payload that demonstrates it. Prefer fixes that eliminate the class
(parameterization, a safe wrapper, a strict allowlist at the boundary) over per-call escaping.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Sink reachable from a source → `/securitymaxxing:redteam` to fire the payload and prove the effect, then `/securitymaxxing:fix`.
- Reachability uncertain → `/securitymaxxing:redteam` to settle it before spending fix effort.
