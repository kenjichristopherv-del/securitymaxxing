---
description: Explain a vulnerability, finding, or security concept in plain English — how it works, why it matters here, and how to fix it.
argument-hint: "[vulnerability, CVE, finding, or code to explain]"
allowed-tools: Read, Grep, Glob, Bash(rg:*), WebFetch, WebSearch
---

# Explain it

Teach, don't lecture. The goal is that afterwards the user can spot this class of bug
themselves, in their own code, without you.

Subject: $ARGUMENTS

## Structure

**1. The one-sentence version.** What the bug actually is, in words a smart non-specialist
understands. No acronyms in this sentence.

**2. How it works.** The mechanism, walked through concretely. Use a tiny worked example —
vulnerable code, the exact input an attacker sends, and what the program then does. Show the
attacker's side of it; abstractions don't stick, a payload does.

**3. Why it matters *here*.** This is the part generic explanations skip. Look at the user's
actual codebase:
- Does this pattern exist in their code? Cite `file:line` if it does.
- What would an attacker get in *their* application specifically — which table, which users,
  which money?
- If their code is **not** vulnerable, say so and show *why* the framework or the code already
  protects them. Understanding the mitigation is more durable than fearing the bug.

**4. How to fix it.** The correct pattern, in their language and framework, using their style.
Then the non-obvious part: **why the tempting-but-wrong fixes fail.** Blocking `../` misses
`%2e%2e%2f`. Escaping quotes misses numeric context. Denylists always miss something. This is
where real understanding lives.

**5. How to spot it next time.** What to grep for, what shape of code should make them
suspicious, what question to ask when reviewing a PR.

## Rules

- **Never invent details.** No fabricated CVE numbers, advisory IDs, version ranges, or exploit
  specifics. If you're describing a specific named vulnerability and aren't certain of the
  details, look it up (WebSearch/WebFetch) or say you're describing the class rather than the
  specific advisory.
- **Adjust depth to the question.** "What's XSS" gets the fundamentals. "Why does this CSP
  bypass work" gets the deep version. Read which one you were asked.
- **Keep the offense educational.** Explain mechanisms and payloads clearly enough to
  understand and defend against — that's how appsec is taught. Don't build tooling for
  attacking systems the user doesn't own, and if the question is really "how do I break into
  someone else's system," say plainly that you'll explain the defense instead.
- **No moralizing.** They're trying to learn how their software breaks. That's the right instinct.

## Recommended next step

Close by printing one line — `→ Recommended next: …`: if the pattern exists in their code,
`/securitymaxxing:fix`; otherwise back to whatever review raised it (or `/securitymaxxing:audit`
if they came in cold).
