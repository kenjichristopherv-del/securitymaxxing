# Security Policy

## Reporting a vulnerability

This repository contains no executable code — it's markdown prompts and skill definitions.
The realistic risk here isn't a memory bug, it's **bad guidance**: a prompt that tells Claude
a vulnerable pattern is safe, or a "fix" that doesn't actually close the hole.

Report either of these as a normal issue, or privately via GitHub's
[private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
if you'd rather not do it in public.

Especially valuable:

- **A recommended pattern that is actually insecure**, or insecure in a context the prompt
  doesn't caveat.
- **A fix that leaves a bypass open** — the classic being path-traversal advice that blocks
  `../` textually but not `%2e%2e%2f`.
- **A false negative** — code with a real vulnerability that a command reviewed and cleared.
- **A false positive pattern** — clean code a command consistently misreports. These become
  anti-false-positive rules in `security-review-method`, which improves every command at once.

Include the code and what the review should have said. That's the whole report.

## Scope note

These prompts read code. They don't run your application, don't test it live, and don't
replace a penetration test. Findings are hypotheses until verified. Nothing in this repository
should be presented to an auditor, a customer, or a regulator as evidence that a system was
professionally assessed.
