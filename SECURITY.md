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
- **Advice that relies on a browser default** — for example, treating Chromium's default-Lax
  `SameSite` as CSRF protection.
- **A command that can be steered** — repository content that makes a command take an action
  it shouldn't (see below). Please report these privately.

## Prompt-injection risk

Commands read the code you point them at, and a repository you don't trust can contain text
aimed at the model. `fix`, `redteam`, and `help` can edit files and run shell commands; run them
only on code you trust, keep Claude Code's permission prompts on, and report any command that
can be steered into an unintended action as a vulnerability.

Include the code and what the review should have said. That's the whole report.

## Scope note

The review commands read code. `redteam` can send proof-of-concept requests to an instance you
own or are authorized to test, to confirm specific findings; none of this replaces a
penetration test. Findings are hypotheses until verified. Nothing in this repository
should be presented to an auditor, a customer, or a regulator as evidence that a system was
professionally assessed.
