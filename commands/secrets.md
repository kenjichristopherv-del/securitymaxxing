---
description: Find leaked credentials in code, config, and git history — and tell you which ones must be rotated, not just deleted.
argument-hint: "[path] (optional)"
allowed-tools: Read, Grep, Glob, Bash(git ls-files:*), Bash(git log:*), Bash(git show:*), Bash(git stash list:*), Bash(git check-ignore:*), Bash(git remote -v), Bash(git rev-list:*), Bash(gitleaks:*), Bash(trufflehog:*)
---

# Secrets and credential hygiene

A secret in git is leaked the moment it is pushed. Deleting it does not unleak it. The
deliverable of this command is a **rotation list**, not a cleanup list.

Scope: $ARGUMENTS

**Never print a full secret value into the transcript.** Report location plus a redacted
fingerprint (`AKIA…7Q3F`, `sk-ant-…9x2`). The transcript is another place the secret now lives.
That's why this command never uses `git log -p` — it prints whole patches, secrets included.
**Read-only:** never rewrite history, force-push, or call a provider with a found credential.

## 1. Working tree

Search code, config, infra, CI, notebooks, and documentation for:

- Cloud keys: `AKIA`/`ASIA` (AWS), `AIza` (Google), `ya29.` (OAuth), Azure connection strings,
  GCP service-account JSON (`"type": "service_account"`, `private_key`)
- Provider tokens: `sk-`/`sk-ant-`/`sk-proj-` (AI APIs), `ghp_`/`gho_`/`ghs_`/`github_pat_`,
  `glpat-`, `xoxb-`/`xoxp-` (Slack), `SG.` (SendGrid), `sk_live_`/`rk_live_` (Stripe),
  Twilio auth tokens / API key secrets (an `AC…` Account SID or `SK…` key SID alone is an
  identifier, not a secret — look for the 32-hex secret next to it), `npm_`, `dckr_pat_`
- Private keys: any `-----BEGIN [A-Z ]*PRIVATE KEY-----` (covers PKCS#8 `BEGIN PRIVATE KEY`, RSA,
  EC, DSA, OPENSSH, ENCRYPTED, PGP), `.pem`, `.p12`, `.pfx`,
  `.jks`, `id_rsa`
- Connection strings with inline credentials: `postgres://user:pass@`, `mongodb+srv://`,
  `mysql://`, `redis://:pass@`, `amqp://`
- Generic assignments: `password`, `passwd`, `secret`, `api_key`, `apikey`, `token`,
  `client_secret`, `private_key`, `credential`, `auth`, `bearer` — followed by a literal string
- High-entropy string literals (long base64/hex) that don't look like a hash or a test fixture
- JWTs (`eyJ`) — decode the header/payload to see if it's a real signed token and whether it's
  expired. Decode locally — never paste a token into jwt.io or any web tool.

Not secrets by design: the Supabase `anon` key, Firebase web config, restricted Google Maps `AIza`
keys, Stripe `pk_` keys — report them only if unrestricted. The Supabase `service_role` key **is**
a secret.

Cover file types people forget: `Dockerfile`, `docker-compose.yml`, `.github/workflows/*`,
`*.tf`, `*.tfstate` (state files contain plaintext secrets), `k8s` manifests and ConfigMaps,
`.npmrc`, `.pypirc`, `.netrc`, `*.ipynb` outputs, `README`/`docs`, mobile
`Info.plist`/`strings.xml`, and any `.env*` variant.

## 2. Git history and tracked-file check

The working tree is the least interesting place to look.

```
git ls-files -- '*.env*' '*.pem' '*.p12' '*.pfx' '*id_rsa*' '*credentials*' '*secrets*' '*.key' '*.tfstate*'
git log --all --diff-filter=A --name-only --pretty=format:'%h %an %ad' -- '*.env*' '*.pem' '*.p12' '*.pfx' '*id_rsa*' '*credentials*' '*.key' '*.tfstate*'
git log --all -S 'PRIVATE KEY-----' --oneline --name-only
git log --all -G 'A(KIA|SIA)[0-9A-Z]{16}' --oneline --name-only
git log --all -G '[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]' --oneline --name-only -- '*.env*' '*.yml' '*.yaml' '*.json'
```

`-G` takes POSIX extended regex — no `(?i)`. Inspect a hit with `git show <sha> -- <file>` and
redact before quoting anything. If `gitleaks` or `trufflehog` is installed, run
`gitleaks git --redact` (older versions: `gitleaks detect --redact`) and
`trufflehog git file://. --no-verification` — verification sends the secret to the provider, so
only with consent.

Also check stashes (`git stash list`; `--all` includes `refs/stash`) and whether `.env` is
actually in `.gitignore` (`git check-ignore -v .env`) — and was **before** it was first committed
(`git log --oneline -- .gitignore`). Add `--reflog` to include recently orphaned commits. Note
what local history can't see: unfetched remote branches, GitHub PR refs and forks, and cached
commits on the host.

For anything found in history, determine the **first commit that introduced it** and whether
the repository was ever public, forked, mirrored, or pushed to a CI cache (check `git remote -v`;
visibility history needs the user or the hosting provider — ask). If yes, treat it as
compromised regardless of what happened afterward.

## 3. Runtime and distribution leakage

- Secrets passed as `ARG` or `ENV` in a Dockerfile — these persist in image layers even if
  unset later. Check for `--mount=type=secret` usage instead.
- Secrets echoed in CI logs, or available to a `pull_request_target`/`workflow_run` workflow that
  checks out or executes fork code, or interpolates PR-controlled text into `run:` — that hands
  the secrets to the fork author.
- Client-side exposure: anything prefixed `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`,
  `PUBLIC_` (SvelteKit/Astro), `NUXT_PUBLIC_`, `GATSBY_`
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

Fill "Still valid?" as **Unknown** unless the user confirms — checking is an active call to the
provider; offer `/securitymaxxing:redteam` for that.

Then, for anything real:

1. **Rotate first.** Issue the new credential, deploy it, then revoke the old one. Give the
   exact console/CLI path to rotate for that provider.
2. **Then check for abuse.** Point to where to look: CloudTrail, provider audit logs, billing
   anomalies, unexpected regions. A leaked key that's been public for months should be assumed used.
3. **Then clean history** — `git filter-repo` or BFG — and be explicit that this rewrites
   history, requires a force push, breaks every existing clone and fork, and **does not** help
   if anyone already fetched it. GitHub keeps cached views and PR refs after a force push; full
   removal needs GitHub Support. Rotation is the real fix; history rewriting is cosmetic. Never
   run filter-repo/BFG or force-push from this command — that's the user's call.
4. **Then prevent recurrence:** secret manager, pre-commit hook, CI scanning, push protection.

If nothing was found, say so and list what you searched — including the history commands you
ran — so the reader knows the coverage.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- A live secret confirmed → ROTATE it now (a manual provider action, not a command), then clean history, then add a pre-commit scanner. Rotation is the fix; a code edit is not.
- Nothing found → state the coverage, including the history commands you ran.
