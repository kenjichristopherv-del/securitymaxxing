---
description: Find leaked credentials in code, config, and git history — and tell you which ones must be rotated, not just deleted.
argument-hint: "[path] (optional)"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(rg:*), Bash(find:*), Bash(ls:*)
---

# Secrets and credential hygiene

A secret in git is leaked the moment it is pushed. Deleting it does not unleak it. The
deliverable of this command is a **rotation list**, not a cleanup list.

Scope: $ARGUMENTS

**Never print a full secret value into the transcript.** Report location plus a redacted
fingerprint (`AKIA…7Q3F`, `sk-ant-…9x2`). The transcript is another place the secret now lives.

## 1. Working tree

Search code, config, infra, CI, notebooks, and documentation for:

- Cloud keys: `AKIA`/`ASIA` (AWS), `AIza` (Google), `ya29.` (OAuth), Azure connection strings,
  GCP service-account JSON (`"type": "service_account"`, `private_key`)
- Provider tokens: `sk-`/`sk-ant-`/`sk-proj-` (AI APIs), `ghp_`/`gho_`/`ghs_`/`github_pat_`,
  `glpat-`, `xoxb-`/`xoxp-` (Slack), `SG.` (SendGrid), `sk_live_`/`rk_live_` (Stripe),
  `AC`+32hex (Twilio), `npm_`, `dckr_pat_`
- Private keys: `-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----`, `.pem`, `.p12`, `.pfx`,
  `.jks`, `id_rsa`
- Connection strings with inline credentials: `postgres://user:pass@`, `mongodb+srv://`,
  `mysql://`, `redis://:pass@`, `amqp://`
- Generic assignments: `password`, `passwd`, `secret`, `api_key`, `apikey`, `token`,
  `client_secret`, `private_key`, `credential`, `auth`, `bearer` — followed by a literal string
- High-entropy string literals (long base64/hex) that don't look like a hash or a test fixture
- JWTs (`eyJ`) — decode the header/payload to see if it's a real signed token and whether it's expired

Cover file types people forget: `Dockerfile`, `docker-compose.yml`, `.github/workflows/*`,
`*.tf`, `*.tfstate` (state files contain plaintext secrets), `k8s` manifests and ConfigMaps,
`.npmrc`, `.pypirc`, `.netrc`, `*.ipynb` outputs, `README`/`docs`, mobile
`Info.plist`/`strings.xml`, and any `.env*` variant.

## 2. Git history and tracked-file check

The working tree is the least interesting place to look.

```
git ls-files | rg -i '\.env|\.pem$|\.p12$|\.pfx$|id_rsa|credentials|secrets|\.key$|\.tfstate'
git log --all --diff-filter=A --name-only --pretty=format:'%H %an %ad'
git log --all -p -S 'BEGIN RSA PRIVATE KEY' --oneline
git log --all -p -S 'AKIA' --oneline
git log --all -p -S 'password' --oneline -- '*.env*' '*.yml' '*.json'
```

Also check: stashes (`git stash list`), other branches and tags (`--all` covers these), and
whether `.env` is actually in `.gitignore` — and was **before** it was first committed.

For anything found in history, determine the **first commit that introduced it** and whether
the repository was ever public, forked, mirrored, or pushed to a CI cache. If yes, treat it as
compromised regardless of what happened afterward.

## 3. Runtime and distribution leakage

- Secrets passed as `ARG` or `ENV` in a Dockerfile — these persist in image layers even if
  unset later. Check for `--mount=type=secret` usage instead.
- Secrets echoed in CI logs, or referenced in a workflow triggered by `pull_request_target`
  (which exposes them to fork PRs).
- Client-side exposure: anything prefixed `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`
  ships to the browser. A "secret" API key there is public. Check the bundle and source maps.
- Secrets in mobile app binaries, in error-reporting payloads, or in analytics events.
- Secrets logged: grep for logging calls that include a token/header/body variable.

## 4. Assess how they're managed

Beyond finding leaks, judge the system:

- Where do secrets come from in production — environment, a secrets manager (Vault, AWS Secrets
  Manager, Doppler, 1Password), or a file on disk?
- Is there any rotation story at all? When was each key last rotated?
- Are keys scoped to least privilege, or is everything a root/admin key? A leaked read-only,
  IP-restricted key is a different incident from a leaked root key.
- Are the same credentials shared between dev, staging, and production? (If yes, that's the
  finding — a dev leak becomes a production breach.)
- Are `.gitignore` and a pre-commit secret scanner (gitleaks, trufflehog, `detect-secrets`) in place?

## Report

Produce a **rotation table**, ordered by blast radius:

| Secret | Location | In git history? | Repo ever public? | Still valid? | Blast radius | Action |
|---|---|---|---|---|---|---|

Then, for anything real:

1. **Rotate first.** Issue the new credential, deploy it, then revoke the old one. Give the
   exact console/CLI path to rotate for that provider.
2. **Then check for abuse.** Point to where to look: CloudTrail, provider audit logs, billing
   anomalies, unexpected regions. A leaked key that's been public for months should be assumed used.
3. **Then clean history** — `git filter-repo` or BFG — and be explicit that this rewrites
   history, requires a force push, breaks every existing clone and fork, and **does not** help
   if anyone already fetched it. Rotation is the real fix; history rewriting is cosmetic.
4. **Then prevent recurrence:** secret manager, pre-commit hook, CI scanning, push protection.

If nothing was found, say so and list what you searched — including the history commands you
ran — so the reader knows the coverage.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- A live secret confirmed → ROTATE it now (a manual provider action, not a command), then clean history, then add a pre-commit scanner. Rotation is the fix; a code edit is not.
- Nothing found → state the coverage, including the history commands you ran.
